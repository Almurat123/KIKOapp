// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Renata
// Reason: Clanker token deployment now has a dedicated mutation action class.
//         The execution gate must distinguish harmless dry-runs from real
//         `confirmDeploy=true` deploy attempts and require a confirmation token
//         for the latter.
// Goal: keep all write actions centrally gated by deterministic confirmation
//       tokens, including token deploys that are not swaps or orders.
// Owns: mutation execution confirmation checks and confirmation payload shape.
// Does Not Own: action-class routing, model prompting, or individual tool HTTP behavior.
// Design Language:
// - dry-run payload preparation is not execution
// - `deploy_clanker_token` becomes executable only when `confirmDeploy=true`
// - real token deploy attempts require phase=execute and a matching confirmation token
// - confirmation payload args bind exactly to the future execution args
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: Clanker deploy confirmation gate
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { createHash } from 'node:crypto';
import type { ChatContextSnapshot } from './contracts.js';
import {
    createPolicyError,
    isOrderMutationTool,
    isTokenDeployMutationTool,
    isTradeMutationTool,
    type ControlPolicySnapshot,
    type PolicyCheckError,
} from './controlPolicy.js';

export interface ExecutionGateContext {
    phase?: 'preflight' | 'confirm' | 'execute';
    confirmationToken?: string;
}

export interface MutationGuardResult {
    allow: boolean;
    error?: PolicyCheckError;
    responsePayload?: Record<string, any>;
}

export function computeConfirmationToken(toolName: string, args: Record<string, any>, policyDecisionId?: string): string {
    void policyDecisionId;
    const normalized = stableStringify({ toolName, args });
    return createHash('sha256').update(normalized).digest('hex').slice(0, 24);
}

export function checkMutationExecutionGate(params: {
    toolName: string;
    args: Record<string, any>;
    policy: ControlPolicySnapshot | null | undefined;
    gate: ExecutionGateContext | null | undefined;
    snapshot?: ChatContextSnapshot | null;
}): MutationGuardResult {
    const { toolName, args, policy, gate, snapshot } = params;
    if (!policy || policy.enforcementLevel !== 'hard') return { allow: true };

    const isTradeMutation = isTradeMutationTool(toolName) && isTradeExecutionAttempt(toolName, args);
    const isOrderMutation = isOrderMutationTool(toolName);
    const isTokenDeployMutation = isTokenDeployMutationTool(toolName) && isTokenDeployExecutionAttempt(args);
    if (policy.actionClass === 'READ_ONLY' && !isTokenDeployMutation) return { allow: true };
    if (!isTradeMutation && !isOrderMutation && !isTokenDeployMutation) {
        return { allow: true };
    }

    const expectedToken = computeConfirmationToken(toolName, args, policy.policyDecisionId);
    const gatePhase = gate?.phase || '';
    const gateToken = String(gate?.confirmationToken || '');

    if (isTradeMutation) {
        if (!hasTradePrecheckEvidence(snapshot, toolName, args)) {
            const error = createPolicyError(
                'PRECHECK_REQUIRED',
                `Preflight evidence is required before executing ${toolName}`,
                policy,
            );
            return {
                allow: false,
                error,
                responsePayload: {
                    error: error.message,
                    reason_code: error.code,
                    policy_decision_id: error.policyDecisionId,
                },
            };
        }
        if (gatePhase !== 'execute') {
            const error = createPolicyError(
                'CONFIRMATION_REQUIRED',
                `User confirmation is required before executing ${toolName}`,
                policy,
            );
            return {
                allow: false,
                error,
                responsePayload: {
                    error: error.message,
                    reason_code: error.code,
                    policy_decision_id: error.policyDecisionId,
                    requires_confirmation: true,
                    confirmation_payload: {
                        tool_name: toolName,
                        args,
                        confirmation_token: expectedToken,
                        action_class: policy.actionClass,
                    },
                },
            };
        }
        if (gateToken && gateToken !== expectedToken) {
            const error = createPolicyError(
                'CONFIRMATION_STALE_OR_MISMATCH',
                `Confirmation token mismatch for ${toolName}`,
                policy,
            );
            return {
                allow: false,
                error,
                responsePayload: {
                    error: error.message,
                    reason_code: error.code,
                    policy_decision_id: error.policyDecisionId,
                },
            };
        }
        return { allow: true };
    }

    // Order and token-deploy mutations use the same explicit confirmation token contract.
    if (gatePhase !== 'execute') {
        const error = createPolicyError(
            'CONFIRMATION_REQUIRED',
            `User confirmation is required before executing ${toolName}`,
            policy,
        );
        return {
            allow: false,
            error,
            responsePayload: {
                error: error.message,
                reason_code: error.code,
                policy_decision_id: error.policyDecisionId,
                requires_confirmation: true,
                confirmation_payload: {
                    tool_name: toolName,
                    args,
                    confirmation_token: expectedToken,
                    action_class: isTokenDeployMutation && policy.actionClass === 'READ_ONLY'
                        ? 'TOKEN_DEPLOY_MUTATION'
                        : policy.actionClass,
                },
            },
        };
    }
    if (!gateToken || gateToken !== expectedToken) {
        const error = createPolicyError(
            'CONFIRMATION_STALE_OR_MISMATCH',
            `Confirmation token mismatch for ${toolName}`,
            policy,
        );
        return {
            allow: false,
            error,
            responsePayload: {
                error: error.message,
                reason_code: error.code,
                policy_decision_id: error.policyDecisionId,
            },
        };
    }
    return { allow: true };
}

