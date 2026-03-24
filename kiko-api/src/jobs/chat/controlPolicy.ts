import { randomUUID } from 'node:crypto';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot, OrchestratorToolCall } from './contracts.js';
import type { SkillResolution } from './nodeSkillResolver.js';
import type { TradingIntent } from './tradingIntentResolver.js';

export type ActionClass = 'READ_ONLY' | 'TRADE_MUTATION' | 'ORDER_MUTATION';
export type EnforcementLevel = 'hard' | 'soft';

export type PolicyReasonCode =
    | 'POLICY_UNAUTHORIZED_TOOL'
    | 'POLICY_CONTROL_PLANE_VIOLATION'
    | 'PRECHECK_REQUIRED'
    | 'CONFIRMATION_REQUIRED'
    | 'CONFIRMATION_STALE_OR_MISMATCH'
    | 'TOOL_BUDGET_EXCEEDED';

export interface ControlPolicySnapshot {
    policyVersion: string;
    policyDecisionId: string;
    actionClass: ActionClass;
    controlPlane: 'node';
    mutationAllowed: boolean;
    enforcementLevel: EnforcementLevel;
    allowedTools: string[];
    mutationToolAllowlist: string[];
    providerNativeTools: string[];
    toolBudgets: Record<string, number>;
}

export interface PolicyCheckError {
    code: PolicyReasonCode;
    message: string;
    policyDecisionId: string;
}

const POLICY_VERSION = '2026-03-15-hardened-v1';
const PROVIDER_NATIVE_TOOLS = [
    'web_search',
    'x_search',
    'web_search_with_snippets',
    'x_keyword_search',
    'x_semantic_search',
    'x_thread_fetch',
    'browse_page',
    'open_page',
    'code_execution',
    'collections_search',
    'mcp',
];

const TRADE_MUTATION_TOOLS = [
    'prepare_swap_transaction',
    'prepare_cross_chain_tx',
];

const ORDER_MUTATION_TOOLS = [
    'place_polymarket_order',
    'cancel_polymarket_order',
    'modify_polymarket_order',
    'withdraw_polymarket_position',
    'create_copy_trade_config',
    'delete_copy_trade_config',
    'pause_copy_trade_config',
    'create_polymarket_copy_config',
    'update_polymarket_copy_config',
    'delete_polymarket_copy_config',
];

const POLICY_COUNTERS = new Map<string, number>();

export function buildControlPolicySnapshot(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
    skillResolution: SkillResolution;
}): ControlPolicySnapshot {
    const actionClass = resolveActionClass(params.snapshot, params.tradingIntent);
    const mutationToolAllowlist =
        actionClass === 'TRADE_MUTATION'
            ? TRADE_MUTATION_TOOLS
            : actionClass === 'ORDER_MUTATION'
                ? ORDER_MUTATION_TOOLS
                : [];
    const allowedSet = new Set(params.skillResolution.allowedTools || []);
    for (const toolName of mutationToolAllowlist) {
        allowedSet.add(toolName);
    }
    return {
        policyVersion: POLICY_VERSION,
        policyDecisionId: randomUUID(),
        actionClass,
        controlPlane: 'node',
        mutationAllowed: actionClass !== 'READ_ONLY',
        enforcementLevel: 'hard',
        allowedTools: Array.from(allowedSet),
        mutationToolAllowlist: [...mutationToolAllowlist],
        providerNativeTools: [...PROVIDER_NATIVE_TOOLS],
        toolBudgets: {
            default: 4,
            external_web_search: 3,
            search_farcaster_casts: 2,
            get_trending_casts: 2,
            get_wallet_info: 2,
            get_token_info: 2,
        },
    };
}

export function resolveActionClass(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null): ActionClass {
    const query = String(snapshot.lastUserMessage || '').toLowerCase();
    const confirmationKind = String(snapshot.confirmationState?.kind || '');
    if (confirmationKind === 'order_confirmation') {
        const confirmationActionClass = snapshot.confirmationState?.order?.actionClass;
        return confirmationActionClass === 'TRADE_MUTATION' ? 'TRADE_MUTATION' : 'ORDER_MUTATION';
    }
    if (isOrderMutationQuery(query)) return 'ORDER_MUTATION';
    if (tradingIntent?.type === 'swap' || tradingIntent?.type === 'cross_chain_trade') {
        return 'TRADE_MUTATION';
    }
    if (tradingIntent?.type === 'copy_trade') {
        return 'ORDER_MUTATION';
    }
    return 'READ_ONLY';
}

