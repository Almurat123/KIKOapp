import { toolRegistry } from '../../tooling/registry.js';
import { ensureToolRegistryInitialized } from '../../tooling/bootstrap.js';
import type { OrchestratorToolCall, OrchestratorToolResult } from './contracts.js';
import { checkToolAgainstPolicy, createPolicyError, type ControlPolicySnapshot } from './controlPolicy.js';
import { checkMutationExecutionGate } from './executionGate.js';

export class ToolExecutionEngine {
    async execute(call: OrchestratorToolCall, toolContext: Record<string, any>): Promise<OrchestratorToolResult> {
        ensureToolRegistryInitialized();
        const controlPolicy = (toolContext?.__controlPolicy || null) as ControlPolicySnapshot | null;
        const policyCheck = checkToolAgainstPolicy({
            call,
            policy: controlPolicy,
            knownToolNames: new Set(toolRegistry.getAllDefinitions().map((item) => item.name)),
        });
        if (policyCheck) {
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
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
            toolName: call.name,
            args: call.arguments || {},
            policy: controlPolicy,
            gate: toolContext?.__executionGate || null,
            snapshot: toolContext?.__snapshot || null,
        });
        if (!mutationGate.allow) {
            const blockedError = mutationGate.error || createPolicyError(
                'CONFIRMATION_REQUIRED',
                `Execution gate denied ${call.name}`,
                controlPolicy,
            );
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
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

        const shortCircuitResult = this.tryResolveFromContext(call, toolContext || {});
        if (shortCircuitResult !== undefined) {
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
                ok: true,
                result: shortCircuitResult,
                metadata: { source: 'node_context' },
            };
        }
        try {
            const result = await toolRegistry.execute(call.name, call.arguments || {}, toolContext || {});
            const normalizedFailure = this.extractFailure(result);
            if (normalizedFailure) {
                return {
                    id: call.id,
                    name: call.name,
                    arguments: call.arguments || {},
                    ok: false,
                    error: normalizedFailure,
                    result,
                    metadata: { source: 'tool_runtime' },
                };
            }
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
                ok: true,
                result,
                metadata: { source: 'tool_runtime' },
            };
        } catch (error: any) {
            return {
                id: call.id,
                name: call.name,
                arguments: call.arguments || {},
                ok: false,
                error: error?.message || String(error),
            };
        }
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

        const tokens = this.normalizeBalanceEntries(toolContext.balance);
        if (tokens.length === 0) return undefined;

        return {
            address: walletAddress,
            chain: toolContext.chainName || toolContext.chain || String(chainId),
            ethBalance: toolContext.nativeBalance ? String(toolContext.nativeBalance) : undefined,
            tokens,
        };
    }

    private buildTokenInfoFromContext(args: Record<string, any>, toolContext: Record<string, any>): any | undefined {
        const snapshot = toolContext.tokenSnapshot || toolContext.tokenContext || toolContext.tokenInfo;
        if (!snapshot || typeof snapshot !== 'object') return undefined;
        const requestedAddress = String(args.address || '').toLowerCase();
        const snapshotAddress = String(snapshot.address || snapshot.contractAddress || '').toLowerCase();
        if (requestedAddress && snapshotAddress && requestedAddress !== snapshotAddress) return undefined;
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
                    balance: String(item?.balance || item?.amount || item?.formatted || item?.value || '0'),
                    decimals: Number.isFinite(item?.decimals) ? Number(item.decimals) : undefined,
                    contractAddress: item?.contractAddress || item?.contract,
                }))
                .filter((item) => item.symbol);
        }
        return Object.entries(balance).map(([symbol, raw]) => {
            if (raw && typeof raw === 'object') {
                return {
                    symbol,
                    balance: String((raw as any).balance || (raw as any).amount || (raw as any).formatted || (raw as any).value || '0'),
                    decimals: Number.isFinite((raw as any).decimals) ? Number((raw as any).decimals) : undefined,
                    contractAddress: (raw as any).contractAddress || (raw as any).contract,
                };
            }
            return { symbol, balance: String(raw) };
        });
    }
}
