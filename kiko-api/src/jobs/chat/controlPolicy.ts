// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Renata
// Reason: Clanker launches are real write actions. The previous policy only
//         modeled swap and order mutations, so `deploy_clanker_token` could be
//         exposed as a normal skill tool without a central mutation class.
//         Product architecture review on 2026-04-19 temporarily moved tool
//         visibility to the main model by default, but runtime regressions on
//         2026-04-20 showed hard-policy allowlists must stay aligned with the
//         resolver-scoped tool package rather than the full registry.
//         This layer therefore treats semantic task choice and execution
//         authorization as separate concerns while preserving resolver-scoped
//         tool visibility inside the policy snapshot.
// Goal: classify confirmed token deployment as a hard-gated mutation while
//       still allowing Clanker dry-run previews and read/history tools inside
//       the Clanker skill.
// Owns: chat action-class classification, mutation tool allowlists, and
//       policy-time cross-class blocking.
// Does Not Own: individual tool payload shaping, user wallet signing, or model
//               prompt wording.
// Design Language:
// - mutation classes are runtime policy, not prompt-only advice
// - Clanker dry-runs may prepare payloads, but real deploy attempts belong to TOKEN_DEPLOY_MUTATION
// - swap, order/copytrade, and token deploy mutation tools must not be mixed across classes
// - provider-native search stays blocked for hard mutation turns
// - tool visibility is not execution permission; mutation tools remain blocked
//   in READ_ONLY even when the control policy allowlist includes them
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: Clanker deploy mutation classification and allowlist
// - Verification: verified in code and targeted tests
// - Source: operator architecture review on 2026-04-19
// - Kind: product instruction
// - Retrieved: 2026-04-19
// - Applied To: separating semantic task choice from mutation execution gates
// - Verification: verified in code and later narrowed for tool allowlists
// - Source: local live execution evals plus product-owner correction on 2026-04-21
// - Kind: runtime observation / product instruction
// - Retrieved: 2026-04-21
// - Applied To: keeping hard-policy allowedTools scoped to resolver packages instead of the full registry
// - Verification: verified in runtime and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
import { randomUUID } from 'node:crypto';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot, OrchestratorToolCall } from './contracts.js';
import type { SkillResolution } from './nodeSkillResolver.js';
import { isTaskRouteExecutionPhase } from './taskRoute.js';
import type { TradingIntent } from './tradingIntentResolver.js';
export type ActionClass = 'READ_ONLY' | 'TRADE_MUTATION' | 'ORDER_MUTATION' | 'TOKEN_DEPLOY_MUTATION';
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
    'x_user_search',
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

const TOKEN_DEPLOY_MUTATION_TOOLS = [
    'deploy_clanker_token',
];

const POLICY_COUNTERS = new Map<string, number>();

export function buildControlPolicySnapshot(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
    skillResolution: SkillResolution;
}): ControlPolicySnapshot {
    const resolvedActionClass = resolveActionClass(params.snapshot, params.tradingIntent);
    const actionClass = resolvedActionClass === 'READ_ONLY' && isTokenDeploySkillResolution(params.skillResolution)
        ? 'TOKEN_DEPLOY_MUTATION'
        : resolvedActionClass;
    const mutationToolAllowlist =
        actionClass === 'TRADE_MUTATION'
            ? TRADE_MUTATION_TOOLS
            : actionClass === 'ORDER_MUTATION'
                ? ORDER_MUTATION_TOOLS
                : actionClass === 'TOKEN_DEPLOY_MUTATION'
                    ? TOKEN_DEPLOY_MUTATION_TOOLS
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
    const taskRoute = snapshot.taskRoute || null;
    const canonicalIntent = snapshot.normalizedIntent || null;
    const confirmationKind = String(snapshot.confirmationState?.kind || '');
    const actionState = snapshot.conversationActionState || null;
    if (confirmationKind === 'order_confirmation') {
        const confirmationActionClass = snapshot.confirmationState?.order?.actionClass;
        return normalizeActionClass(confirmationActionClass, 'ORDER_MUTATION');
    }
    if (actionState?.pendingAction === 'order' || actionState?.pendingAction === 'copy_trade') {
        return 'ORDER_MUTATION';
    }
    if (actionState?.pendingAction === 'swap') {
        return 'TRADE_MUTATION';
    }
    if (taskRoute && isTaskRouteExecutionPhase(taskRoute)) {
        if (taskRoute.owner === 'token_deploy') {
            return 'TOKEN_DEPLOY_MUTATION';
        }
        if (taskRoute.owner === 'swap') {
            return 'TRADE_MUTATION';
        }
        if (taskRoute.owner === 'copy_trade' || taskRoute.owner === 'polymarket') {
            return 'ORDER_MUTATION';
        }
    }
    if (canonicalIntent?.taskMode === 'confirm' || canonicalIntent?.taskMode === 'execute') {
        if (canonicalIntent.intent === 'clanker_deploy') {
            return 'TOKEN_DEPLOY_MUTATION';
        }
        if (canonicalIntent.intent === 'swap' || canonicalIntent.intent === 'cross_chain_swap') {
            return 'TRADE_MUTATION';
        }
        if (canonicalIntent.intent === 'copy_trade' || canonicalIntent.domain === 'polymarket') {
            return 'ORDER_MUTATION';
        }
    }
    if (tradingIntent?.type === 'swap' || tradingIntent?.type === 'cross_chain_trade') {
        return 'TRADE_MUTATION';
    }
    if (tradingIntent?.type === 'copy_trade') {
        return 'ORDER_MUTATION';
    }
    return 'READ_ONLY';
}

