// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Rowan
// Reason: this layer arbitrates local tool execution and must distinguish
//         actual failures from confirmation checkpoints. Copy-trade wallet
//         execution also needs a last-mile guard so malformed or stale model
//         wallet args cannot outrank the user's literal wallet string, and so
//         multiple latest-message wallet literals cannot be silently auto-picked.
//         It also carries wallet-binding provenance through confirmation turns
//         so the persistence owner can audit the final wallet. Product review
//         on 2026-04-18 clarified that tool results also need a stable
//         continuation contract so the worker stops guessing what to do after a
//         successful read, business result, or confirmation checkpoint. Chat v2
//         now also needs an explicit side-effect terminal path so a tool can
//         fully manage the reply without being misclassified as an empty text turn.
// Goal: preserve hard policy enforcement while surfacing confirmation-required
//       order mutations as soft checkpoints instead of user-facing failures,
//       while preventing malformed copy-trade target wallets from reaching tools
//       and allowing tool-owned reply channels to terminate the turn cleanly.
// Owns: local tool policy gating, execution handoff, and gate-result shaping.
// Does Not Own: model planning, conversation confirmation state, or UI rendering.
// Design Language:
// - confirmation-required is not an execution failure
// - gate responses must preserve confirmation payloads for the next turn
// - avoid branding pending user-confirmation checkpoints as runtime errors
// - exact user wallet literals outrank malformed model-produced copy-trade args
// - multiple latest-message wallet literals are a hard ambiguity, not a model choice
// - wallet-binding provenance follows the confirmation payload but is not a public tool argument
// - every tool result should carry a continuation contract for the next worker step
// Document Provenance:
// - Source: runtime observation of copytrade confirmation payloads rendering as plan errors
// - Kind: runtime observation
// - Retrieved: 2026-04-12
// - Applied To: softening confirmation-required gate results into success-shaped tool results
// - Verification: verified in unit tests and code review
// - Source: chat transcript + runtime logs + production database inspection for BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: repairing malformed copy-trade target_wallet args from exact user-provided addresses before tool execution and blocking ambiguous multi-wallet input
// - Verification: verified in unit tests and code review
// - Source: product owner correction in local runtime thread about unclear
//   tool-followup behavior
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: stable continuation contracts on orchestrator tool results
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: side-effect terminal continuation for tool-managed generated-image replies
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-copytrade-confirmation-soft-gate.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-deterministic-extraction.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-14-copytrade-wallet-audit-provenance.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { toolRegistry } from '../../tooling/registry.js';
import { ensureToolRegistryInitialized } from '../../tooling/bootstrap.js';
import type { OrchestratorToolCall, OrchestratorToolResult, ToolContinuationContract } from './contracts.js';
import { checkToolAgainstPolicy, createPolicyError, type ControlPolicySnapshot } from './controlPolicy.js';
import { checkMutationExecutionGate } from './executionGate.js';
import { isStrictWalletAddress } from '../../utils/validation.js';
import { extractUniqueWalletAddressesFromText } from '../../utils/walletAddressExtraction.js';
import type { CopyTradeWalletBindingAudit } from '../../services/copyTradeWalletAuditService.js';

interface PreparedToolCall {
    call: OrchestratorToolCall;
    walletBindingAudit?: CopyTradeWalletBindingAudit;
    blocked?: OrchestratorToolResult;
}

