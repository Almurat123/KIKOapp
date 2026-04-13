// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Rowan
// Reason: this layer arbitrates local tool execution and must distinguish
//         actual failures from confirmation checkpoints. Copy-trade wallet
//         execution also needs a last-mile guard so malformed or stale model
//         wallet args cannot outrank the user's literal wallet string.
// Goal: preserve hard policy enforcement while surfacing confirmation-required
//       order mutations as soft checkpoints instead of user-facing failures,
//       while preventing malformed copy-trade target wallets from reaching tools.
// Owns: local tool policy gating, execution handoff, and gate-result shaping.
// Does Not Own: model planning, conversation confirmation state, or UI rendering.
// Design Language:
// - confirmation-required is not an execution failure
// - gate responses must preserve confirmation payloads for the next turn
// - avoid branding pending user-confirmation checkpoints as runtime errors
// - exact user wallet literals outrank malformed model-produced copy-trade args
// Document Provenance:
// - Source: runtime observation of copytrade confirmation payloads rendering as plan errors
// - Kind: runtime observation
// - Retrieved: 2026-04-12
// - Applied To: softening confirmation-required gate results into success-shaped tool results
// - Verification: verified in unit tests and code review
// - Source: chat transcript + runtime logs + production database inspection for BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: repairing malformed copy-trade target_wallet args from exact user-provided addresses before tool execution
// - Verification: verified in unit tests and code review
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-copytrade-confirmation-soft-gate.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { toolRegistry } from '../../tooling/registry.js';
import { ensureToolRegistryInitialized } from '../../tooling/bootstrap.js';
import type { OrchestratorToolCall, OrchestratorToolResult } from './contracts.js';
import { checkToolAgainstPolicy, createPolicyError, type ControlPolicySnapshot } from './controlPolicy.js';
import { checkMutationExecutionGate } from './executionGate.js';
import { isStrictEvmAddress, isStrictSolanaAddress, isStrictWalletAddress } from '../../utils/validation.js';

export class ToolExecutionEngine {
    async execute(call: OrchestratorToolCall, toolContext: Record<string, any>): Promise<OrchestratorToolResult> {
        ensureToolRegistryInitialized();
        const sanitizedCall = this.sanitizeToolCall(call, toolContext || {});
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
                return {
                    id: sanitizedCall.id,
                    name: sanitizedCall.name,
                    arguments: sanitizedCall.arguments || {},
                    ok: true,
                    result: mutationGate.responsePayload,
                    metadata: {
                        source: 'execution_gate',
                        confirmationRequired: true,
                    },
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
            };
        }
        try {
            const result = await toolRegistry.execute(sanitizedCall.name, sanitizedCall.arguments || {}, toolContext || {});
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
                };
            }
            return {
                id: sanitizedCall.id,
                name: sanitizedCall.name,
                arguments: sanitizedCall.arguments || {},
                ok: true,
                result,
                metadata: { source: 'tool_runtime' },
            };
        } catch (error: any) {
            return {
                id: sanitizedCall.id,
                name: sanitizedCall.name,
                arguments: sanitizedCall.arguments || {},
                ok: false,
                error: error?.message || String(error),
            };
        }
    }

    private sanitizeToolCall(call: OrchestratorToolCall, toolContext: Record<string, any>): OrchestratorToolCall {
        const args = { ...(call.arguments || {}) };
        if (call.name !== 'create_copy_trade_config') {
            return { ...call, arguments: args };
        }

        const explicitWallet = this.extractSingleLiteralWallet(toolContext?.__snapshot?.lastUserMessage);
        const currentWallet = String(args.target_wallet || args.targetWallet || '').trim();
        if (explicitWallet) {
            args.target_wallet = explicitWallet;
            return { ...call, arguments: args };
        }

        if (!isStrictWalletAddress(currentWallet)) {
            const snapshotWallet = this.extractSingleSnapshotWallet(toolContext?.__snapshot);
            if (snapshotWallet) {
                args.target_wallet = snapshotWallet;
            }
        }

        return { ...call, arguments: args };
    }

    private extractSingleLiteralWallet(text: string | null | undefined): string | null {
        const source = String(text || '');
        const evmMatches = source.match(/\b0x[a-fA-F0-9]{40}\b/g) || [];
        const solanaMatches = source.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) || [];
        const wallets = [
            ...evmMatches.filter((value) => isStrictEvmAddress(value)).map((value) => value.toLowerCase()),
            ...solanaMatches.filter((value) => isStrictSolanaAddress(value)),
        ];
        return wallets.length === 1 ? wallets[0] : null;
    }

    private extractSingleSnapshotWallet(snapshot: any): string | null {
        const wallets: string[] = Array.from(
            new Set(
                (snapshot?.requestedTokenAddresses || [])
                    .map((value: any) => String(value || '').trim())
                    .filter((value: string) => isStrictWalletAddress(value))
                    .map((value: string) => value.startsWith('0x') ? value.toLowerCase() : value),
            ),
        );
        return wallets.length === 1 ? wallets[0] : null;
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
