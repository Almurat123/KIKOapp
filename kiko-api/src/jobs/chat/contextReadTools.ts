// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: chat v2 needs explicit read-only context tools so the model can pull
//         stable runtime context on demand instead of relying only on prompt
//         pre-injection.
//         Product review on 2026-04-18 clarified that the worker also needs a
//         carry-forward view of already-confirmed session state so multi-turn
//         tasks do not restart from scratch after each user reply.
//         Follow-up prompt review clarified that tool accuracy depends on
//         precise "when to use" descriptions for each read-context tool.
//         OpenAI-aligned live evaluation of image prompt coaching then showed
//         the model could skip `read_skill_prompts` unless its description made
//         image prompt playbooks an explicit use case.
// Goal: expose task-scoped session context as deterministic local tools while
//       keeping mutation routing and business tools separate.
// Owns: chat-only read-context tool definitions and context-block-to-tool mapping.
// Does Not Own: skill routing, prompt assembly, or execution gating.
// Design Language:
// - context reads are local runtime tools, not hidden prompt lore
// - context tools are read-only and must never mutate task state
// - returned payloads should stay structured and compact
// - plan/skill/evidence reads should expose runtime structure, not replay full user-facing prose
// - user settings should be returned as one normalized contract, not mixed prose plus raw flags
// - session and wallet context should use worker-facing snake_case contracts instead of raw runtime objects
// - workflow reads should expose carry-forward task state, not only raw pending-action flags
// - workflow reads should return one durable worker_state object that prompt and runtime can share
// - tool descriptions should encode trigger conditions, not generic capability labels
// - read_skill_prompts must explicitly mention image prompt coaching when that skill is present
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: explicit chat v2 context-read tool layer
// - Verification: inferred from code and plan
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: adding read-only tools for execution plan, skill prompts, and provider-native evidence
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-user-settings-contract.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: normalized read_user_settings payload shape
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: normalized read_user_context and read_wallet_state payloads
// - Verification: verified in code and targeted tests
// - Source: product owner correction in local runtime thread about missing
//   context continuity across turns
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: carry-forward task state in read_workflow_state
// - Verification: verified in code
// - Source: product-owner runtime review of KiKo chat architecture
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: durable worker_state object in read_workflow_state
// - Verification: verified in code and targeted tests
// - Source: product-owner runtime review of prompt/skill clarity and tool accuracy
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: trigger-focused context-read tool descriptions
// - Verification: verified in code and targeted tests
// - Source: local OpenAI-aligned live eval of image prompt coaching turns
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: expanding read_skill_prompts trigger wording to cover image prompt guidance
// - Verification: verified in runtime and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/design-language/image-prompt-guidance.md
// - /Users/almurat/KiKo/system-journal/owner-map/image-prompt-skills.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-openai-alignment-eval.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-user-settings-contract.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-work-protocol-refactor.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import type { Tool, ToolContext } from '../../tooling/registry.js';
import type { ChatContextBlockName, ChatContextSnapshot } from './contracts.js';
import { buildUserSettingsContract } from './userSettingsContract.js';
import { buildSessionContextContract, buildWalletStateContract } from './workerContextContracts.js';
import { buildWorkerConversationState } from './workerStateBuilder.js';

export const CONTEXT_READ_TOOL_BY_BLOCK: Partial<Record<ChatContextBlockName, string>> = {
    user_settings: 'read_user_settings',
    user_context: 'read_user_context',
    workflow_state: 'read_workflow_state',
    wallet_state: 'read_wallet_state',
    token_context: 'read_token_context',
    launchpad_context: 'read_launchpad_context',
    social_thread_context: 'read_social_thread_context',
    social_images: 'read_social_images',
    provider_native_evidence: 'read_provider_native_evidence',
    execution_plan: 'read_execution_plan',
    skill_prompts: 'read_skill_prompts',
};

function getSnapshot(context?: ToolContext): ChatContextSnapshot | null {
    const snapshot = context?.__snapshot;
    return snapshot && typeof snapshot === 'object' ? snapshot as ChatContextSnapshot : null;
}