export class ToolExecutionEngine {
    async execute(call: OrchestratorToolCall, toolContext: Record<string, any>): Promise<OrchestratorToolResult> {
        ensureToolRegistryInitialized();
        const preparedCall = this.prepareToolCall(call, toolContext || {});
        if (preparedCall.blocked) {
            return preparedCall.blocked;
        }
        const sanitizedCall = preparedCall.call;
        const executionContext = preparedCall.walletBindingAudit
            ? { ...(toolContext || {}), __copyTradeWalletBindingAudit: preparedCall.walletBindingAudit }
            : (toolContext || {});
        const controlPolicy = (toolContext?.__controlPolicy || null) as ControlPolicySnapshot | null;
        const policyCheck = checkToolAgainstPolicy({
            call: sanitizedCall,
            policy: controlPolicy,
            knownToolNames: new Set(toolRegistry.getAllDefinitions().map((item) => item.name)),
        });
        if (policyCheck) {
            return {
                id: sanitizedCall.id,
                name: sanitizedCall.name,
                arguments: sanitizedCall.arguments || {},
                ok: false,
                error: policyCheck.message,
                reasonCode: policyCheck.code,
                policyDecisionId: policyCheck.policyDecisionId,
                result: {
                    error: policyCheck.message,
                    reason_code: policyCheck.code,
                    policy_decision_id: policyCheck.policyDecisionId,
                },
                metadata: { source: 'policy_guard' },
                continuation: buildToolContinuationContract({
                    toolName: sanitizedCall.name,
                    ok: false,
                    source: 'policy_guard',
                    reasonCode: policyCheck.code,
                }),
            };
        }

        const mutationGate = checkMutationExecutionGate({
            toolName: sanitizedCall.name,
            args: sanitizedCall.arguments || {},
            policy: controlPolicy,
            gate: toolContext?.__executionGate || null,
            snapshot: toolContext?.__snapshot || null,
        });
        if (!mutationGate.allow) {
            if (mutationGate.responsePayload?.requires_confirmation === true) {
                const responsePayload = this.attachWalletBindingToConfirmationPayload(
                    mutationGate.responsePayload,
                    preparedCall.walletBindingAudit,
                );
                return {
                    id: sanitizedCall.id,
                    name: sanitizedCall.name,
                    arguments: sanitizedCall.arguments || {},
                    ok: true,
                    result: responsePayload,
                    metadata: {
                        source: 'execution_gate',
                        confirmationRequired: true,
                    },
                    continuation: buildToolContinuationContract({
                        toolName: sanitizedCall.name,
                        ok: true,
                        source: 'execution_gate',
                        confirmationRequired: true,
                    }),
                };
            }
            const blockedError = mutationGate.error || createPolicyError(
                'CONFIRMATION_REQUIRED',
                `Execution gate denied ${sanitizedCall.name}`,
                controlPolicy,
            );
            return {
                id: sanitizedCall.id,
                name: sanitizedCall.name,
                arguments: sanitizedCall.arguments || {},
                ok: false,
                error: blockedError.message,
                reasonCode: blockedError.code,
                policyDecisionId: blockedError.policyDecisionId,
                result: mutationGate.responsePayload || {
                    error: blockedError.message,
                    reason_code: blockedError.code,
                    policy_decision_id: blockedError.policyDecisionId,
                },
                metadata: { source: 'execution_gate' },
                continuation: buildToolContinuationContract({
                    toolName: sanitizedCall.name,
                    ok: false,
                    source: 'execution_gate',
                    reasonCode: blockedError.code,
                }),
            };
        }

        const shortCircuitResult = this.tryResolveFromContext(sanitizedCall, toolContext || {});
        if (shortCircuitResult !== undefined) {
            return {
                id: sanitizedCall.id,
                name: sanitizedCall.name,
                arguments: sanitizedCall.arguments || {},
                ok: true,
                result: shortCircuitResult,
                metadata: { source: 'node_context' },
                continuation: buildToolContinuationContract({
                    toolName: sanitizedCall.name,
                    ok: true,
                    source: 'node_context',
                    result: shortCircuitResult,
                }),
            };
        }
        try {
            const result = await toolRegistry.execute(sanitizedCall.name, sanitizedCall.arguments || {}, executionContext);
            const normalizedFailure = this.extractFailure(result);
            if (normalizedFailure) {
                return {
                    id: sanitizedCall.id,
                    name: sanitizedCall.name,
                    arguments: sanitizedCall.arguments || {},
                    ok: false,
                    error: normalizedFailure,
                    result,
                    metadata: { source: 'tool_runtime' },
                    continuation: buildToolContinuationContract({
                        toolName: sanitizedCall.name,
                        ok: false,
                        source: 'tool_runtime',
                        result,
                    }),
                };
            }
            return {
                id: sanitizedCall.id,
                name: sanitizedCall.name,
                arguments: sanitizedCall.arguments || {},
                ok: true,
                result,
                metadata: { source: 'tool_runtime' },
                continuation: buildToolContinuationContract({
                    toolName: sanitizedCall.name,
                    ok: true,
                    source: 'tool_runtime',
                    result,
                }),
            };
        } catch (error: any) {
            return {
                id: sanitizedCall.id,
                name: sanitizedCall.name,
                arguments: sanitizedCall.arguments || {},
                ok: false,
                error: error?.message || String(error),
                continuation: buildToolContinuationContract({
                    toolName: sanitizedCall.name,
                    ok: false,
                    source: 'tool_runtime',
                }),
            };
        }
    }