export function isTradeMutationTool(toolName: string): boolean {
    return TRADE_MUTATION_TOOLS.includes(String(toolName || ''));
}

export function isOrderMutationTool(toolName: string): boolean {
    return ORDER_MUTATION_TOOLS.includes(String(toolName || ''));
}

export function isTokenDeployMutationTool(toolName: string): boolean {
    return TOKEN_DEPLOY_MUTATION_TOOLS.includes(String(toolName || ''));
}

export function isMutationTool(toolName: string): boolean {
    return isTradeMutationTool(toolName) || isOrderMutationTool(toolName) || isTokenDeployMutationTool(toolName);
}

export function isProviderNativeTool(toolName: string, policy: ControlPolicySnapshot | null | undefined): boolean {
    const native = policy?.providerNativeTools || PROVIDER_NATIVE_TOOLS;
    return matchesProviderNativeToolName(toolName, native);
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
    if (policy.actionClass === 'TRADE_MUTATION' && (isOrderMutationTool(toolName) || isTokenDeployMutationTool(toolName))) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Non-trade mutation tool "${toolName}" is blocked in TRADE_MUTATION action class`,
            policy,
        );
    }
    if (policy.actionClass === 'ORDER_MUTATION' && (isTradeMutationTool(toolName) || isTokenDeployMutationTool(toolName))) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Non-order mutation tool "${toolName}" is blocked in ORDER_MUTATION action class`,
            policy,
        );
    }
    if (policy.actionClass === 'TOKEN_DEPLOY_MUTATION' && (isTradeMutationTool(toolName) || isOrderMutationTool(toolName))) {
        return createPolicyError(
            'POLICY_UNAUTHORIZED_TOOL',
            `Non-token-deploy mutation tool "${toolName}" is blocked in TOKEN_DEPLOY_MUTATION action class`,
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

function isTokenDeploySkillResolution(skillResolution: SkillResolution): boolean {
    return skillResolution.intentEnvelope.primary_intent === 'token_deploy'
        && skillResolution.intentEnvelope.execution_risk === 'mutation';
}

function normalizeActionClass(value: unknown, fallback: ActionClass): ActionClass {
    const actionClass = String(value || '').trim() as ActionClass;
    if (actionClass === 'TRADE_MUTATION' || actionClass === 'ORDER_MUTATION' || actionClass === 'TOKEN_DEPLOY_MUTATION' || actionClass === 'READ_ONLY') {
        return actionClass;
    }
    return fallback;
}

function matchesProviderNativeToolName(toolName: string, nativeTools: string[]): boolean {
    const normalized = String(toolName || '').trim();
    if (!normalized) return false;
    if (nativeTools.includes(normalized)) return true;
    if (normalized === 'browse_page' || normalized === 'open_page' || normalized === 'code_execution' || normalized === 'collections_search' || normalized === 'mcp') {
        return true;
    }
    if (normalized.startsWith('x_') && (normalized.endsWith('_search') || normalized.endsWith('_fetch'))) {
        return true;
    }
    if (normalized.startsWith('web_') && normalized.endsWith('_search')) {
        return true;
    }
    return false;
}