function pickRuntime(context?: ToolContext) {
    return getSnapshot(context)?.runtime || {};
}

function pickToolContext(context?: ToolContext) {
    return (context && typeof context === 'object' ? context : {}) as Record<string, any>;
}

function pickChatRuntime(context?: ToolContext) {
    const toolContext = pickToolContext(context);
    const runtime = toolContext.__chatContextRuntime;
    return runtime && typeof runtime === 'object' ? runtime as Record<string, any> : {};
}

function normalizeRecentToolCalls(snapshot: ChatContextSnapshot | null): Array<Record<string, any>> {
    const calls = Array.isArray(snapshot?.recentToolTrace?.toolCalls) ? snapshot!.recentToolTrace!.toolCalls : [];
    return calls.slice(-6).map((call) => ({
        tool: String(call?.tool || ''),
        status: call?.status || null,
        args: call?.args || null,
    }));
}

function stripEmptyEntries<T extends Record<string, any>>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
}

function buildMissingContextResult(toolName: string) {
    return {
        available: false,
        error: `No chat snapshot is available for ${toolName} in this execution context.`,
    };
}

function buildUserSettingsResult(context?: ToolContext) {
    const runtime = pickRuntime(context);
    return {
        available: true,
        settings: buildUserSettingsContract(runtime.userSettings || {}),
    };
}

function buildUserContextResult(context?: ToolContext) {
    const snapshot = getSnapshot(context);
    if (!snapshot) return buildMissingContextResult('read_user_context');
    return {
        available: true,
        context: buildSessionContextContract(snapshot),
    };
}

function buildWorkflowStateResult(context?: ToolContext) {
    const snapshot = getSnapshot(context);
    if (!snapshot) return buildMissingContextResult('read_workflow_state');
    const workerState = buildWorkerConversationState(snapshot);
    const actionState = snapshot.conversationActionState || null;
    const preparedSelection = snapshot.polymarketSelection?.preparedSelection || null;
    return stripEmptyEntries({
        available: true,
        workerState,
        taskRoute: snapshot.taskRoute
            ? {
                owner: snapshot.taskRoute.owner,
                phase: snapshot.taskRoute.phase,
                facets: snapshot.taskRoute.facets,
            }
            : null,
        carryForwardRule: workerState.carry_forward_rule,
        pendingAction: actionState?.pendingAction || 'none',
        canExecute: actionState?.canExecute ?? false,
        needsClarification: actionState?.needsClarification ?? false,
        clarificationQuestion: actionState?.clarificationQuestion || null,
        pendingConfirmation: snapshot.confirmationState?.kind || null,
        timeContext: snapshot.taskRoute?.timeContext || snapshot.normalizedIntent?.timeContext || null,
        recentTools: normalizeRecentToolCalls(snapshot),
        carryForwardState: stripEmptyEntries({
            token_symbols: Array.isArray(snapshot.requestedTokenSymbols) ? snapshot.requestedTokenSymbols.slice(0, 6) : undefined,
            token_addresses: Array.isArray(snapshot.requestedTokenAddresses) ? snapshot.requestedTokenAddresses.slice(0, 4) : undefined,
            prepared_polymarket_selection: preparedSelection
                ? stripEmptyEntries({
                    question: preparedSelection.question,
                    outcome: preparedSelection.outcome,
                    token_id: preparedSelection.tokenId,
                    amount_usd: preparedSelection.amountUsd,
                    market_slug: preparedSelection.marketSlug,
                })
                : undefined,
        }),
        polymarketSelection: snapshot.polymarketSelection || null,
    });
}

function buildWalletStateResult(context?: ToolContext) {
    const snapshot = getSnapshot(context);
    if (!snapshot) return buildMissingContextResult('read_wallet_state');
    const runtime = snapshot.runtime || {};
    const toolContext = pickToolContext(context);
    const prefetchedWallet = toolContext.prefetchedToolResults?.get_wallet_info || runtime.prefetchedToolResults?.get_wallet_info || null;
    return {
        available: true,
        context: buildWalletStateContract(snapshot, prefetchedWallet),
    };
}