function isOrderMutationQuery(query: string): boolean {
    return /\b(place|submit|create|cancel|close|withdraw|modify|edit|replace|change|pause|resume|stop)\b/.test(query)
        && (/\border\b/.test(query) || /\bpolymarket\b/.test(query))
        || /撤单|下单|平仓|取消订单|改单|改价|暂停跟单|恢复跟单|停止跟单/.test(query);
}

export function isTradeMutationTool(toolName: string): boolean {
    return TRADE_MUTATION_TOOLS.includes(String(toolName || ''));
}

export function isOrderMutationTool(toolName: string): boolean {
    return ORDER_MUTATION_TOOLS.includes(String(toolName || ''));
}

export function isMutationTool(toolName: string): boolean {
    return isTradeMutationTool(toolName) || isOrderMutationTool(toolName);
}

export function isProviderNativeTool(toolName: string, policy: ControlPolicySnapshot | null | undefined): boolean {
    const native = policy?.providerNativeTools || PROVIDER_NATIVE_TOOLS;
    return native.includes(String(toolName || ''));
}

export function resolvePolicyToolBudget(policy: ControlPolicySnapshot | null | undefined, toolName: string): number {
    const budgets = policy?.toolBudgets || {};
    return Number(budgets[toolName] ?? budgets.default ?? 4);
}

export function createPolicyError(
    code: PolicyReasonCode,
    message: string,
    policy: ControlPolicySnapshot | null | undefined,
): PolicyCheckError {
    incrementPolicyCounterForCode(code);
    const policyDecisionId = policy?.policyDecisionId || 'policy-unset';
    logger.warn(LogCode.AI_ORCHESTRATOR, 'Control policy blocked action', {
        code,
        message,
        policyDecisionId,
        actionClass: policy?.actionClass,
        controlPlane: policy?.controlPlane,
        policyVersion: policy?.policyVersion,
    });
    return {
        code,
        message,
        policyDecisionId,
    };
}

export function checkToolAgainstPolicy(params: {
    call: OrchestratorToolCall;
    policy: ControlPolicySnapshot | null | undefined;
    knownToolNames: Set<string>;
}): PolicyCheckError | null {
    const { call, policy, knownToolNames } = params;
    if (!policy) return null;
    const toolName = String(call.name || '').trim();
    if (!toolName) {
        return createPolicyError('POLICY_UNAUTHORIZED_TOOL', 'Tool name is empty', policy);
    }
    if (isProviderNativeTool(toolName, policy)) {
        if (policy.actionClass !== 'READ_ONLY') {
            return createPolicyError(
                'POLICY_CONTROL_PLANE_VIOLATION',
                `Provider-native tool "${toolName}" is blocked for mutation action class`,
                policy,
            );
        }
        return null;
    }
    if (!knownToolNames.has(toolName)) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Unknown tool "${toolName}" is not registered`,
            policy,
        );
    }
    if (!policy.allowedTools.includes(toolName)) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Tool "${toolName}" is not allowed for this intent`,
            policy,
        );
    }
    if (policy.actionClass === 'READ_ONLY' && isMutationTool(toolName)) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Mutation tool "${toolName}" is blocked in READ_ONLY action class`,
            policy,
        );
    }
    if (policy.actionClass === 'TRADE_MUTATION' && isOrderMutationTool(toolName)) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Order mutation tool "${toolName}" is blocked in TRADE_MUTATION action class`,
            policy,
        );
    }
    if (policy.actionClass === 'ORDER_MUTATION' && isTradeMutationTool(toolName)) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Trade mutation tool "${toolName}" is blocked in ORDER_MUTATION action class`,
            policy,
        );
    }
    return null;
}

export function getPolicyCountersSnapshot(): Record<string, number> {
    return Object.fromEntries(POLICY_COUNTERS.entries());
}

function incrementPolicyCounterForCode(code: PolicyReasonCode) {
    incrementCounter('policy_block_count');
    if (code === 'POLICY_UNAUTHORIZED_TOOL') incrementCounter('unauthorized_tool_attempt_count');
    if (code === 'POLICY_CONTROL_PLANE_VIOLATION') incrementCounter('cross_plane_violation_count');
    if (code === 'CONFIRMATION_STALE_OR_MISMATCH') incrementCounter('confirmation_mismatch_count');
    if (code === 'TOOL_BUDGET_EXCEEDED') incrementCounter('duplicate_tool_block_count');
}

function incrementCounter(key: string) {
    POLICY_COUNTERS.set(key, (POLICY_COUNTERS.get(key) || 0) + 1);
}