    private prepareToolCall(call: OrchestratorToolCall, toolContext: Record<string, any>): PreparedToolCall {
        const args = { ...(call.arguments || {}) };
        if (call.name !== 'create_copy_trade_config') {
            return { call: { ...call, arguments: args } };
        }

        const literalWallets = extractUniqueWalletAddressesFromText(toolContext?.__snapshot?.lastUserMessage);
        const currentWallet = String(args.target_wallet || args.targetWallet || '').trim();
        if (literalWallets.length > 1) {
            return {
                call: { ...call, arguments: args },
                blocked: this.buildCopyTradeWalletBindingError(
                    call,
                    args,
                    'AMBIGUOUS_COPY_TRADE_TARGET_WALLET',
                    'Multiple wallet addresses were found in the latest message. Choose one target wallet explicitly.',
                    { wallet_candidates: literalWallets },
                ),
            };
        }
        if (literalWallets.length === 1) {
            args.target_wallet = literalWallets[0];
            return {
                call: { ...call, arguments: args },
                walletBindingAudit: this.buildCopyTradeWalletBindingAudit({
                    toolContext,
                    extractedWallets: literalWallets,
                    llmTargetWallet: currentWallet,
                    finalTargetWallet: literalWallets[0],
                    source: 'latest_user_message_literal',
                    reasonCode: currentWallet && currentWallet !== literalWallets[0] ? 'MODEL_ARG_OVERRIDDEN_BY_LITERAL' : null,
                }),
            };
        }

        if (currentWallet && isStrictWalletAddress(currentWallet)) {
            args.target_wallet = currentWallet.startsWith('0x') ? currentWallet.toLowerCase() : currentWallet;
            return {
                call: { ...call, arguments: args },
                walletBindingAudit: this.buildCopyTradeWalletBindingAudit({
                    toolContext,
                    extractedWallets: [],
                    llmTargetWallet: currentWallet,
                    finalTargetWallet: args.target_wallet,
                    source: toolContext?.__copyTradeWalletBindingAudit?.source || 'tool_argument',
                    reasonCode: null,
                }),
            };
        }

        return {
            call: { ...call, arguments: args },
            blocked: this.buildCopyTradeWalletBindingError(
                call,
                args,
                'INVALID_COPY_TRADE_TARGET_WALLET',
                'A strict wallet address is required before creating a copy-trade config.',
                {},
            ),
        };
    }

    private buildCopyTradeWalletBindingAudit(params: {
        toolContext: Record<string, any>;
        extractedWallets: string[];
        llmTargetWallet: string | null;
        finalTargetWallet: string | null;
        source: string;
        reasonCode: string | null;
    }): CopyTradeWalletBindingAudit {
        const existing = params.toolContext?.__copyTradeWalletBindingAudit || {};
        return {
            rawUserMessage: existing.rawUserMessage || params.toolContext?.__snapshot?.lastUserMessage || null,
            extractedWallets: existing.extractedWallets || params.extractedWallets,
            llmTargetWallet: existing.llmTargetWallet || params.llmTargetWallet || null,
            finalTargetWallet: params.finalTargetWallet || existing.finalTargetWallet || null,
            source: existing.source || params.source,
            reasonCode: params.reasonCode || existing.reasonCode || null,
        };
    }

