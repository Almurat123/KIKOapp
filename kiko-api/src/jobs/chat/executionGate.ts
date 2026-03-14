import { createHash } from 'node:crypto';
import type { ChatContextSnapshot } from './contracts.js';
import {
    createPolicyError,
    isOrderMutationTool,
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
    if (policy.actionClass === 'READ_ONLY') return { allow: true };

    const isTradeMutation = isTradeMutationTool(toolName) && isTradeExecutionAttempt(toolName, args);
    const isOrderMutation = isOrderMutationTool(toolName);
    if (!isTradeMutation && !isOrderMutation) {
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

    // Order mutation
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
            if (String(call.tool || '') !== 'simulate_swap') return false;
            if (!['success', 'cached'].includes(String(call.status || ''))) return false;
            const callIn = normalizeToken(call.args?.token_in);
            const callOut = normalizeToken(call.args?.token_out);
            const callChain = Number(call.args?.chain_id || 0) || null;
            return callIn === targetIn && callOut === targetOut && callChain === targetChain;
        });
    }
    if (toolName === 'prepare_cross_chain_tx') {
        return calls.some((call) =>
            String(call.tool || '') === 'get_cross_chain_quote'
            && ['success', 'cached'].includes(String(call.status || ''))
        );
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