function buildTokenContextResult(context?: ToolContext) {
    const snapshot = getSnapshot(context);
    if (!snapshot) return buildMissingContextResult('read_token_context');
    const runtime = snapshot.runtime || {};
    const toolContext = pickToolContext(context);
    const prefetchedToken = toolContext.prefetchedToolResults?.get_token_info || runtime.prefetchedToolResults?.get_token_info || null;
    return stripEmptyEntries({
        available: true,
        tokenSnapshot: runtime.tokenSnapshot || null,
        prefetchedTokenInfo: prefetchedToken,
        requestedAddresses: snapshot.requestedTokenAddresses || [],
        requestedAddressClassifications: snapshot.requestedAddressClassifications || [],
        requestedSymbols: snapshot.requestedTokenSymbols || [],
    });
}

function buildLaunchpadContextResult(context?: ToolContext) {
    const snapshot = getSnapshot(context);
    if (!snapshot) return buildMissingContextResult('read_launchpad_context');
    const runtime = snapshot.runtime || {};
    return stripEmptyEntries({
        available: true,
        launchpad: runtime.launchpad || null,
        tokenSnapshot: runtime.tokenSnapshot || null,
        requestedAddresses: snapshot.requestedTokenAddresses || [],
    });
}

function buildSocialThreadContextResult(context?: ToolContext) {
    const runtime = pickRuntime(context);
    const socialInput = runtime.socialInput || {};
    return {
        available: true,
        threadContextText: socialInput.threadContextText || null,
        sourcePage: runtime.currentPage || null,
    };
}

function buildSocialImagesResult(context?: ToolContext) {
    const runtime = pickRuntime(context);
    const socialInput = runtime.socialInput || {};
    const images = Array.isArray(socialInput.images) ? socialInput.images : [];
    return {
        available: true,
        images: images.map((image: any, index: number) => ({
            label: String(image?.sourceLabel || `image ${index + 1}`).trim(),
            url: String(image?.url || '').trim() || null,
        })),
    };
}

function buildProviderNativeEvidenceResult(context?: ToolContext) {
    const chatRuntime = pickChatRuntime(context);
    const snapshots = Array.isArray(chatRuntime.providerNativeEvidence) ? chatRuntime.providerNativeEvidence : [];
    return {
        available: snapshots.length > 0,
        evidence: snapshots.map((snapshot: any) => ({
            round: snapshot?.round ?? null,
            querySummary: snapshot?.querySummary || null,
            sourceTypes: Array.isArray(snapshot?.sourceTypes) ? snapshot.sourceTypes : [],
            retrievedAt: snapshot?.retrievedAt || null,
            results: Array.isArray(snapshot?.results)
                ? snapshot.results.slice(0, 6).map((result: any) => ({
                    sourceType: result?.sourceType || null,
                    title: result?.title || null,
                    url: result?.url || null,
                    snippet: result?.snippet || null,
                }))
                : [],
        })),
    };
}

function buildExecutionPlanResult(context?: ToolContext) {
    const chatRuntime = pickChatRuntime(context);
    const plan = chatRuntime.executionPlan;
    if (!plan || typeof plan !== 'object') {
        return {
            available: false,
            plan: null,
        };
    }
    return {
        available: true,
        plan: {
            planId: plan.planId || null,
            status: plan.status || null,
            steps: Array.isArray(plan.steps)
                ? plan.steps.map((step: any) => ({
                    id: step?.id || null,
                    status: step?.status || null,
                    preferredTools: Array.isArray(step?.preferredTools) ? step.preferredTools : [],
                }))
                : [],
        },
    };
}

function buildSkillPromptsResult(context?: ToolContext) {
    const chatRuntime = pickChatRuntime(context);
    const prompts = Array.isArray(chatRuntime.skillPrompts)
        ? chatRuntime.skillPrompts.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
    return {
        available: prompts.length > 0,
        prompts,
    };
}

function buildDefinition(name: string, description: string) {
    return {
        name,
        description,
        parameters: {
            type: 'object' as const,
            properties: {},
        },
    };
}