    private attachWalletBindingToConfirmationPayload(
        responsePayload: Record<string, any>,
        walletBindingAudit: CopyTradeWalletBindingAudit | undefined,
    ): Record<string, any> {
        if (!walletBindingAudit) return responsePayload;
        const confirmationPayload = responsePayload.confirmation_payload;
        if (!confirmationPayload || typeof confirmationPayload !== 'object') return responsePayload;
        if (String(confirmationPayload.tool_name || '') !== 'create_copy_trade_config') return responsePayload;
        return {
            ...responsePayload,
            confirmation_payload: {
                ...confirmationPayload,
                wallet_binding: walletBindingAudit,
            },
        };
    }

    private buildCopyTradeWalletBindingError(
        call: OrchestratorToolCall,
        args: Record<string, any>,
        reasonCode: string,
        message: string,
        extraResult: Record<string, any>,
    ): OrchestratorToolResult {
        return {
            id: call.id,
            name: call.name,
            arguments: args,
            ok: false,
            error: message,
            reasonCode,
            result: {
                error: message,
                reason_code: reasonCode,
                ...extraResult,
            },
            metadata: { source: 'copytrade_wallet_binding_guard' },
            continuation: buildToolContinuationContract({
                toolName: call.name,
                ok: false,
                source: 'copytrade_wallet_binding_guard',
                reasonCode,
            }),
        };
    }

    private extractFailure(result: any): string | null {
        if (!result || typeof result !== 'object' || Array.isArray(result)) {
            return null;
        }
        const message = typeof result.error === 'string' ? result.error.trim() : '';
        return message || null;
    }

    private tryResolveFromContext(call: OrchestratorToolCall, toolContext: Record<string, any>): any | undefined {
        const prefetched = toolContext.prefetchedToolResults || {};
        if (call.name === 'get_wallet_info') {
            if (prefetched.get_wallet_info) return prefetched.get_wallet_info;
            return this.buildWalletInfoFromContext(call.arguments || {}, toolContext);
        }
        if (call.name === 'get_token_info') {
            if (prefetched.get_token_info) return prefetched.get_token_info;
            return this.buildTokenInfoFromContext(call.arguments || {}, toolContext);
        }
        if ((call.name === 'get_launchpad_stats' || call.name === 'search_launchpad') && prefetched.get_launchpad_info) {
            return prefetched.get_launchpad_info;
        }
        return undefined;
    }

    private buildWalletInfoFromContext(args: Record<string, any>, toolContext: Record<string, any>): any | undefined {
        const walletAddress = toolContext.walletAddress || toolContext.userAddress;
        const chainId = Number(toolContext.chainId || 0) || undefined;
        if (!walletAddress || !chainId) return undefined;
        if (args.address && String(args.address).toLowerCase() !== String(walletAddress).toLowerCase()) return undefined;
        if (args.chainId && Number(args.chainId) !== chainId) return undefined;

        const chainSnapshot = this.resolveCurrentChainBalanceSnapshot(toolContext, chainId);
        const tokens = chainSnapshot?.tokens || this.normalizeBalanceEntries(toolContext.balance);
        const ethBalance = chainSnapshot?.ethBalance ?? (toolContext.nativeBalance ? String(toolContext.nativeBalance) : undefined);
        if (tokens.length === 0 && ethBalance == null) return undefined;

        return {
            address: walletAddress,
            chain: toolContext.chainName || toolContext.chain || String(chainId),
            ethBalance,
            tokens,
        };
    }