function isTradeExecutionAttempt(toolName: string, args: Record<string, any>): boolean {
    if (toolName === 'prepare_swap_transaction') {
        return args.execute === true;
    }
    if (toolName === 'prepare_cross_chain_tx') return true;
    return false;
}

function isTokenDeployExecutionAttempt(args: Record<string, any>): boolean {
    return args.confirmDeploy === true;
}

function hasTradePrecheckEvidence(
    snapshot: ChatContextSnapshot | null | undefined,
    toolName: string,
    args: Record<string, any>,
): boolean {
    const calls = snapshot?.recentToolTrace?.toolCalls || [];
    if (toolName === 'prepare_swap_transaction') {
        const targetIn = normalizeToken(args.token_in);
        const targetOut = normalizeToken(args.token_out);
        const targetChain = Number(args.chain_id || 0) || null;
        return calls.some((call) => {
            const callTool = String(call.tool || '');
            if (!['simulate_swap', 'prepare_swap_transaction'].includes(callTool)) return false;
            if (!['success', 'cached'].includes(String(call.status || ''))) return false;
            const callIn = normalizeToken(call.args?.token_in);
            const callOut = normalizeToken(call.args?.token_out);
            const callChain = Number(call.args?.chain_id || 0) || null;
            return callIn === targetIn && callOut === targetOut && callChain === targetChain;
        });
    }
    if (toolName === 'prepare_cross_chain_tx') {
        const targetFrom = normalizeToken(args.fromToken);
        const targetTo = normalizeToken(args.toToken);
        const targetAmount = normalizeToken(args.fromAmount);
        const targetFromChain = Number(args.fromChain || 0) || null;
        const targetToChain = Number(args.toChain || 0) || null;
        return calls.some((call) => {
            const callTool = String(call.tool || '');
            if (!['get_cross_chain_quote', 'prepare_cross_chain_tx'].includes(callTool)) return false;
            if (!['success', 'cached'].includes(String(call.status || ''))) return false;
            const callFrom = normalizeToken(call.args?.fromToken);
            const callTo = normalizeToken(call.args?.toToken);
            const callAmount = normalizeToken(call.args?.fromAmount);
            const callFromChain = Number(call.args?.fromChain || 0) || null;
            const callToChain = Number(call.args?.toChain || 0) || null;
            return callFrom === targetFrom
                && callTo === targetTo
                && callAmount === targetAmount
                && callFromChain === targetFromChain
                && callToChain === targetToChain;
        });
    }
    return true;
}

function normalizeToken(value: any): string {
    return String(value || '').trim().toLowerCase();
}

function stableStringify(value: any): string {
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}
