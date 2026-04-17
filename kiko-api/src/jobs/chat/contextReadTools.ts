// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: chat v2 needs explicit read-only context tools so the model can pull
//         stable runtime context on demand instead of relying only on prompt
//         pre-injection.
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
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-user-settings-contract.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-worker-context-contracts.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import type { Tool, ToolContext } from '../../tooling/registry.js';
import type { ChatContextBlockName, ChatContextSnapshot } from './contracts.js';
import { buildUserSettingsContract } from './userSettingsContract.js';
import { buildSessionContextContract, buildWalletStateContract } from './workerContextContracts.js';

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
    const actionState = snapshot.conversationActionState || null;
    return stripEmptyEntries({
        available: true,
        pendingAction: actionState?.pendingAction || 'none',
        canExecute: actionState?.canExecute ?? false,
        needsClarification: actionState?.needsClarification ?? false,
        clarificationQuestion: actionState?.clarificationQuestion || null,
        pendingConfirmation: snapshot.confirmationState?.kind || null,
        timeContext: snapshot.normalizedIntent?.timeContext || null,
        recentTools: normalizeRecentToolCalls(snapshot),
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
        'Read KiKo chat user settings for this turn as a normalized execution-preference contract.',
    ),
    handler: async (_args, context) => buildUserSettingsResult(context),
};

export const ReadUserContextTool: Tool = {
    definition: buildDefinition(
        'read_user_context',
        'Read worker session context: wallet identity, connected/requested/effective chain, surface, and requested entities.',
    ),
    handler: async (_args, context) => buildUserContextResult(context),
};

export const ReadWorkflowStateTool: Tool = {
    definition: buildDefinition(
        'read_workflow_state',
        'Read pending action state, confirmation state, recent tool activity, and other internal workflow state for this turn.',
    ),
    handler: async (_args, context) => buildWorkflowStateResult(context),
};

export const ReadWalletStateTool: Tool = {
    definition: buildDefinition(
        'read_wallet_state',
        'Read worker wallet state: connected wallet, active chain, compact balances, and snapshot timestamps.',
    ),
    handler: async (_args, context) => buildWalletStateResult(context),
};

export const ReadTokenContextTool: Tool = {
    definition: buildDefinition(
        'read_token_context',
        'Read cached token context for this turn, including requested token hints and prefetched token info.',
    ),
    handler: async (_args, context) => buildTokenContextResult(context),
};

export const ReadLaunchpadContextTool: Tool = {
    definition: buildDefinition(
        'read_launchpad_context',
        'Read launchpad-specific context for this turn, including cached launch metadata and token snapshot.',
    ),
    handler: async (_args, context) => buildLaunchpadContextResult(context),
};

export const ReadSocialThreadContextTool: Tool = {
    definition: buildDefinition(
        'read_social_thread_context',
        'Read current social-thread text context for this turn, such as Farcaster or X thread content.',
    ),
    handler: async (_args, context) => buildSocialThreadContextResult(context),
};

export const ReadSocialImagesTool: Tool = {
    definition: buildDefinition(
        'read_social_images',
        'Read uploaded or inbound social image labels and URLs for the current turn.',
    ),
    handler: async (_args, context) => buildSocialImagesResult(context),
};

export const ReadProviderNativeEvidenceTool: Tool = {
    definition: buildDefinition(
        'read_provider_native_evidence',
        'Read provider-native search evidence already gathered in this turn, including query summaries, citations, and compact result fields.',
    ),
    handler: async (_args, context) => buildProviderNativeEvidenceResult(context),
};

export const ReadExecutionPlanTool: Tool = {
    definition: buildDefinition(
        'read_execution_plan',
        'Read the compact internal execution plan state for this turn, including step ids, statuses, and preferred tools.',
    ),
    handler: async (_args, context) => buildExecutionPlanResult(context),
};

export const ReadSkillPromptsTool: Tool = {
    definition: buildDefinition(
        'read_skill_prompts',
        'Read the matched skill prompts for this turn when specialist task guidance is required.',
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