    private resolveCurrentChainBalanceSnapshot(toolContext: Record<string, any>, chainId: number): { ethBalance?: string; tokens: Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> } | null {
        const tokens = this.normalizeBalanceEntries(toolContext.balance);
        const nativeBalance = toolContext.nativeBalance != null ? String(toolContext.nativeBalance) : undefined;
        if (tokens.length > 0 || nativeBalance != null) {
            return { ethBalance: nativeBalance, tokens };
        }

        const chainKey = this.resolveAllChainBalanceKey(chainId);
        const allChainBalances = toolContext.allChainBalances;
        const chainSnapshot = chainKey && allChainBalances && typeof allChainBalances === 'object'
            ? allChainBalances[chainKey]
            : null;
        if (!chainSnapshot || typeof chainSnapshot !== 'object') return null;

        const snapshotTokens = this.normalizeBalanceEntries(chainSnapshot.tokens);
        const ethBalance = chainSnapshot.ethBalanceFormatted ?? chainSnapshot.ethBalance ?? chainSnapshot.nativeBalance;
        if (snapshotTokens.length === 0 && ethBalance == null) return null;

        return {
            ethBalance: ethBalance != null ? String(ethBalance) : undefined,
            tokens: snapshotTokens,
        };
    }

    private resolveAllChainBalanceKey(chainId: number): string | null {
        const mapping: Record<number, string> = {
            1: 'eth',
            10: 'optimism',
            56: 'bsc',
            137: 'polygon',
            42161: 'arbitrum',
            8453: 'base',
            900: 'solana',
        };
        return mapping[chainId] || null;
    }

    private buildTokenInfoFromContext(args: Record<string, any>, toolContext: Record<string, any>): any | undefined {
        const snapshot = toolContext.tokenSnapshot || toolContext.tokenContext || toolContext.tokenInfo;
        if (!snapshot || typeof snapshot !== 'object') return undefined;
        const requestedAddress = String(args.address || '').toLowerCase();
        const snapshotAddress = String(snapshot.address || snapshot.contractAddress || '').toLowerCase();
        if (requestedAddress && snapshotAddress && requestedAddress !== snapshotAddress) return undefined;
        const requestedChain = String(args.chain || '').trim().toLowerCase();
        const snapshotChain = String(snapshot.chain || snapshot.chainName || toolContext.chain || toolContext.chainName || '').trim().toLowerCase();
        if (requestedChain && snapshotChain && requestedChain !== snapshotChain) return undefined;
        if (args.chainId && snapshot.chainId && Number(args.chainId) !== Number(snapshot.chainId)) return undefined;
        return {
            ...snapshot,
            chainId: snapshot.chainId || toolContext.chainId,
            chainName: snapshot.chainName || toolContext.chainName || toolContext.chain,
        };
    }

    private normalizeBalanceEntries(balance: any): Array<{ symbol: string; balance: string; decimals?: number; contractAddress?: string }> {
        if (!balance || typeof balance !== 'object') return [];
        if (Array.isArray(balance)) {
            return balance
                .map((item) => ({
                    symbol: String(item?.symbol || item?.tokenSymbol || item?.contractAddress || ''),
                    balance: String(item?.balance || item?.tokenBalance || item?.amount || item?.formatted || item?.value || '0'),
                    decimals: Number.isFinite(item?.decimals) ? Number(item.decimals) : undefined,
                    contractAddress: item?.contractAddress || item?.contract,
                }))
                .filter((item) => item.symbol);
        }
        return Object.entries(balance).map(([symbol, raw]) => {
            if (raw && typeof raw === 'object') {
                return {
                    symbol,
                    balance: String((raw as any).balance || (raw as any).tokenBalance || (raw as any).amount || (raw as any).formatted || (raw as any).value || '0'),
                    decimals: Number.isFinite((raw as any).decimals) ? Number((raw as any).decimals) : undefined,
                    contractAddress: (raw as any).contractAddress || (raw as any).contract,
                };
            }
            return { symbol, balance: String(raw) };
        });
    }
}

