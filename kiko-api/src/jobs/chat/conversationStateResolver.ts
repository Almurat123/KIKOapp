// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Renata
// Reason: Farcaster inbound mentions are persisted with transport wrapper text
//         that can pollute token-symbol extraction and canonical intent
//         normalization if the owner layer does not recover the literal user
//         query before downstream routing.
// Goal: keep execution confirmation state deterministic while recovering the
//       effective user query from wrapped transport text before entity
//       extraction or later orchestration stages consume it, preserve
//       non-order mutation action classes when the generic confirmation carrier
//       stores prepared tool execution, and carry explicit source/binding
//       metadata forward into the worker state.
//         Clanker dry-run previews now also need to survive as reusable
//         confirmation state so the model can confirm the exact prepared
//         launch payload and the backend can replay it with `confirmDeploy`
//         only at execution handoff.
//         TaskRoute now also owns the primary task/phase, so confirmation
//         carry-forward must not trust stale canonical execute/confirm flags
//         once the route owner has changed.
// Owns: reconstructing conversation confirmation state from recent tool traces
//       and recovering literal user query text from wrapped chat ingress.
// Does Not Own: webhook ingress formatting, tool execution, or copy-trade persistence.
// Design Language:
// - confirmation state carries provenance; it does not reinterpret wallet identity
// - wallet-binding metadata is separate from public tool args
// - TaskRoute phase outranks stale canonical confirmation flags
// - stale confirmation protections stay separate from audit provenance
// - transport wrapper labels must never become token symbols or search terms
// - downstream intent routing should see the literal user query, not ingress scaffolding
// - generic order_confirmation payloads must preserve TOKEN_DEPLOY_MUTATION
//   instead of collapsing every non-trade mutation back to ORDER_MUTATION
// - confirmation state should retain source tool and capture time when known
// - swap confirmation should carry quote metadata when the preflight tool returned it
// - Clanker dry-run previews are confirmation-ready state and must not be
//   discarded just because the original tool call used `confirmDeploy=false`
// - successful Clanker receipts clear stale previews instead of reusing older
//   dry-run state after execution
// Document Provenance:
// - Source: Farcaster mention runtime logs showing "FARCASTER" and "CURRENT"
//           leaking into requested token symbols and forcing social_discovery routing
// - Kind: runtime observation
// - Retrieved: 2026-04-15
// - Applied To: unwrapping Farcaster mention context before entity extraction
// - Verification: verified in runtime and targeted tests
// - Source: production incident analysis of malformed BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-14
// - Applied To: preserving copy-trade wallet_binding through confirmation state
// - Verification: verified in targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: preserving TOKEN_DEPLOY_MUTATION confirmation action class
// - Verification: verified in code and targeted tests
// - Source: product-owner runtime review of KiKo chat architecture
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: explicit confirmation source/binding metadata
// - Verification: verified in code and targeted tests
// - Source: local runtime observation of Clanker dry-run preview / confirm
//           mismatch in the current KiKo thread
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: converting Clanker dry-run previews into reusable confirmation
//   state and clearing them after successful deploys
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-neynar-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-farcaster-query-unwrapping-and-wallet-guard.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-clanker-dry-run-confirmation-continuity.md
import type {
    ChatContextSnapshot,
    ChatHistoryMessage,
    ConversationActionState,
    RecentToolTrace,
    TradeQuoteState,
    TradeConfirmationState,
} from './contracts.js';
import type { ActionClass } from './controlPolicy.js';
import { isExplicitChainSwitchRequest } from './chainIntent.js';
import { extractTradeAssetCandidates } from '../../services/ai/tradeSemantics.js';
import { shouldSupersedePendingSwapConfirmation } from './swapConfirmationSupersession.js';
import { computeConfirmationToken } from './executionGate.js';