export const ReadUserSettingsTool: Tool = {
    definition: buildDefinition(
        'read_user_settings',
        'Use when execution preferences matter: quote-before-swap behavior, swap defaults, safety flags, fast/direct mode, or copy-trade preferences. Returns a normalized settings contract.',
    ),
    handler: async (_args, context) => buildUserSettingsResult(context),
};

export const ReadUserContextTool: Tool = {
    definition: buildDefinition(
        'read_user_context',
        'Use when the answer depends on session identity or chain scope: connected wallet, requested/effective chain, current surface, or requested token/address entities.',
    ),
    handler: async (_args, context) => buildUserContextResult(context),
};

export const ReadWorkflowStateTool: Tool = {
    definition: buildDefinition(
        'read_workflow_state',
        'Use for multi-turn continuity, short follow-ups, confirmations, selected markets/tokens, pending quotes/orders, recent tools, or the next worker action. Returns durable task/execution/evidence state.',
    ),
    handler: async (_args, context) => buildWorkflowStateResult(context),
};

export const ReadWalletStateTool: Tool = {
    definition: buildDefinition(
        'read_wallet_state',
        'Use before claiming balances, holdings, portfolio/PnL prerequisites, active-chain funds, or trade affordability. Returns compact wallet and balance state.',
    ),
    handler: async (_args, context) => buildWalletStateResult(context),
};

export const ReadTokenContextTool: Tool = {
    definition: buildDefinition(
        'read_token_context',
        'Use before claiming token identity, contract facts, symbol/address resolution, token snapshot data, holder/creator/risk context, or token launch facts.',
    ),
    handler: async (_args, context) => buildTokenContextResult(context),
};

export const ReadLaunchpadContextTool: Tool = {
    definition: buildDefinition(
        'read_launchpad_context',
        'Use for token deploy/launchpad/Clanker/Four.meme/fair-launch tasks. Returns cached launch metadata and token snapshot context.',
    ),
    handler: async (_args, context) => buildLaunchpadContextResult(context),
};

export const ReadSocialThreadContextTool: Tool = {
    definition: buildDefinition(
        'read_social_thread_context',
        'Use for X/Farcaster thread-aware replies when surrounding posts change the meaning or answer. Returns current social-thread text context.',
    ),
    handler: async (_args, context) => buildSocialThreadContextResult(context),
};

export const ReadSocialImagesTool: Tool = {
    definition: buildDefinition(
        'read_social_images',
        'Use when uploaded/inbound images affect the answer and image metadata or URLs are not already visible in the current multimodal message.',
    ),
    handler: async (_args, context) => buildSocialImagesResult(context),
};

export const ReadProviderNativeEvidenceTool: Tool = {
    definition: buildDefinition(
        'read_provider_native_evidence',
        'Use after provider-native search has run and the answer needs citations, query summaries, or realtime evidence already gathered in this turn.',
    ),
    handler: async (_args, context) => buildProviderNativeEvidenceResult(context),
};

export const ReadExecutionPlanTool: Tool = {
    definition: buildDefinition(
        'read_execution_plan',
        'Use only for meta-debug or runtime-progress reasoning. Returns compact internal plan state; do not quote plan labels as answer content.',
    ),
    handler: async (_args, context) => buildExecutionPlanResult(context),
};

export const ReadSkillPromptsTool: Tool = {
    definition: buildDefinition(
        'read_skill_prompts',
        'Use after selecting a specialist task mode when domain workflow rules are needed, including image prompt coaching/edit-preserve guidance, token analysis, wallet PnL, Polymarket, or meta-debug.',
    ),
    handler: async (_args, context) => buildSkillPromptsResult(context),
};

export const CHAT_CONTEXT_READ_TOOLS: Tool[] = [
    ReadUserSettingsTool,
    ReadUserContextTool,
    ReadWorkflowStateTool,
    ReadWalletStateTool,
    ReadTokenContextTool,
    ReadLaunchpadContextTool,
    ReadSocialThreadContextTool,
    ReadSocialImagesTool,
    ReadProviderNativeEvidenceTool,
    ReadExecutionPlanTool,
    ReadSkillPromptsTool,
];