function buildToolContinuationContract(params: {
    toolName: string;
    ok: boolean;
    source?: string;
    result?: any;
    reasonCode?: string;
    confirmationRequired?: boolean;
}): ToolContinuationContract {
    const toolName = String(params.toolName || '').trim();
    const source = String(params.source || '').trim();
    const isContextRead = toolName.startsWith('read_');
    const resolvedState = isContextRead
        ? [toolName.replace(/^read_/, '')]
        : resolveStateHintsFromToolResult(params.result);

    if (params.confirmationRequired || params.result?.requires_confirmation === true) {
        return {
            next_action: 'ask_user_confirmation',
            can_answer_now: true,
            reason: 'This tool reached a confirmation checkpoint and needs the user to approve the prepared action.',
            resolved_state: resolvedState,
            reusable_for_next_turn: true,
        };
    }

    if (params.result?.handled_response === true) {
        return {
            next_action: 'complete_with_side_effect',
            can_answer_now: false,
            reason: 'This tool already delivered or updated the user-visible reply through a managed side-effect channel.',
            resolved_state: resolvedState,
            reusable_for_next_turn: false,
        };
    }

    if (!params.ok) {
        if (String(params.reasonCode || '').trim() === 'TOOL_BUDGET_EXCEEDED') {
            return {
                next_action: 'answer_now',
                can_answer_now: true,
                reason: 'This tool path hit the tool budget and the worker should answer from current evidence instead of looping.',
                resolved_state: resolvedState,
                reusable_for_next_turn: false,
            };
        }
        return {
            next_action: 'handle_tool_failure',
            can_answer_now: true,
            reason: `The tool did not complete successfully${source ? ` (${source})` : ''}. Explain the failure or choose a more specific next step.`,
            resolved_state: resolvedState,
            reusable_for_next_turn: false,
        };
    }

    if (isContextRead) {
        return {
            next_action: 'read_more_context',
            can_answer_now: true,
            reason: 'This context read updated worker state. Reuse it immediately and only call more tools if a specific evidence gap remains.',
            resolved_state: resolvedState,
            reusable_for_next_turn: true,
        };
    }

    return {
        next_action: 'answer_now',
        can_answer_now: true,
        reason: 'This tool returned usable evidence. Answer now unless a specific missing field requires one more tool.',
        resolved_state: resolvedState,
        reusable_for_next_turn: true,
        missing_evidence: resolveMissingEvidenceHints(params.result),
        next_tool: resolveSuggestedNextTool(params.result),
    };
}

function resolveStateHintsFromToolResult(result: any): string[] {
    if (!result || typeof result !== 'object') return [];
    const hints = new Set<string>();
    if (result.tokenSnapshot || result.prefetchedTokenInfo || result.requestedAddresses || result.requestedSymbols) {
        hints.add('token_context');
    }
    if (result.pendingAction || result.pendingConfirmation || result.polymarketSelection || result.carryForwardState) {
        hints.add('workflow_state');
    }
    if (result.context_kind === 'wallet_state' || result.wallet || result.balances) {
        hints.add('wallet_state');
    }
    return Array.from(hints);
}

function resolveMissingEvidenceHints(result: any): string[] | undefined {
    if (!result || typeof result !== 'object') return undefined;
    if (Array.isArray(result.missing_evidence)) {
        return result.missing_evidence.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0);
    }
    if (result.followUpCapabilities?.batchWalletPnlFollowup === 'requires_separate_batch_query') {
        return ['wallet_pnl_ranking'];
    }
    if (result.followUpCapabilities?.directProfitRanking && result.followUpCapabilities.directProfitRanking !== 'ready_from_current_rows') {
        return ['profit_ranking'];
    }
    return undefined;
}

function resolveSuggestedNextTool(result: any): string | null {
    if (!result || typeof result !== 'object') return null;
    if (typeof result.next_tool === 'string' && result.next_tool.trim().length > 0) {
        return result.next_tool.trim();
    }
    if (result.followUpCapabilities?.batchWalletPnlFollowup === 'requires_separate_batch_query') {
        return 'analyze_wallet_pnl_batch';
    }
    return null;
}