const EVM_ADDR_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOL_ADDR_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const FARCASTER_CURRENT_LINE_RE = /(?:^|\n)Current\s+(?:@\S+|fid:\d+):\s*([\s\S]*)$/i;
export const SWAP_CONFIRMATION_REPLAY_WINDOW_MS = 2 * 60 * 1000;
export const PREPARED_CONFIRMATION_REPLAY_WINDOW_MS = 10 * 60 * 1000;

export function extractEffectiveUserQuery(text: string): string {
    const raw = String(text || '').trim();
    if (!raw) return '';
    const currentMatch = raw.match(FARCASTER_CURRENT_LINE_RE);
    const currentText = currentMatch?.[1]?.trim();
    if (currentText) return currentText;
    return raw;
}

export function sanitizeHistory(messages: any[]): ChatHistoryMessage[] {
    return (messages || []).map((msg) => ({
        role: msg.role,
        content: msg.content || '',
        reasoningContent: msg.reasoningContent || msg.reasoning_content || '',
        toolCalls: Array.isArray(msg.toolCalls) ? msg.toolCalls : (Array.isArray(msg.tool_calls) ? msg.tool_calls : undefined),
        toolCallId: msg.toolCallId || msg.tool_call_id,
        data: msg.data,
        messageId: msg.messageId || msg.id,
    })).map((msg, idx, arr) => {
        if (msg.role !== 'assistant' || !Array.isArray(msg.toolCalls) || msg.toolCalls.length === 0) {
            return msg;
        }
        const next = arr[idx + 1];
        if (next?.role === 'tool' && next.toolCallId) {
            return msg;
        }
        return { ...msg, toolCalls: undefined };
    });
}

export function extractRequestedTokenAddresses(text: string): string[] {
    const values = new Set<string>();
    for (const match of text.match(EVM_ADDR_RE) || []) values.add(match.toLowerCase());
    for (const match of text.match(SOL_ADDR_RE) || []) values.add(match);
    return Array.from(values);
}

export function extractRequestedTokenAddressesFromHistory(messages: any[], recentUserLimit = 6): string[] {
    const values = new Set<string>();
    for (const message of collectRecentUserMessages(messages, recentUserLimit)) {
        for (const value of extractRequestedTokenAddresses(extractEffectiveUserQuery(String(message?.content || '')))) {
            values.add(value);
        }
    }
    return Array.from(values);
}

export function extractRequestedTokenSymbols(text: string): string[] {
    return extractTradeAssetCandidates(text)
        .filter((value) => !/^0x[a-fA-F0-9]{40}$/.test(value) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value));
}

export function extractRequestedTokenSymbolsFromHistory(messages: any[], recentUserLimit = 6): string[] {
    const values = new Set<string>();
    for (const message of collectRecentUserMessages(messages, recentUserLimit)) {
        for (const value of extractRequestedTokenSymbols(extractEffectiveUserQuery(String(message?.content || '')))) {
            values.add(value);
        }
    }
    return Array.from(values);
}

export function extractRecentToolTrace(messages: any[]): RecentToolTrace | null {
    const assistantMessages = [...(messages || [])]
        .filter((msg) => msg.role === 'assistant' && Array.isArray(msg.data?.toolTrace?.toolCalls))
        .sort(compareMessagesChronologically);
    if (assistantMessages.length === 0) return null;

    const toolCalls = assistantMessages
        .flatMap((msg) => Array.isArray(msg.data?.toolTrace?.toolCalls) ? msg.data.toolTrace.toolCalls : [])
        .filter((call) => call && typeof call === 'object' && String(call.tool || '').trim())
        .slice(-48);
    if (toolCalls.length === 0) return null;

    const recentAssistant = assistantMessages[assistantMessages.length - 1];
    return {
        messageId: recentAssistant.id,
        toolCalls,
    };
}

export function buildConversationActionState(snapshot: ChatContextSnapshot): ConversationActionState {
    const raw = String(snapshot.lastUserMessage || '').trim();
    const taskRoute = snapshot.taskRoute || null;
    const normalizedIntent = snapshot.normalizedIntent || null;
    const wantsConfirmation = taskRoute
        ? taskRoute.phase === 'confirm' || taskRoute.phase === 'execute'
        : normalizedIntent?.taskMode === 'confirm' || normalizedIntent?.taskMode === 'execute';
    const carriesMutationIntent = taskRoute
        ? ['swap', 'copy_trade', 'polymarket', 'token_deploy'].includes(taskRoute.owner)
        : normalizedIntent
            ? ['swap', 'cross_chain_swap', 'copy_trade', 'polymarket_order', 'clanker_deploy'].includes(String(normalizedIntent.intent || ''))
            : true;
    const explicitChainSwitch = isExplicitChainSwitchRequest(raw, normalizedIntent, taskRoute);
    const toolTrace = snapshot.recentToolTrace || null;

    if (explicitChainSwitch) {
        return {
            pendingAction: 'none',
            confirmationPayload: null,
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    const payloadConfirmation = resolveOrderConfirmationFromToolTrace(toolTrace);
    if (payloadConfirmation) {
        if (!wantsConfirmation && !carriesMutationIntent) {
            return {
                pendingAction: 'none',
                confirmationPayload: null,
                canExecute: false,
                needsClarification: false,
                clarificationQuestion: null,
            };
        }
        if (
            payloadConfirmation.kind === 'swap_confirmation'
            && shouldSupersedePendingSwapConfirmation({
                text: raw,
                snapshot,
                pendingSwap: payloadConfirmation.swap,
            })
        ) {
            return {
                pendingAction: 'none',
                confirmationPayload: null,
                canExecute: false,
                needsClarification: false,
                clarificationQuestion: null,
            };
        }
        return {
            pendingAction: payloadConfirmation.kind === 'copy_trade_confirmation' ? 'copy_trade' : 'order',
            confirmationPayload: payloadConfirmation,
            canExecute: wantsConfirmation,
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    if (wantsConfirmation) {
        const swapConfirmation = resolveSwapConfirmationFromToolTrace(toolTrace);
        if (swapConfirmation) {
            if (
                shouldSupersedePendingSwapConfirmation({
                    text: raw,
                    snapshot,
                    pendingSwap: swapConfirmation.swap,
                })
            ) {
                return {
                    pendingAction: 'none',
                    confirmationPayload: null,
                    canExecute: false,
                    needsClarification: false,
                    clarificationQuestion: null,
                };
            }
            return {
                pendingAction: 'swap',
                confirmationPayload: swapConfirmation,
                canExecute: true,
                needsClarification: false,
                clarificationQuestion: null,
            };
        }

        return {
            pendingAction: 'none',
            confirmationPayload: null,
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        };
    }

    return {
        pendingAction: 'none',
        confirmationPayload: null,
        canExecute: false,
        needsClarification: false,
        clarificationQuestion: null,
    };
}

export function applyConversationActionState(snapshot: ChatContextSnapshot): ChatContextSnapshot {
    const conversationActionState = buildConversationActionState(snapshot);
    return {
        ...snapshot,
        conversationActionState,
        confirmationState: conversationActionState.confirmationPayload || null,
    };
}

export function resolveTradeConfirmationState(
    messages: any[],
    latestUserMessage: string,
    normalizedIntent?: ChatContextSnapshot['normalizedIntent'],
    taskRoute?: ChatContextSnapshot['taskRoute'],
): TradeConfirmationState | null {
    const snapshot = applyConversationActionState({
        sessionId: 'adhoc',
        taskId: 'adhoc',
        model: 'adhoc',
        history: sanitizeHistory(messages),
        lastUserMessage: latestUserMessage,
        recentToolTrace: extractRecentToolTrace(messages),
        runtime: {},
        requestedTokenAddresses: extractRequestedTokenAddressesFromHistory(messages),
        requestedTokenSymbols: extractRequestedTokenSymbolsFromHistory(messages),
        taskRoute: taskRoute || null,
        normalizedIntent: normalizedIntent || null,
        toolDefinitions: [],
    } as ChatContextSnapshot);
    return snapshot.confirmationState || null;
}

export function isConfirmationMessage(_message: string, snapshot?: ChatContextSnapshot | null): boolean {
    const taskRoute = snapshot?.taskRoute || null;
    if (taskRoute?.phase === 'confirm' || taskRoute?.phase === 'execute') return true;
    const normalizedIntent = snapshot?.normalizedIntent || null;
    return normalizedIntent?.taskMode === 'confirm' || normalizedIntent?.taskMode === 'execute' || false;
}

function resolveSwapConfirmationFromToolTrace(trace: RecentToolTrace | null): TradeConfirmationState | null {
    const calls = trace?.toolCalls || [];
    for (let idx = calls.length - 1; idx >= 0; idx -= 1) {
        const call = calls[idx];
        if (!['success', 'cached'].includes(String(call?.status || ''))) continue;
        const toolName = String(call?.tool || '');
        if (!['simulate_swap', 'prepare_swap_transaction', 'get_cross_chain_quote', 'prepare_cross_chain_tx'].includes(toolName)) {
            continue;
        }
        if (!isReusableSwapPrecheckCall(call, SWAP_CONFIRMATION_REPLAY_WINDOW_MS)) continue;
        const args = (call?.args && typeof call.args === 'object') ? call.args as Record<string, any> : {};
        if (toolName === 'get_cross_chain_quote' || toolName === 'prepare_cross_chain_tx') {
            if (!args.fromToken || !args.toToken || !args.fromAmount) continue;
            const quote = buildTradeQuoteState(toolName, args, call?.result, extractCallTimestamp(call), true);
            return {
                kind: 'swap_confirmation',
                sourceTool: toolName,
                capturedAt: extractCallTimestamp(call),
                binding: {
                    binding_kind: 'preflight_quote',
                    tool_name: toolName,
                    action_class: 'TRADE_MUTATION',
                    source_tool: toolName,
                    captured_at: extractCallTimestamp(call),
                },
                quote,
                swap: {
                    tokenIn: String(args.fromToken),
                    tokenOut: String(args.toToken),
                    amountIn: String(args.fromAmount),
                    chainId: Number(args.fromChain || 0) || undefined,
                    toChain: Number(args.toChain || 0) || undefined,
                    isCrossChain: true,
                },
            };
        }
        if (!args.token_in || !args.token_out || !args.amount_in) continue;
        const quote = buildTradeQuoteState(toolName, args, call?.result, extractCallTimestamp(call), false);
        return {
            kind: 'swap_confirmation',
            sourceTool: toolName,
            capturedAt: extractCallTimestamp(call),
            binding: {
                binding_kind: 'preflight_quote',
                tool_name: toolName,
                action_class: 'TRADE_MUTATION',
                source_tool: toolName,
                captured_at: extractCallTimestamp(call),
            },
            quote,
            swap: {
                tokenIn: String(args.token_in),
                tokenOut: String(args.token_out),
                amountIn: String(args.amount_in),
                chainId: Number(args.chain_id || 0) || undefined,
                isCrossChain: false,
            },
        };
    }
    return null;
}

export function hasReusableSwapConfirmationEvidence(
    snapshot: Pick<ChatContextSnapshot, 'confirmationState' | 'recentToolTrace'> | null | undefined,
    windowMs = SWAP_CONFIRMATION_REPLAY_WINDOW_MS,
): boolean {
    const confirmation = snapshot?.confirmationState;
    if (confirmation?.kind !== 'swap_confirmation' || !confirmation.swap) return false;
    const calls = snapshot?.recentToolTrace?.toolCalls || [];
    for (let idx = calls.length - 1; idx >= 0; idx -= 1) {
        const call = calls[idx];
        if (!isReusableSwapPrecheckCall(call, windowMs)) continue;
        if (swapPrecheckCallMatchesConfirmation(call, confirmation)) {
            return true;
        }
    }
    return false;
}

function resolveOrderConfirmationFromToolTrace(trace: RecentToolTrace | null): TradeConfirmationState | null {
    const calls = trace?.toolCalls || [];
    for (let idx = calls.length - 1; idx >= 0; idx -= 1) {
        const call = calls[idx];
        if (!isReusablePreparedConfirmationCall(call, PREPARED_CONFIRMATION_REPLAY_WINDOW_MS)) continue;
        const result = (call?.result && typeof call.result === 'object') ? call.result : {};
        if (isTokenDeployToolName(String(call?.tool || '').trim())) {
            const tokenDeployConfirmation = resolveTokenDeployConfirmationFromToolTrace(call, result);
            if (tokenDeployConfirmation) return tokenDeployConfirmation;
            if (isTokenDeployExecutionReceipt(result)) return null;
        }
        const payload = (result?.confirmation_payload && typeof result.confirmation_payload === 'object')
            ? result.confirmation_payload
            : null;
        if (!payload || result?.requires_confirmation !== true) continue;

        const toolName = String(payload.tool_name || call.tool || '').trim();
        const confirmationToken = String(payload.confirmation_token || '').trim();
        const actionClass = String(payload.action_class || '').trim() as ActionClass;
        if (!toolName || !confirmationToken) continue;

        const orderPayload = {
            toolName,
            args: (payload.args && typeof payload.args === 'object') ? payload.args : {},
            confirmationToken,
            actionClass: normalizeConfirmationActionClass(actionClass),
        };

        if (toolName === 'create_copy_trade_config' || toolName === 'create_polymarket_copy_config') {
            return {
                kind: 'copy_trade_confirmation',
                sourceTool: String(call.tool || toolName),
                capturedAt: extractCallTimestamp(call),
                binding: {
                    binding_kind: 'prepared_confirmation',
                    binding_key: confirmationToken,
                    tool_name: toolName,
                    action_class: normalizeConfirmationActionClass(actionClass),
                    source_tool: String(call.tool || toolName),
                    captured_at: extractCallTimestamp(call),
                },
                copyTrade: {
                    targetWallet: String(orderPayload.args.target_wallet || orderPayload.args.targetWallet || ''),
                    buyAmountUsd: Number(orderPayload.args.buy_amount_usd || orderPayload.args.bet_size_usd || 0),
                    chainId: Number(orderPayload.args.chain_id || 0) || undefined,
                    mirrorSell: typeof orderPayload.args.mirror_sell === 'boolean' ? orderPayload.args.mirror_sell : undefined,
                    takeProfitPct: Number.isFinite(Number(orderPayload.args.take_profit_pct)) ? Number(orderPayload.args.take_profit_pct) : undefined,
                    stopLossPct: Number.isFinite(Number(orderPayload.args.stop_loss_pct)) ? Number(orderPayload.args.stop_loss_pct) : undefined,
                    walletBinding: (payload.wallet_binding && typeof payload.wallet_binding === 'object')
                        ? payload.wallet_binding
                        : undefined,
                },
            };
        }

        return {
            kind: 'order_confirmation',
            sourceTool: String(call.tool || toolName),
            capturedAt: extractCallTimestamp(call),
            binding: {
                binding_kind: 'prepared_confirmation',
                binding_key: confirmationToken,
                tool_name: toolName,
                action_class: normalizeConfirmationActionClass(actionClass),
                source_tool: String(call.tool || toolName),
                captured_at: extractCallTimestamp(call),
            },
            order: orderPayload,
        };
    }
    return null;
}

function normalizeConfirmationActionClass(actionClass: ActionClass): ActionClass {
    if (actionClass === 'TRADE_MUTATION' || actionClass === 'ORDER_MUTATION' || actionClass === 'TOKEN_DEPLOY_MUTATION') {
        return actionClass;
    }
    return 'ORDER_MUTATION';
}

function isTokenDeployToolName(toolName: string): boolean {
    return toolName === 'deploy_clanker_token' || toolName === 'deploy_fourmeme_token';
}

function resolveTokenDeployConfirmationFromToolTrace(
    call: any,
    result: Record<string, any>,
): TradeConfirmationState | null {
    if (result?.requires_confirmation !== true && result?.dryRun !== true) return null;
    const toolName = String(call?.tool || '').trim();
    if (!isTokenDeployToolName(toolName)) return null;
    const launchArgs = extractTokenDeployLaunchArgs(toolName, call, result);
    if (!launchArgs) return null;
    const executionArgs = buildTokenDeployExecutionArgs(launchArgs);
    const confirmationToken = computeConfirmationToken(toolName, executionArgs);
    return {
        kind: 'order_confirmation',
        sourceTool: String(call?.tool || toolName),
        capturedAt: extractCallTimestamp(call),
        binding: {
            binding_kind: 'prepared_confirmation',
            binding_key: confirmationToken,
            tool_name: toolName,
            action_class: 'TOKEN_DEPLOY_MUTATION',
            source_tool: String(call?.tool || toolName),
            captured_at: extractCallTimestamp(call),
        },
        order: {
            toolName,
            args: executionArgs,
            confirmationToken,
            actionClass: 'TOKEN_DEPLOY_MUTATION',
        },
    };
}

function extractTokenDeployLaunchArgs(toolName: string, call: any, result: Record<string, any>): Record<string, any> | null {
    const confirmationPayload = (result?.confirmation_payload && typeof result.confirmation_payload === 'object')
        ? result.confirmation_payload as Record<string, any>
        : null;
    if (confirmationPayload?.args && typeof confirmationPayload.args === 'object') {
        return confirmationPayload.args as Record<string, any>;
    }
    const callArgs = (call?.args && typeof call.args === 'object')
        ? call.args as Record<string, any>
        : null;
    const dryRunPayload = (result?.payload && typeof result.payload === 'object')
        ? result.payload as Record<string, any>
        : null;
    const normalizedDryRunArgs = dryRunPayload
        ? toolName === 'deploy_clanker_token'
            ? convertClankerDryRunPayloadToToolArgs(dryRunPayload)
            : dryRunPayload
        : null;
    if (normalizedDryRunArgs && callArgs) {
        return {
            ...normalizedDryRunArgs,
            ...callArgs,
        };
    }
    if (normalizedDryRunArgs) return normalizedDryRunArgs;
    if (callArgs) {
        return callArgs;
    }
    return null;
}

function buildTokenDeployExecutionArgs(args: Record<string, any>): Record<string, any> {
    return {
        ...(args || {}),
        confirmDeploy: true,
    };
}

function convertClankerDryRunPayloadToToolArgs(payload: Record<string, any>): Record<string, any> | null {
    const token = payload?.token && typeof payload.token === 'object'
        ? payload.token as Record<string, any>
        : null;
    if (!token) {
        if (typeof payload.name === 'string' || typeof payload.symbol === 'string') {
            return payload;
        }
        return null;
    }
    const args: Record<string, any> = {};
    if (typeof token.name === 'string' && token.name.trim()) args.name = token.name;
    if (typeof token.symbol === 'string' && token.symbol.trim()) args.symbol = token.symbol;
    if (typeof token.image === 'string' && token.image.trim()) args.image = token.image;
    if (typeof token.description === 'string' && token.description.trim()) args.description = token.description;
    if (typeof token.tokenAdmin === 'string' && token.tokenAdmin.trim()) args.tokenAdmin = token.tokenAdmin;
    if (typeof payload.chainId === 'number' && Number.isFinite(payload.chainId)) args.chainId = payload.chainId;
    if (typeof token.requestKey === 'string' && token.requestKey.trim()) args.requestKey = token.requestKey;
    if (Array.isArray(token.socialMediaUrls) && token.socialMediaUrls.length > 0) {
        args.socialMediaUrls = token.socialMediaUrls;
    }
    if (Array.isArray(token.auditUrls) && token.auditUrls.length > 0) {
        args.auditUrls = token.auditUrls;
    }
    if (Array.isArray(payload.rewards) && payload.rewards.length > 0) {
        args.rewards = payload.rewards;
    }
    if (payload.devBuy && typeof payload.devBuy === 'object') {
        args.devBuy = payload.devBuy;
    }
    if (payload.pool && typeof payload.pool === 'object') {
        args.pool = payload.pool;
    }
    if (payload.fees && typeof payload.fees === 'object') {
        args.fees = payload.fees;
    }
    if (payload.context && typeof payload.context === 'object') {
        args.context = payload.context;
    }
    return Object.keys(args).length > 0 ? args : null;
}

function isTokenDeployExecutionReceipt(result: Record<string, any>): boolean {
    if (!result || result.dryRun === true) return false;
    return Boolean(
        result.success === true
        || result.tokenAddress
        || result.token_address
        || result.txHash
        || result.transactionHash
        || result.hash
        || result.txUrl
        || result.tx_url
        || result.explorerUrl
        || result.explorer_url
    );
}

function compareMessagesChronologically(a: any, b: any): number {
    const aIndex = Number(a?.message_index || a?.messageIndex || 0);
    const bIndex = Number(b?.message_index || b?.messageIndex || 0);
    if (aIndex !== bIndex) return aIndex - bIndex;
    const aCreated = Date.parse(String(a?.created_at || a?.createdAt || 0)) || 0;
    const bCreated = Date.parse(String(b?.created_at || b?.createdAt || 0)) || 0;
    return aCreated - bCreated;
}

function extractCallTimestamp(call: any): string | null {
    const value = String(
        call?.finishedAt
        || call?.result?.finishedAt
        || call?.result?.timestamp
        || call?.result?.quotedAt
        || '',
    ).trim();
    return value || null;
}

function isReusablePreparedConfirmationCall(call: any, windowMs: number): boolean {
    if (!['success', 'cached'].includes(String(call?.status || ''))) return false;
    const capturedAt = extractCallTimestamp(call);
    if (!capturedAt) return false;
    const capturedMs = Date.parse(capturedAt);
    if (!Number.isFinite(capturedMs)) return false;
    return Date.now() - capturedMs <= windowMs;
}

function isReusableSwapPrecheckCall(call: any, windowMs: number): boolean {
    const toolName = String(call?.tool || '');
    if (!['simulate_swap', 'prepare_swap_transaction', 'get_cross_chain_quote', 'prepare_cross_chain_tx'].includes(toolName)) {
        return false;
    }
    if (toolName === 'prepare_swap_transaction' && call?.args?.execute === true) {
        return false;
    }
    if (!['success', 'cached'].includes(String(call?.status || ''))) return false;
    const result = call?.result && typeof call.result === 'object' ? call.result as Record<string, any> : {};
    if (result.expired === true || result.stale === true || result.quote?.stale === true) return false;
    const expiresAt = normalizeTimestamp(
        result.expiresAt
        || result.expires_at
        || result.quoteExpiresAt
        || result.validUntil
        || result.quote?.expires_at
        || result.quote?.expiresAt,
    );
    if (expiresAt) {
        const expiresMs = Date.parse(expiresAt);
        if (Number.isFinite(expiresMs) && expiresMs <= Date.now()) return false;
    }
    const capturedAt = extractCallTimestamp(call);
    if (!capturedAt) return false;
    const capturedMs = Date.parse(capturedAt);
    if (!Number.isFinite(capturedMs)) return false;
    return Date.now() - capturedMs <= windowMs;
}

function swapPrecheckCallMatchesConfirmation(call: any, confirmation: TradeConfirmationState): boolean {
    if (confirmation.kind !== 'swap_confirmation' || !confirmation.swap) return false;
    const swap = confirmation.swap;
    const toolName = String(call?.tool || '');
    const args = (call?.args && typeof call.args === 'object') ? call.args as Record<string, any> : {};
    if (toolName === 'get_cross_chain_quote' || toolName === 'prepare_cross_chain_tx') {
        return swap.isCrossChain === true
            && normalizeSwapField(args.fromToken) === normalizeSwapField(swap.tokenIn)
            && normalizeSwapField(args.toToken) === normalizeSwapField(swap.tokenOut)
            && normalizeSwapField(args.fromAmount) === normalizeSwapField(swap.amountIn)
            && normalizeSwapField(args.fromChain) === normalizeSwapField(swap.chainId)
            && normalizeSwapField(args.toChain) === normalizeSwapField(swap.toChain);
    }
    return swap.isCrossChain !== true
        && normalizeSwapField(args.token_in) === normalizeSwapField(swap.tokenIn)
        && normalizeSwapField(args.token_out) === normalizeSwapField(swap.tokenOut)
        && normalizeSwapField(args.amount_in) === normalizeSwapField(swap.amountIn)
        && normalizeSwapField(args.chain_id) === normalizeSwapField(swap.chainId);
}

function normalizeSwapField(value: unknown): string {
    return String(value || '').trim().toLowerCase();
}

function buildTradeQuoteState(
    toolName: string,
    args: Record<string, any>,
    result: any,
    fallbackTimestamp: string | null,
    isCrossChain: boolean,
): TradeQuoteState {
    const quoteResult = result && typeof result === 'object' ? result as Record<string, any> : {};
    const expiresAt = normalizeTimestamp(
        quoteResult.expiresAt
        || quoteResult.expires_at
        || quoteResult.quoteExpiresAt
        || quoteResult.validUntil,
    );
    const staleState = resolveQuoteStaleState(expiresAt, quoteResult);
    return {
        quote_id: normalizeString(quoteResult.quoteId || quoteResult.quote_id || quoteResult.id),
        tool_name: toolName,
        token_in: isCrossChain ? normalizeString(args.fromToken) : normalizeString(args.token_in),
        token_out: isCrossChain ? normalizeString(args.toToken) : normalizeString(args.token_out),
        amount_in: isCrossChain ? normalizeString(args.fromAmount) : normalizeString(args.amount_in),
        chain_id: isCrossChain ? normalizeNumber(args.fromChain) : normalizeNumber(args.chain_id),
        to_chain: isCrossChain ? normalizeNumber(args.toChain) : undefined,
        is_cross_chain: isCrossChain,
        expected_out: quoteResult.expected_out_human
            ?? quoteResult.expected_out
            ?? quoteResult.amountOut
            ?? quoteResult.amount_out
            ?? quoteResult.outputAmount
            ?? null,
        price_impact: quoteResult.price_impact ?? quoteResult.priceImpact ?? null,
        quoted_at: normalizeTimestamp(quoteResult.quotedAt || quoteResult.quoted_at || quoteResult.timestamp) || fallbackTimestamp,
        expires_at: expiresAt,
        stale: staleState.stale,
        stale_reason: staleState.reason,
    };
}

function resolveQuoteStaleState(expiresAt: string | null, result: Record<string, any>): { stale: boolean; reason: string | null } {
    if (result.expired === true || result.stale === true) {
        return { stale: true, reason: 'quote_marked_stale_by_tool' };
    }
    if (!expiresAt) return { stale: false, reason: null };
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs)) return { stale: false, reason: null };
    if (expiresMs <= Date.now()) return { stale: true, reason: 'quote_expired' };
    return { stale: false, reason: null };
}

function normalizeTimestamp(value: unknown): string | null {
    const text = normalizeString(value);
    if (!text) return null;
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : text;
}

function normalizeString(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
}

function normalizeNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function collectRecentUserMessages(messages: any[], limit: number) {
    return [...(messages || [])]
        .filter((msg) => msg.role === 'user')
        .sort(compareMessagesChronologically)
        .slice(-limit);
}
