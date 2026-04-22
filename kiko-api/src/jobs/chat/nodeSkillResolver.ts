// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Renata
// Reason: Clanker launch turns now need a first-class skill note so the model
//         sees the deploy prompt, collects missing launch fields, and keeps
//         real deploys dry-run first instead of drifting into generic trading.
//         Canonical deploy intent and control policy now also need the resolver
//         to expose token_deploy as a mutation envelope instead of general_answer.
//         Chat v2 now also needs skill routing to expose only matched business
//         tools plus explicit read-only context tools, instead of leaking the
//         full registry into every non-lean turn. Product owner correction on
//         2026-04-18 moved user-facing task choice to the model, so resolver
//         envelopes are backend safety/tool gates rather than task verdicts.
//         The same correction requires multi-mode task selection because one
//         user request may combine social, image, token, wallet, and execution
//         work. Product now also requires a generated-image specialist route so
//         the main model can call an internal image tool only when the user is
//         explicitly asking for a visual deliverable. Product architecture
//         review on 2026-04-19 briefly moved the target path to always-on
//         model-led all-tool visibility, but live NVIDIA evals on 2026-04-20
//         showed that exposing the full registry after task selection caused
//         heavy planning loops and cross-domain tool drift. Resolver tool
//         exposure now returns to matched skill packages plus explicit context
//         reads after model-selected task choice. The image path
//         now also needs a companion prompt-guidance skill so prompt-help-only
//         turns stay in coaching mode while real image requests can load both
//         prompt structure and execution guidance. OpenAI-aligned live eval
//         then showed prompt-coaching turns could still skip `read_skill_prompts`,
//         so the resolver now needs an explicit image-prompt strategy that
//         forces the model to load the prompt playbook before replying.
//         Business execution turns now also need a fixed fast-path template so
//         swap-style requests bind wallet, chain, token, and amount once and
//         keep moving instead of reopening discovery after every tool result.
//         Operator correction on 2026-04-21 clarified that image execution
//         ownership still belongs to the model: resolver hints may expose the
//         image tool, but must not phrase keyword matches as a backend-decided
//         image task verdict. The same model-first rule also means local
//         follow-up wording cannot widen a canonical early_buyers turn into
//         wallet_pnl tooling; only a later same-model intent pass can do that.
//         Farcaster live logs on 2026-04-21 showed a canonical image_generation
//         turn can still degrade to read-only context tools if the generated
//         image skill package is absent from the runtime skill registry; when
//         the actual image tool exists in the tool registry, it must remain
//         visible after the main model selects image_generation.
//         NVIDIA free-model professional intent matrix on 2026-04-22 showed
//         specialist intents such as Zora, market macro, and token alerts must
//         not collapse into a general_answer envelope after the model selects
//         them, or context-read tools can be under-exposed.
//         Operator correction on 2026-04-22 clarified that reference/edit
//         wording is itself an image-generation scenario in KiKo when the user
//         wants an output image; the model should not demote those turns to
//         prompt-only text just because exact pixel editing may be unavailable.
// Goal: keep skill resolution aligned with the actual user task so Clanker
//       launch requests surface the deploy skill, while onboarding/meta turns
//       still stay lean.
// Owns: resolver-scoped skill hints, preferred tool ranking, and legacy
//       query-shape-driven tool hints under model-led orchestration.
// Does Not Own: provider request transport, websocket rendering, or message persistence.
// Design Language:
// - Direct onboarding/meta turns can stay lean in selected skill prompts while
//   tool exposure stays scoped to the current task package.
// - Tool exposure should not fall back to local keyword gates for normal chat.
// - Model-selected task choice belongs to the main model, but tool exposure must stay scoped to matched skill packages plus explicit context reads.
// - Clanker launch flows should surface explicit dry-run and confirmation guidance before a real deploy.
// - Clanker deploy intent envelopes are mutation workflows, even when the first tool call is a dry-run preview.
// - Session tool history may inform follow-up analysis, but must not reopen tool access for direct meta turns.
// - Generic direct-answer turns should stay lean instead of inheriting a default market skill.
// - Local token leaderboard fallback must stay scoped to token/general trend questions and must
//   not swallow explicit specialist-domain turns such as Zora or Polymarket.
// - Chat v2 needs an explicit context contract so the prompt layer can expose
//   only the task slices this turn actually needs.
// - Context reads are explicit tools and should be front-loaded ahead of business tools when required.
// - Intent envelopes are backend safety envelopes; do not describe them to the model as selected intent.
// - The model-visible task menu owns single or multi-task choice, while this layer owns tool exposure and mutation safety.
// - Prompt-help-only image turns should load image prompt guidance without auto-triggering image execution.
// - Real image requests may load both `image_generation` and `image_prompting`, with generation first.
// - Image-generation query signals are tool-exposure hints, not forced tool
//   calls; the model decides whether the latest user turn asks for execution or
//   prompt/advice text.
// - Image prompt-coaching turns should explicitly read `read_skill_prompts` before answering so the OpenAI-aligned playbook actually reaches the model.
// - OpenAI-first prompt coaching should not volunteer Midjourney/SD/other-model rewrites unless the user asked for them.
// - Image prompt coaching is not a lean direct-answer turn; it must get a specialist context contract.
// - Specialist execution turns should collapse into a fixed template once the task mode is clear.
// - Required context should be gathered once and then carried forward until a hard blocker appears.
// - Prompt text must not encourage the model to restart discovery after every tool result.
// - Local follow-up heuristics can rank tools only when compatible with the canonical intent.
// - A model-selected image_generation turn must expose generate_image_from_intent
//   whenever that tool is present in the runtime tool registry, even if the
//   optional image skill prompt package failed to load.
// - Model-selected specialist intents must keep a specialist primary intent
//   envelope so context reads do not accidentally use the lean general-answer path.
// - Reference/edit/restyle requests should be framed to the model as generated
//   image execution requests when the user wants an output image.
// - Once TaskRoute exists, stale canonical sub-intents must not reopen sibling
//   skill branches such as early_buyers, polymarket short-window, or
//   cross-domain image/prompt modes.
// Document Provenance:
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: removing 64-tool prompt bloat from trivial `你好` / onboarding turns
// - Verification: verified in runtime logs and code
// - Source: Clanker Documentation, Deploy Token (v4.0.0)
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: surfacing the Clanker launch skill before deployment
// - Verification: verified in docs and code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: Clanker launch routing note, dry-run confirmation guidance, and token_deploy envelope
// - Verification: inferred from code and tests
// - Source: operator correction on 2026-04-21 that generated-image execution
//   should be model-decided
// - Kind: product doc
// - Retrieved: 2026-04-21
// - Applied To: image-generation strategy wording in model-visible resolver notes
// - Verification: verified in targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: keeping generic direct answers lean instead of falling back to a market skill
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: keeping specialist-domain tool scopes separate from the local token leaderboard shortcut
// - Verification: inferred from code and tests
// - Source: /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: runtime context-contract emission for lean chat v2 scaffolding
// - Verification: inferred from code and tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: restricting tool exposure to matched business tools plus explicit context-read tools
// - Verification: verified in code and targeted tests
// - Source: product owner correction in local runtime thread about model-owned intent/task choice
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-18
// - Applied To: demoting resolver intent wording to backend safety phase guidance and allowing multi-mode task choice
// - Verification: verified in code and targeted tests
// - Source: operator requirement on 2026-04-18 for model-owned image generation inside main chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: generated-image skill routing and tool exposure
// - Verification: verified in code
// - Source: operator architecture review on 2026-04-19
// - Kind: product instruction
// - Retrieved: 2026-04-19
// - Applied To: temporary always-on model-led all-tool visibility
// - Verification: verified in code and later narrowed after runtime regressions
// - Source: local live NVIDIA evals plus product-owner correction on 2026-04-20
// - Kind: runtime observation / product instruction
// - Retrieved: 2026-04-20
// - Applied To: restoring intent-package tool exposure after model-selected task routing
// - Verification: verified in runtime and targeted tests
// - Source: OpenAI GPT Image Generation Models Prompting Guide
// - Kind: official API doc
// - Retrieved: 2026-04-19
// - Applied To: ordering a dedicated prompt-guidance skill alongside the execution skill for image work
// - Verification: verified in docs and code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md
// - Kind: repo doc
// - Retrieved: 2026-04-19
// - Applied To: prompt-guidance skill ordering and prompt-help-only routing
// - Verification: verified in code and tests
// - Source: local OpenAI-aligned live eval of image prompt coaching turns
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: requiring read_skill_prompts before image prompt coaching answers
// - Verification: verified in runtime and code
// - Source: /Users/almurat/KiKo/system-journal/design-language/specialist-business-fast-path-template.md
// - Kind: repo doc
// - Retrieved: 2026-04-20
// - Applied To: fixed fast-path guidance for swap and other specialist execution turns
// - Verification: verified in code and targeted tests
// - Source: local runtime product-owner instruction about fixed fast-path templates for business logic
// - Kind: product instruction / runtime observation
// - Retrieved: 2026-04-20
// - Applied To: swap strategy notes and template-first execution guidance
// - Verification: inferred from prompt design and targeted tests
// - Source: operator correction on 2026-04-22 that reference/edit scenarios are
//   image-generation scenarios
// - Kind: product instruction
// - Retrieved: 2026-04-22
// - Applied To: image-generation strategy notes for reference/edit/restyle wording
// - Verification: inferred from targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/image-prompt-guidance.md
// - /Users/almurat/KiKo/system-journal/owner-map/image-prompt-skills.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-openai-alignment-eval.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-direct-answer-tool-pruning.md
// - /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
// - /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-lean-chat-context-exposure.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-17-chat-v2-rewrite-plan.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-v2-context-read-tools.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md
// - /Users/almurat/KiKo/system-journal/adr/2026-04-19-model-led-tool-orchestration.md
// - /Users/almurat/KiKo/system-journal/design-language/specialist-business-fast-path-template.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-20-specialist-business-fast-path-template.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

import { LogCode } from '../../config/logRegistry.js';
import { skillRegistryExec } from '../../skills/registry.js';
import { logger } from '../../utils/logger.js';
import { resolveCanonicalChainRef } from './chainIntent.js';
import type { ChatContextBlockName, ChatContextContract, ChatContextSnapshot } from './contracts.js';
import { CONTEXT_READ_TOOL_BY_BLOCK } from './contextReadTools.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import {
    detectQuerySignals,
    matchSkillsForQuery,
    type QuerySignals,
    type SearchMode,
    type SkillMatch,
} from './skillIntentMatcher.js';
import { hasTaskRouteFacet, isTaskRouteAssistantMetaDebug, resolveTaskRouteEvidenceRequirements, taskRouteNeedsCreatorEvidence, taskRouteNeedsRealtime } from './taskRoute.js';
import type { TradingIntent } from './tradingIntentResolver.js';

export type IntentPrimaryIntent =
    | 'meta_debug'
    | 'search_discovery'
    | 'social_discovery'
    | 'image_generation'
    | 'image_prompting'
    | 'token_analysis'
    | 'token_risk'
    | 'wallet_analysis'
    | 'polymarket_discovery'
    | 'polymarket_order'
    | 'swap_execution'
    | 'copytrade_execution'
    | 'token_deploy'
    | 'general_answer';

export type IntentTaskMode = 'discover' | 'analyze' | 'execute' | 'confirm';
export type IntentSearchTarget = 'x' | 'web' | 'x_and_web' | 'none';
export type IntentDomain = 'x' | 'farcaster' | 'token' | 'wallet' | 'polymarket' | 'general' | 'zora' | 'market';
export type IntentMetaDomain = 'assistant_meta';
export type IntentExecutionRisk = 'read_only' | 'mutation';
export type ToolPhase = 'native_search_only' | 'local_analysis' | 'execution';

export interface IntentEnvelope {
    primary_intent: IntentPrimaryIntent;
    task_mode: IntentTaskMode;
    search_mode: SearchMode;
    search_target: IntentSearchTarget;
    domain: IntentDomain | IntentMetaDomain;
    execution_risk: IntentExecutionRisk;
    required_evidence: string[];
}

export interface ToolPhasePolicy {
    initialPhase: ToolPhase;
    nextPhaseAfterNativeSearch: ToolPhase | null;
    searchRetryLimit: number;
}

export interface SkillResolution {
    selectedSkills: string[];
    skillPrompts: string[];
    allowedTools: string[];
    blockedTools: string[];
    preferredTools: string[];
    strategyNotes: string[];
    allowAllTools: boolean;
    rankedMatches: SkillMatch[];
    searchMode: SearchMode;
    searchReason: string;
    querySignals: QuerySignals;
    intentEnvelope: IntentEnvelope;
    contextContract: ChatContextContract;
    toolPhasePolicy: ToolPhasePolicy;
    currentPhase: ToolPhase;
    toolPackageSource: 'task_route' | 'canonical_intent' | 'none';
}

const GROK_BLOCKED_FARCASTER_TOOLS = new Set([
    'get_trending_casts',
    'search_farcaster_casts',
    'get_farcaster_user',
]);

const LOCAL_TOKEN_LEADERBOARD_TOOLS = new Set([
    'get_trending_tokens',
    'get_token_info',
]);

const EXPLICIT_SOCIAL_SOURCE_QUERY_RE = /\b(x|twitter|tweet|tweets|farcaster|cast|casts)\b/i;
const EXPLICIT_SEARCH_QUERY_RE = /\b(search|look\s*up|lookup|find on|search on|from x|from twitter|from farcaster)\b/i;
const TOKEN_LEADERBOARD_QUERY_RE = /\b(trend|trending|hot token|hot coin|top token|top coin|pumping|top gainers|gainers|movers)\b/i;
const DETAILED_ONBOARDING_QUERY_RE = /\b(new here|how do i start|how to start|how do i use|how to use|get(?:ting)? started|intro(?:duction)? to kiko|about kiko|what is kiko|what can\b.{0,24}\bkiko\b|what can kiko do|who are you)\b|怎么使用\s*kiko|如何使用\s*kiko|kiko\s*怎么用|kiko\s*如何用|介绍一下\s*kiko|kiko\s*是什么|kiko\s*能做什么|你能做什么|我是新手|新手怎么开始/i;

function isLeanFallbackIntent(intent: IntentPrimaryIntent | null | undefined): boolean {
    return intent === 'general_answer';
}

function mapCanonicalIntentToSkillIds(canonicalIntent: CanonicalIntent, querySignals: QuerySignals): string[] {
    const selected: string[] = [];
    const push = (skillId: string) => {
        if (!selected.includes(skillId)) {
            selected.push(skillId);
        }
    };

    switch (canonicalIntent.intent) {
        case 'assistant_meta':
            if (canonicalIntent.taskMode === 'analyze') {
                push('meta_debug');
            } else if (querySignals.welcome) {
                push('welcome_onboarding');
            }
            break;
        case 'general_answer':
            break;
        case 'image_generation':
            push('image_generation');
            push('image_prompting');
            break;
        case 'image_prompting':
            push('image_prompting');
            break;
        case 'swap':
            push('swap');
            push('wallet_portfolio');
            break;
        case 'cross_chain_swap':
            push('cross_chain_swap');
            push('wallet_portfolio');
            break;
        case 'copy_trade':
            push('copy_trade');
            push('wallet_portfolio');
            break;
        case 'token_analysis':
        case 'early_buyers':
        case 'creator_analysis':
            push('token_analysis');
            break;
        case 'token_risk':
            push('risk_security');
            push('token_analysis');
            break;
        case 'wallet_analysis':
        case 'wallet_pnl':
            push('wallet_portfolio');
            break;
        case 'social_discovery':
            push(canonicalIntent.domain === 'x' || canonicalIntent.domain === 'farcaster'
                ? 'social_farcaster'
                : 'market_macro');
            if (querySignals.socialChainEvidence) {
                if (querySignals.hasRequestedToken) push('token_analysis');
                if (querySignals.wallet || querySignals.pnl) push('wallet_portfolio');
                push('market_macro');
            }
            break;
        case 'market_macro':
            push('market_macro');
            break;
        case 'polymarket_discovery':
        case 'polymarket_short_window':
        case 'polymarket_order':
            push('polymarket_prediction');
            break;
        case 'zora_discovery':
            push('zora_nfts');
            break;
        case 'token_alerts':
            push('token_alert');
            break;
        case 'clanker_deploy':
            push('clanker_deploy_token');
            break;
        default:
            break;
    }

    return selected;
}

function detectRouteSocialDomain(snapshot: ChatContextSnapshot): 'x' | 'farcaster' | 'market' {
    const currentPage = String(snapshot.runtime?.currentPage || '').trim().toLowerCase();
    const pageContext = String(snapshot.runtime?.pageContext || '').trim().toLowerCase();
    if (currentPage === 'x' || pageContext.includes('x_')) return 'x';
    if (currentPage === 'farcaster' || pageContext.includes('farcaster')) return 'farcaster';
    const socialPlatform = String(snapshot.runtime?.socialInput?.platform || '').trim().toLowerCase();
    if (socialPlatform === 'x') return 'x';
    if (socialPlatform === 'farcaster') return 'farcaster';
    return 'market';
}

function buildSearchModeFromTaskRoute(snapshot: ChatContextSnapshot): SearchMode {
    const taskRoute = snapshot.taskRoute || null;
    if (!taskRoute) return 'forbidden';
    if (taskRoute.owner === 'social') return taskRouteNeedsRealtime(taskRoute) ? 'required' : 'fallback';
    if (taskRoute.owner === 'market' || taskRoute.owner === 'zora') return 'fallback';
    if (taskRoute.owner === 'token' && hasTaskRouteFacet(taskRoute, 'realtime')) return 'fallback';
    if (taskRoute.owner === 'wallet' && hasTaskRouteFacet(taskRoute, 'realtime')) return 'fallback';
    if (taskRoute.owner === 'polymarket' && taskRoute.phase === 'analyze') return taskRouteNeedsRealtime(taskRoute) ? 'required' : 'fallback';
    return 'forbidden';
}

function buildSearchTargetFromTaskRoute(snapshot: ChatContextSnapshot): IntentSearchTarget {
    const taskRoute = snapshot.taskRoute || null;
    if (!taskRoute) return 'none';
    if (taskRoute.owner === 'social') {
        const domain = detectRouteSocialDomain(snapshot);
        if (domain === 'x') return 'x';
        if (domain === 'farcaster') return 'x_and_web';
        return 'x_and_web';
    }
    if (taskRoute.owner === 'market' || taskRoute.owner === 'zora') return 'web';
    if ((taskRoute.owner === 'token' || taskRoute.owner === 'wallet' || taskRoute.owner === 'polymarket') && hasTaskRouteFacet(taskRoute, 'realtime')) return 'web';
    return 'none';
}

function mapTaskRouteToSkillIds(snapshot: ChatContextSnapshot, querySignals: QuerySignals): string[] {
    const taskRoute = snapshot.taskRoute || null;
    if (!taskRoute) return [];
    const selected: string[] = [];
    const push = (skillId: string) => {
        if (!selected.includes(skillId)) selected.push(skillId);
    };

    switch (taskRoute.owner) {
        case 'assistant_meta':
            if (isTaskRouteAssistantMetaDebug(taskRoute)) {
                push('meta_debug');
            } else if (querySignals.welcome || hasTaskRouteFacet(taskRoute, 'capabilities')) {
                push('welcome_onboarding');
            }
            break;
        case 'image':
            if (hasTaskRouteFacet(taskRoute, 'prompt_only')) {
                push('image_prompting');
            } else {
                push('image_generation');
                push('image_prompting');
            }
            break;
        case 'swap':
            push(hasTaskRouteFacet(taskRoute, 'cross_chain') ? 'cross_chain_swap' : 'swap');
            push('wallet_portfolio');
            break;
        case 'copy_trade':
            push('copy_trade');
            push('wallet_portfolio');
            break;
        case 'token':
            if (hasTaskRouteFacet(taskRoute, 'risk_review')) push('risk_security');
            push('token_analysis');
            break;
        case 'wallet':
            push('wallet_portfolio');
            break;
        case 'social':
            push('social_farcaster');
            break;
        case 'polymarket':
            push('polymarket_prediction');
            break;
        case 'zora':
            push('zora_nfts');
            break;
        case 'market':
            push('market_macro');
            break;
        case 'token_deploy':
            push('clanker_deploy_token');
            break;
        default:
            break;
    }

    return selected;
}

export function resolveNodeSkills(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null, canonicalIntent?: CanonicalIntent | null): SkillResolution {
    const isGrok = String(snapshot.model || '').toLowerCase().includes('grok');
    const rawQuery = String(snapshot.lastUserMessage || '');
    const asksDetailedOnboarding = DETAILED_ONBOARDING_QUERY_RE.test(rawQuery);
    const asksProfitRankingFollowup = /\b(pnl|profit|roi|rank|earned?)\b/i.test(rawQuery) || /收益|盈利|利润|利益|获利|赚(?:了)?多少|回报|回报率|排名|排行/.test(rawQuery);
    const asksWalletTradeSummaryFollowup = /\b(buy|sell|bought|sold|trade summary|trading summary)\b/i.test(rawQuery) || /买入|卖出|交易汇总|买卖汇总/.test(rawQuery);
    const taskRoute = snapshot.taskRoute || null;
    const normalizedIntent = canonicalIntent || snapshot.normalizedIntent || null;
    const inheritsEntitiesFromContext = taskRoute
        ? taskRoute.inheritEntitiesFromContext
        : normalizedIntent?.inheritEntitiesFromContext ?? true;
    const effectiveRequestedTokenAddresses = taskRoute
        ? (
            inheritsEntitiesFromContext
                ? Array.from(new Set([...(snapshot.requestedTokenAddresses || []), ...(taskRoute.entities.tokenAddresses || [])]))
                : (taskRoute.entities.tokenAddresses || [])
        )
        : (
            inheritsEntitiesFromContext
                ? (snapshot.requestedTokenAddresses || [])
                : (normalizedIntent?.entities?.tokenAddresses || [])
        );
    const effectiveRequestedTokenSymbols = taskRoute
        ? (
            inheritsEntitiesFromContext
                ? Array.from(new Set([...(snapshot.requestedTokenSymbols || []), ...(taskRoute.entities.tokenSymbols || [])]))
                : (taskRoute.entities.tokenSymbols || [])
        )
        : (
            inheritsEntitiesFromContext
                ? (snapshot.requestedTokenSymbols || [])
                : (normalizedIntent?.entities?.tokenSymbols || [])
        );
    const availableToolNames = new Set((snapshot.toolDefinitions || []).map((definition) => String(definition.name || '').trim()).filter(Boolean));
    const blockedTools: string[] = [];
    const preferredTools: string[] = [];
    const strategyNotes: string[] = [];
    let allowAllTools = false;
    const sessionToolNames = Array.from(new Set(
        (snapshot.recentToolTrace?.toolCalls || [])
            .map((call) => String(call?.tool || '').trim())
            .filter((toolName) => toolName && availableToolNames.has(toolName)),
    ));
    const hasRequestedTokenAddress = effectiveRequestedTokenAddresses.length > 0;
    const refersToPriorWalletSet = /\b(these|those|them|their)\b/i.test(rawQuery) || /这些|它们|他们|这批|这几个|这群/.test(rawQuery);

    const querySignals = detectQuerySignals(
        rawQuery,
        normalizedIntent ? { ...snapshot, normalizedIntent } : snapshot,
        tradingIntent,
        normalizedIntent,
    );
    const heuristicMatchResult = !taskRoute && !normalizedIntent
        ? matchSkillsForQuery({
            snapshot,
            tradingIntent,
        })
        : null;
    const matchResult = taskRoute
        ? {
            rankedMatches: [] as SkillMatch[],
            rejectedMatches: [] as SkillMatch[],
            querySignals,
            searchMode: buildSearchModeFromTaskRoute(snapshot),
            searchReason: 'task_route',
        }
        : normalizedIntent
        ? {
            rankedMatches: [] as SkillMatch[],
            rejectedMatches: [] as SkillMatch[],
            querySignals,
            searchMode: normalizedIntent.searchMode,
            searchReason: 'canonical_intent',
        }
        : heuristicMatchResult || {
            rankedMatches: [] as SkillMatch[],
            rejectedMatches: [] as SkillMatch[],
            querySignals,
            searchMode: 'forbidden' as SearchMode,
            searchReason: 'normalization_unavailable',
        };
    const explicitRiskRequest = querySignals.risk;
    const asksWalletPnl = querySignals.pnl;
    const hasRequestedToken = querySignals.hasRequestedToken;
    const requiresSocialChainEvidence = querySignals.socialChainEvidence;
    const routeImageGeneration = Boolean(taskRoute && taskRoute.owner === 'image' && !hasTaskRouteFacet(taskRoute, 'prompt_only'));
    const routeImagePrompting = Boolean(taskRoute && taskRoute.owner === 'image' && hasTaskRouteFacet(taskRoute, 'prompt_only'));
    const routeClankerDeploy = Boolean(taskRoute && taskRoute.owner === 'token_deploy');
    const imageGenerationTurn = taskRoute
        ? routeImageGeneration
        : normalizedIntent?.intent === 'image_generation';
    const imagePromptingTurn = taskRoute
        ? routeImagePrompting
        : normalizedIntent?.intent === 'image_prompting';
    const clankerDeployTurn = taskRoute
        ? routeClankerDeploy
        : normalizedIntent?.intent === 'clanker_deploy';
    if (imageGenerationTurn) {
        strategyNotes.push('The model-selected package exposes image-generation tools. Decide from the latest user wording and media context whether they want an image generated now or only prompt/advice text; call generate_image_from_intent only when the visual execution request is clear enough.');
        strategyNotes.push('Reference-image, edit, restyle, redraw, replace, put/place, and remix wording still means image generation when the user wants an output image. If source-image context is available, use it through the image tool; if exact pixel editing is unavailable, summarize the reference/edit direction into a new generated-image request instead of answering with prompt-only text.');
        strategyNotes.push('If generating, do not ask for a second confirmation. If a truly critical visual field is missing, ask one precise clarification instead of calling the tool.');
        strategyNotes.push('If prompt structure is still weak before generation, call read_skill_prompts first so the request follows the OpenAI-aligned image prompting playbook.');
        strategyNotes.push('When generate_image_from_intent is visible and the user is asking to generate or edit an image now, do not answer with a packaged prompt draft in assistant text. Call the tool and let it package the optimized prompt for the image model.');
    }
    if (imagePromptingTurn) {
        strategyNotes.push('This turn is asking for image prompt guidance, not automatic image execution. Call read_skill_prompts before answering so the rewrite follows the OpenAI-aligned image prompting playbook.');
        strategyNotes.push('Return one copy-ready prompt, the negative constraints, and a few single-variable refinements. Do not call generate_image_from_intent unless the user explicitly asks to generate now.');
        strategyNotes.push('Do not volunteer Midjourney, Stable Diffusion, or other non-OpenAI prompt variants unless the user explicitly asks for another model.');
    }
    if (clankerDeployTurn) {
        strategyNotes.push('This is a Clanker launch or Clanker history request. Follow the Clanker launch safety template: collect only hard-missing launch inputs, keep optional defaults implicit, prepare a dry-run preview first, and wait for explicit user confirmation before any real deploy. Do not restate this internal checklist to the user.');
    }
    const requestedChain = resolveCanonicalChainRef({
        taskRoute,
        canonicalIntent: normalizedIntent,
        requestedTokenAddresses: effectiveRequestedTokenAddresses,
        requestedTokenSymbols: effectiveRequestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
    });
    const routeSearchTarget = taskRoute ? buildSearchTargetFromTaskRoute(snapshot) : null;
    const preferXNativeSearch = taskRoute
        ? routeSearchTarget === 'x' || routeSearchTarget === 'x_and_web'
        : normalizedIntent
            ? (normalizedIntent.searchTarget === 'x' || normalizedIntent.searchTarget === 'x_and_web' || normalizedIntent.domain === 'x')
            : false;
    const canUseEarlyBuyerWalletPnlFollowup = taskRoute
        ? taskRoute.owner === 'wallet'
        : !normalizedIntent
            || normalizedIntent.intent === 'wallet_pnl'
            || normalizedIntent.intent === 'wallet_analysis';
    const asksEarlyBuyerWalletPnlFollowup = canUseEarlyBuyerWalletPnlFollowup
        && sessionToolNames.includes('get_early_buyers')
        && hasRequestedToken
        && refersToPriorWalletSet
        && (querySignals.pnl || asksProfitRankingFollowup || asksWalletTradeSummaryFollowup);
    const asksEarlyBuyers = Boolean(
        (taskRoute
            ? taskRoute.owner === 'token' && hasTaskRouteFacet(taskRoute, 'early_buyers')
            : normalizedIntent?.intent === 'early_buyers')
        && !asksEarlyBuyerWalletPnlFollowup,
    );
    const explicitEarlyBuyerRowCount = taskRoute?.rowCount ?? normalizedIntent?.rowCount ?? null;
    const explicitlyRequestsEarlyBuyerFullList = Boolean(
        taskRoute
            ? taskRoute.owner === 'token' && hasTaskRouteFacet(taskRoute, 'full_list')
            : normalizedIntent?.outputMode === 'full_table',
    ) || (asksEarlyBuyers && explicitEarlyBuyerRowCount !== null);
    const wantsEarlyBuyerFullList = asksEarlyBuyers || explicitlyRequestsEarlyBuyerFullList;
    const normalizedTokenSymbols = Array.isArray(taskRoute?.entities?.tokenSymbols)
        ? taskRoute!.entities.tokenSymbols.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : Array.isArray(normalizedIntent?.entities?.tokenSymbols)
        ? normalizedIntent!.entities.tokenSymbols.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
    const requestedTokenSymbols = Array.isArray(effectiveRequestedTokenSymbols)
        ? effectiveRequestedTokenSymbols.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
    const hasExplicitPolymarketCoinSelection = normalizedTokenSymbols.length > 0 || requestedTokenSymbols.length > 0;
    const asksCreator = taskRoute
        ? taskRouteNeedsCreatorEvidence(taskRoute)
        : normalizedIntent?.intent === 'creator_analysis';
    const shouldConstrainToolExposure = querySignals.welcome || querySignals.metaDebug;

    let selected = taskRoute
        ? mapTaskRouteToSkillIds(snapshot, querySignals)
        : normalizedIntent
        ? mapCanonicalIntentToSkillIds(normalizedIntent, querySignals)
        : matchResult.rankedMatches.map((match) => match.skillId);
    if (querySignals.welcome) {
        strategyNotes.push('This is a greeting, self-introduction, or capabilities question. Answer directly without tools unless the user explicitly asks for live data or on-chain evidence.');
        if (asksDetailedOnboarding) {
            strategyNotes.push('For explicit Kiko intro / capabilities / how-to-use questions, give a real onboarding answer: explain what Kiko is, group the main capabilities, show concrete example commands, explain safe first steps, and recommend the next action. Do not bounce back with "what do you want me to do?" as the main answer.');
        }
        selected = selected.filter((skillId) => skillId === 'welcome_onboarding');
    } else if (querySignals.metaDebug) {
        strategyNotes.push('This turn is about the assistant or system behavior itself. Explain the previous behavior directly from the current conversation and runtime context instead of switching back into a token or market answer.');
        strategyNotes.push('When explaining what went wrong, distinguish between observed facts from the current conversation/runtime and informed inferences. If some evidence is missing, say exactly what is missing instead of fabricating certainty.');
        selected = selected.filter((skillId) => skillId === 'meta_debug');
    }
    if (!taskRoute && !normalizedIntent && selected.includes('image_generation')) {
        strategyNotes.push('The model-selected package exposes image-generation tools. Decide from the latest user wording and media context whether they want an image generated now or only prompt/advice text; call generate_image_from_intent only when the visual execution request is clear enough.');
        strategyNotes.push('Reference-image, edit, restyle, redraw, replace, put/place, and remix wording still means image generation when the user wants an output image. If source-image context is available, use it through the image tool; if exact pixel editing is unavailable, summarize the reference/edit direction into a new generated-image request instead of answering with prompt-only text.');
        strategyNotes.push('If generating, do not ask for a second confirmation. If a truly critical visual field is missing, ask one precise clarification instead of calling the tool.');
        strategyNotes.push('If prompt structure is still weak before generation, call read_skill_prompts first so the request follows the OpenAI-aligned image prompting playbook.');
        strategyNotes.push('When generate_image_from_intent is visible and the user is asking to generate or edit an image now, do not answer with a packaged prompt draft in assistant text. Call the tool and let it package the optimized prompt for the image model.');
    }
    if (!taskRoute && !normalizedIntent && selected.includes('image_prompting')) {
        strategyNotes.push('This turn is asking for image prompt guidance, not automatic image execution. Call read_skill_prompts before answering so the rewrite follows the OpenAI-aligned image prompting playbook.');
        strategyNotes.push('Return one copy-ready prompt, the negative constraints, and a few single-variable refinements. Do not call generate_image_from_intent unless the user explicitly asks to generate now.');
        strategyNotes.push('Do not volunteer Midjourney, Stable Diffusion, or other non-OpenAI prompt variants unless the user explicitly asks for another model.');
    }

    if (normalizedIntent && tradingIntent) {
        if (tradingIntent.type === 'copy_trade') {
            ensurePrimarySkill(selected, 'copy_trade');
            ensureSupportingSkill(selected, 'wallet_portfolio');
        } else if (tradingIntent.type === 'cross_chain_trade') {
            ensurePrimarySkill(selected, 'cross_chain_swap');
            ensureSupportingSkill(selected, 'wallet_portfolio');
        } else {
            ensurePrimarySkill(selected, 'swap');
            ensureSupportingSkill(selected, 'wallet_portfolio');
            if (explicitRiskRequest) {
                ensureSupportingSkill(selected, 'risk_security');
            }
        }
    }

    if (requiresSocialChainEvidence) {
        ensureSupportingSkill(selected, 'market_macro');
        if (snapshot.runtime.walletAddress || snapshot.runtime.userAddress) {
            ensureSupportingSkill(selected, 'wallet_portfolio');
        }
        if (hasRequestedToken) {
            ensureSupportingSkill(selected, 'token_analysis');
        }
        if (querySignals.wallet || asksWalletPnl) {
            ensureSupportingSkill(selected, 'wallet_portfolio');
        }
        strategyNotes.push('For X/Twitter queries in this system, prefer combining search evidence with chain-side evidence when it materially improves the answer.');
        if (querySignals.timeContext && hasRequestedToken) {
            strategyNotes.push('For time-anchored token analysis, establish the public post or announcement timestamp first, then run get_early_buyers with the real address + start_time/end_time contract.');
        }
    }

    if (requestedChain?.chainId && snapshot.runtime.chainId && requestedChain.chainId !== Number(snapshot.runtime.chainId)) {
        strategyNotes.push(`The user explicitly requested ${requestedChain.chainName}. Treat the connected chain only as wallet context; requested chain overrides it for this turn.`);
    }

    if (preferXNativeSearch && !isGrok && requiresSocialChainEvidence) {
        strategyNotes.push('This provider path has no native X search. Prefer local external_web_search together with relevant chain-analysis tools when you need current X/Twitter context.');
    }

    selected = selected
        .filter((skillId, index) => selected.indexOf(skillId) === index && !!skillRegistryExec.getSkill(skillId))
        .slice(0, querySignals.welcome ? 1 : 3);

    const isLeanDirectAnswerTurn = selected.length === 0
        && !querySignals.welcome
        && !querySignals.metaDebug
        && !imageGenerationTurn
        && !imagePromptingTurn
        && matchResult.searchMode === 'forbidden';

    const skillPrompts: string[] = [];
    let allowedTools: string[] = [];

    for (const skillId of selected) {
        const skill = skillRegistryExec.getSkill(skillId);
        if (!skill) continue;
        if (skill.prompt) {
            skillPrompts.push(skill.prompt);
        }
        for (const toolName of skill.metadata.tools || []) {
            if (availableToolNames.has(String(toolName))) {
                if (!allowedTools.includes(toolName)) {
                    allowedTools.push(String(toolName));
                }
            }
        }
    }

    if (tradingIntent?.kind === 'trade_confirmation') {
        if (tradingIntent.type === 'swap') {
            for (const toolName of ['prepare_swap_transaction', 'prepare_cross_chain_tx']) {
                if (!allowedTools.includes(toolName)) {
                    allowedTools.push(toolName);
                }
            }
        }
        if (tradingIntent.type === 'copy_trade' && !allowedTools.includes('create_copy_trade_config')) {
            allowedTools.push('create_copy_trade_config');
        }
    }

    if (tradingIntent?.kind === 'trading' && tradingIntent.type === 'swap') {
        const userSettings = snapshot.runtime.userSettings || {};
        const fastSwapMode = userSettings.fastSwapMode === true;
        const quoteBeforeSwap = userSettings.showQuoteBeforeSwap !== false && !fastSwapMode;
        strategyNotes.push('Treat natural-language swap turns as a fixed business template: resolve wallet, chain, token, and amount once, then move through one quote or one execution path without reopening discovery after each tool result unless a hard blocker appears.');
        pushPreferred(preferredTools, 'get_wallet_info');
        pushPreferred(preferredTools, 'prepare_swap_transaction');
        if (quoteBeforeSwap) {
            pushPreferred(preferredTools, 'simulate_swap');
            strategyNotes.push('Quote-before-swap mode is enabled: follow the fixed swap template, resolve balance with get_wallet_info once, run simulate_swap once for the first pair+amount, present the quote, then use prepare_swap_transaction only after explicit user confirmation.');
        } else if (fastSwapMode) {
            strategyNotes.push('Fast swap mode is enabled: follow the fixed swap template, resolve wallet/balance context once, do not make simulate_swap a blocking prerequisite, and move directly toward prepare_swap_transaction execution once token, chain, and amount are explicit and safe.');
        } else {
            strategyNotes.push('Direct execution mode is enabled: follow the fixed swap template, resolve wallet/balance context once, use preflight only when needed for ambiguity or safety, then move toward prepare_swap_transaction execution without stalling on quote presentation.');
        }
        strategyNotes.push('Do not use get_token_price as a prerequisite for selling or swapping a contract-address token. That tool is only for mainstream symbol price lookups.');
    }

    if (isLeanDirectAnswerTurn) {
        allowAllTools = false;
        strategyNotes.push('No domain skill matched and search is not required. Keep this turn as a lean direct answer without exposing the full registry.');
    }

    const polymarketShortWindowQuery = taskRoute
        ? taskRoute.owner === 'polymarket' && hasTaskRouteFacet(taskRoute, 'short_window')
        : normalizedIntent?.intent === 'polymarket_short_window';
    if (polymarketShortWindowQuery) {
        if (hasExplicitPolymarketCoinSelection) {
            pushPreferred(preferredTools, 'get_polymarket_coin_updown_markets');
            strategyNotes.push('For explicit coin/token Up/Down short-window requests, prefer get_polymarket_coin_updown_markets because exact ET-window discovery is required.');
        } else {
            pushPreferred(preferredTools, 'get_polymarket_market_overview');
            pushPreferred(preferredTools, 'get_new_markets');
            strategyNotes.push('Generic short-window market requests are broader than the coin-only 5-minute slice. Use grouped overview/new-market discovery first, and only narrow to get_polymarket_coin_updown_markets when the user explicitly asks for a coin/token series.');
        }
    }
    const polymarketOrderQuery = taskRoute
        ? taskRoute.owner === 'polymarket' && (taskRoute.phase === 'execute' || taskRoute.phase === 'confirm')
        : normalizedIntent?.intent === 'polymarket_order';
    if (polymarketOrderQuery) {
        pushPreferred(preferredTools, 'prepare_polymarket_bet');
        strategyNotes.push('For concrete Polymarket order turns, go straight to prepare_polymarket_bet when market, outcome, and amount are already explicit. Do not spend another turn re-confirming obvious selected parameters.');
    }

    if ((tradingIntent?.kind === 'trading' && tradingIntent.type === 'swap') || hasRequestedTokenAddress) {
        removeTool(allowedTools, 'get_token_price');
        removeTool(preferredTools, 'get_token_price');
        if (hasRequestedTokenAddress) {
            strategyNotes.push('get_token_price is restricted to mainstream symbol lookups. Contract-address tokens should use wallet, token, and swap tooling instead.');
        }
    }

    if (preferXNativeSearch) {
        strategyNotes.push('This query is explicitly about X/Twitter. Prefer X-related evidence first, but choose the tools that best answer the request.');
    }

    if (hasRequestedToken) {
        pushPreferred(preferredTools, 'get_token_info');
    }
    if (requiresSocialChainEvidence && !isGrok) {
        pushPreferred(preferredTools, 'external_web_search');
    }
    if (asksEarlyBuyers && hasRequestedToken) {
        pushPreferred(preferredTools, 'get_early_buyers');
        pushPreferred(preferredTools, 'get_token_info');
        strategyNotes.push('This request asks for on-chain buyer/holder evidence. Prefer local token-analysis tools before answering from web summaries alone.');
        if ((taskRoute?.timeContext || normalizedIntent?.timeContext)?.isTimeBound) {
            strategyNotes.push('For time-bound early-buyer requests, treat the requested time window as literal query scope. Use that exact window for get_early_buyers, do not silently substitute token launch time or announcement time, and if the window returns no buyers say that the requested window had no qualifying buyers.');
        }
        if (wantsEarlyBuyerFullList) {
            strategyNotes.push(`Early-buyer queries default to full-list output${explicitEarlyBuyerRowCount ? ` with ${explicitEarlyBuyerRowCount} rows` : ''}. Preserve full wallet addresses and render the returned rows directly as a clean markdown table instead of compressing them into a short summary. Do not request trade progression or wallet PnL unless the user explicitly asks for those deeper wallet details.`);
        }
    }
    if (asksCreator && hasRequestedToken) {
        pushPreferred(preferredTools, 'analyze_creator');
        pushPreferred(preferredTools, 'get_token_info');
    }
    if (asksWalletPnl) {
        pushPreferred(preferredTools, 'analyze_wallet_pnl_batch');
    }
    if (requiresSocialChainEvidence && (querySignals.wallet || asksWalletPnl)) {
        pushPreferred(preferredTools, 'get_wallet_info');
        pushPreferred(preferredTools, 'analyze_wallet_pnl_batch');
    }
    if (requiresSocialChainEvidence && hasRequestedToken) {
        pushPreferred(preferredTools, 'get_early_buyers');
        pushPreferred(preferredTools, 'analyze_creator');
    }
    if (requiresSocialChainEvidence && (snapshot.runtime.walletAddress || snapshot.runtime.userAddress)) {
        pushPreferred(preferredTools, 'get_wallet_info');
    }

    for (const skillId of selected) {
        pushPreferredToolsForSkill(skillId, preferredTools);
    }

    if (polymarketShortWindowQuery && !hasExplicitPolymarketCoinSelection) {
        removeTool(preferredTools, 'get_polymarket_coin_updown_markets');
    }

    if (sessionToolNames.length > 0) {
        strategyNotes.push(`Recent tool evidence is available from this session: ${sessionToolNames.join(', ')}. Reuse it when it still answers the current turn, and refresh only when the structured workflow state or new user request makes targeted re-verification necessary.`);
        if (
            polymarketOrderQuery
            && sessionToolNames.some((toolName) => ['get_polymarket_coin_updown_markets', 'prepare_polymarket_bet', 'get_polymarket_market_overview'].includes(toolName))
        ) {
            strategyNotes.push('Recent Polymarket discovery/prep evidence already exists in this session. Reuse that evidence and move directly into bet preparation unless the user explicitly changed the market, side, or amount.');
        }
        if ((asksWalletPnl || asksProfitRankingFollowup || asksWalletTradeSummaryFollowup) && sessionToolNames.includes('get_early_buyers')) {
            pushPreferred(preferredTools, 'analyze_wallet_pnl_batch');
            strategyNotes.push('If recent early-buyer rows already exist and the user now asks for profit/PnL or per-wallet buy/sell summaries, reuse those wallet addresses as the candidate set for batch wallet PnL analysis.');
            strategyNotes.push('Pass the same token_address into analyze_wallet_pnl_batch so the result reports each wallet\'s buy USD, sell USD, realized PnL, and profit percent for that token over a supported recent window (1d / 7d / 30d, default 30d).');
            strategyNotes.push('Do not answer profit ranking or per-wallet token trade summaries from the early-buyer rows alone when those rows lack wallet PnL evidence.');
        }
    }

    if (selected.length > 0) {
        const missingToolsBySkill = selected
            .map((skillId) => {
                const skill = skillRegistryExec.getSkill(skillId);
                if (!skill) return null;
                const missing = (skill.metadata.tools || []).filter((toolName) => !availableToolNames.has(String(toolName)));
                return missing.length > 0 ? { skillId, missing } : null;
            })
            .filter(Boolean) as Array<{ skillId: string; missing: string[] }>;
        if (missingToolsBySkill.length > 0) {
            logger.warn(LogCode.AI_SKILLS_ATTACHED, 'Node skill resolution dropped tools missing from runtime registry snapshot', {
                sessionId: snapshot.sessionId,
                taskId: snapshot.taskId,
                missingToolsBySkill,
            });
        }
    }

    const droppedPreferredTools = preferredTools.filter((toolName) => !availableToolNames.has(String(toolName)));
    if (droppedPreferredTools.length > 0) {
        strategyNotes.push(`Some preferred tools are not available in the current registry snapshot and were removed: ${droppedPreferredTools.join(', ')}.`);
    }

    if (shouldConstrainToolExposure) {
        allowedTools = [];
        preferredTools.splice(0, preferredTools.length);
        allowAllTools = false;
        strategyNotes.push('This is a direct onboarding/meta turn. Do not expose unrelated tool schemas unless the user explicitly asks for live verification, search, or execution.');
    }

    allowedTools = allowedTools.filter((toolName) => availableToolNames.has(String(toolName)));
    preferredTools.splice(0, preferredTools.length, ...preferredTools.filter((toolName) => availableToolNames.has(String(toolName))));
    blockedTools.splice(0, blockedTools.length, ...blockedTools.filter((toolName) => availableToolNames.has(String(toolName)) || isSyntheticBlockedTool(toolName)));

    if (
        imageGenerationTurn
        && availableToolNames.has('generate_image_from_intent')
        && !allowedTools.includes('generate_image_from_intent')
    ) {
        allowedTools.unshift('generate_image_from_intent');
        pushPreferred(preferredTools, 'generate_image_from_intent');
        strategyNotes.push('The same model selected image_generation. Expose generate_image_from_intent from the runtime tool registry even if the optional image skill prompt package is unavailable; the model still decides whether to call it.');
    }

    if (allowedTools.length === 0 && selected.length > 0) {
        strategyNotes.push('Matched skills did not have any registry-backed tools available in this runtime snapshot, so the model must rely on provider-native search or direct answering.');
    }

    if (matchResult.searchMode === 'required') {
        strategyNotes.push('External search evidence is required for this query. Retrieve it before concluding.');
    } else if (matchResult.searchMode === 'fallback') {
        strategyNotes.push('Matched local skills are primary for this query. Use search only if the user explicitly requests external evidence or the local tools are insufficient.');
    } else {
        strategyNotes.push('Do not use generic search unless the user explicitly asks for external web/X evidence.');
    }

    if (hasRequestedToken && asksEarlyBuyers && querySignals.realtime) {
        strategyNotes.push('This is a composite task. First establish the social/timing context, then gather local on-chain token evidence for the same window.');
    }
    if (!explicitRiskRequest) {
        strategyNotes.push('Do not run token-risk scanning unless the user explicitly asks for a safety or risk check.');
    }

    let effectiveSearchMode = matchResult.searchMode;
    let effectiveSearchReason = matchResult.searchReason;
    const intentEnvelope = buildIntentEnvelope({
        snapshot,
        taskRoute,
        canonicalIntent: normalizedIntent,
    });
    const contextContract = buildContextContract({
        snapshot,
        intentEnvelope,
        querySignals,
    });
    const preferLocalTokenLeaderboard = isGrok && shouldPreferLocalTokenLeaderboard(snapshot, intentEnvelope);
    if (preferLocalTokenLeaderboard) {
        effectiveSearchMode = 'forbidden';
        effectiveSearchReason = 'local_token_leaderboard_preferred';
        intentEnvelope.search_mode = 'forbidden';
        intentEnvelope.search_target = 'none';
        intentEnvelope.required_evidence = intentEnvelope.required_evidence.filter((item) => item !== 'native_search_results');
        for (const toolName of LOCAL_TOKEN_LEADERBOARD_TOOLS) {
            if (availableToolNames.has(toolName) && !allowedTools.includes(toolName)) {
                allowedTools.push(toolName);
            }
        }
        allowedTools = allowedTools.filter((toolName) => LOCAL_TOKEN_LEADERBOARD_TOOLS.has(toolName));
        preferredTools.splice(0, preferredTools.length, ...preferredTools.filter((toolName) => LOCAL_TOKEN_LEADERBOARD_TOOLS.has(toolName)));
        pushPreferred(preferredTools, 'get_trending_tokens');
        pushPreferred(preferredTools, 'get_token_info');
        allowAllTools = false;
        strategyNotes.push('This read-only token trend query is satisfiable from KiKo local token leaderboard data. Start with get_trending_tokens and stay on local token evidence unless the user explicitly asks for social/search sources.');
    }
    if (preferLocalTokenLeaderboard) {
        strategyNotes.push('Canonical social-search intent is being overridden because the query is answerable from local token leaderboard data without external evidence.');
    }
    if (isGrok) {
        allowedTools = allowedTools.filter((toolName) => !GROK_BLOCKED_FARCASTER_TOOLS.has(toolName));
        preferredTools.splice(0, preferredTools.length, ...preferredTools.filter((toolName) => !GROK_BLOCKED_FARCASTER_TOOLS.has(toolName)));
        strategyNotes.push('Grok path does not expose local Farcaster cache/search tools. Use provider-native search instead for social discovery.');
    }
    const toolPhasePolicy = buildToolPhasePolicy(snapshot, tradingIntent, intentEnvelope);
    if (!preferLocalTokenLeaderboard && !isGrok && intentEnvelope.search_mode === 'required') {
        strategyNotes.push('This provider does not support provider-native X/web search in the current orchestration path. Use only relevant local tools if they truly match the request, otherwise state the limitation plainly.');
    }
    if (preferLocalTokenLeaderboard) {
        strategyNotes.push('Local token leaderboard evidence is the first-class answer path for this turn. Do not spend search budget unless the user explicitly asks for X/web/social sources.');
    } else {
        strategyNotes.push(describePhasePolicy(toolPhasePolicy));
    }

    attachContextReadTools({
        contextContract,
        availableToolNames,
        allowedTools,
        preferredTools,
    });

    if (asksEarlyBuyers) {
        for (const toolName of ['analyze_wallet_pnl_batch', 'analyze_wallet_pnl', 'analyze_wallet_pnl_analysis']) {
            removeTool(allowedTools, toolName);
            removeTool(preferredTools, toolName);
        }
        strategyNotes.push('The selected task is early_buyers. Keep this turn on buyer/token evidence only; do not widen into wallet PnL tools unless a later same-model intent pass selects wallet_pnl.');
    }

    if (!isLeanDirectAnswerTurn) {
        strategyNotes.push('Chat v2 exposes only matched business tools plus explicit context-read tools. Read the required context first instead of assuming the full registry is available.');
    }

    logger.info(LogCode.AI_SKILLS_ATTACHED, 'Node skill resolution completed', {
        sessionId: snapshot.sessionId,
        taskId: snapshot.taskId,
        selectedSkills: selected,
        rankedMatches: matchResult.rankedMatches.map((match) => ({
            skillId: match.skillId,
            score: match.score,
            reasons: match.reasons,
        })),
        rejectedSkills: matchResult.rejectedMatches.slice(0, 5).map((match) => ({
            skillId: match.skillId,
            score: match.score,
        })),
        searchMode: effectiveSearchMode,
        searchReason: effectiveSearchReason,
        allowedTools,
        blockedTools,
    });

    return {
        selectedSkills: selected,
        skillPrompts,
        allowedTools,
        blockedTools,
        preferredTools,
        strategyNotes,
        allowAllTools,
        rankedMatches: matchResult.rankedMatches,
        searchMode: effectiveSearchMode,
        searchReason: effectiveSearchReason,
        querySignals,
        intentEnvelope,
        contextContract,
        toolPhasePolicy,
        currentPhase: toolPhasePolicy.initialPhase,
        toolPackageSource: snapshot.taskRoute ? 'task_route' : normalizedIntent ? 'canonical_intent' : 'none',
    };
}

function buildIntentEnvelope(params: {
    snapshot: ChatContextSnapshot;
    taskRoute: ChatContextSnapshot['taskRoute'] | null;
    canonicalIntent: CanonicalIntent | null;
}): IntentEnvelope {
    const { snapshot, taskRoute, canonicalIntent } = params;

    if (taskRoute) {
        const primary = (() => {
            switch (taskRoute.owner) {
                case 'assistant_meta':
                    return isTaskRouteAssistantMetaDebug(taskRoute)
                        ? 'meta_debug' as const
                        : 'general_answer' as const;
                case 'general_answer':
                    return 'general_answer' as const;
                case 'image':
                    return hasTaskRouteFacet(taskRoute, 'prompt_only')
                        ? 'image_prompting' as const
                        : 'image_generation' as const;
                case 'social':
                    return 'social_discovery' as const;
                case 'token':
                    return hasTaskRouteFacet(taskRoute, 'risk_review')
                        ? 'token_risk' as const
                        : 'token_analysis' as const;
                case 'wallet':
                    return 'wallet_analysis' as const;
                case 'polymarket':
                    return taskRoute.phase === 'execute' || taskRoute.phase === 'confirm'
                        ? 'polymarket_order' as const
                        : 'polymarket_discovery' as const;
                case 'swap':
                    return 'swap_execution' as const;
                case 'copy_trade':
                    return 'copytrade_execution' as const;
                case 'token_deploy':
                    return 'token_deploy' as const;
                case 'zora':
                case 'market':
                    return 'search_discovery' as const;
                default:
                    return 'general_answer' as const;
            }
        })();

        const domain: IntentDomain | IntentMetaDomain = (() => {
            switch (taskRoute.owner) {
                case 'assistant_meta':
                    return 'assistant_meta';
                case 'social': {
                    const socialDomain = detectRouteSocialDomain(snapshot);
                    return socialDomain === 'market' ? 'market' : socialDomain;
                }
                case 'token':
                case 'swap':
                case 'copy_trade':
                case 'token_deploy':
                    return 'token';
                case 'wallet':
                    return 'wallet';
                case 'polymarket':
                    return 'polymarket';
                case 'zora':
                    return 'zora';
                case 'market':
                    return 'market';
                default:
                    return 'general';
            }
        })();

        return {
            primary_intent: primary,
            task_mode: taskRoute.phase === 'answer' ? 'discover' : taskRoute.phase,
            search_mode: buildSearchModeFromTaskRoute(snapshot),
            search_target: buildSearchTargetFromTaskRoute(snapshot),
            domain,
            execution_risk: taskRoute.phase === 'execute' || taskRoute.phase === 'confirm' ? 'mutation' : 'read_only',
            required_evidence: Array.from(new Set(resolveTaskRouteEvidenceRequirements(taskRoute))),
        };
    }

    if (canonicalIntent) {
        const canonicalPrimary = (() => {
            switch (canonicalIntent.intent) {
                case 'assistant_meta':
                    return canonicalIntent.taskMode === 'analyze'
                        ? 'meta_debug' as const
                        : 'general_answer' as const;
                case 'general_answer':
                    return 'general_answer' as const;
                case 'image_generation':
                    return 'image_generation' as const;
                case 'image_prompting':
                    return 'image_prompting' as const;
                case 'copy_trade':
                    return 'copytrade_execution' as const;
                case 'clanker_deploy':
                    return 'token_deploy' as const;
                case 'swap':
                case 'cross_chain_swap':
                    return 'swap_execution' as const;
                case 'polymarket_order':
                    return 'polymarket_order' as const;
                case 'polymarket_discovery':
                case 'polymarket_short_window':
                    return 'polymarket_discovery' as const;
                case 'token_risk':
                    return 'token_risk' as const;
                case 'wallet_analysis':
                case 'wallet_pnl':
                    return 'wallet_analysis' as const;
                case 'token_analysis':
                case 'early_buyers':
                case 'creator_analysis':
                    return 'token_analysis' as const;
                case 'social_discovery':
                    return canonicalIntent.domain === 'x' || canonicalIntent.domain === 'farcaster'
                        ? 'social_discovery' as const
                        : 'search_discovery' as const;
                case 'zora_discovery':
                case 'market_macro':
                    return 'search_discovery' as const;
                case 'token_alerts':
                    return 'token_analysis' as const;
                default:
                    return 'general_answer' as const;
            }
        })();

        const canonicalDomain: IntentDomain | IntentMetaDomain = canonicalIntent.domain === 'market'
            ? 'market'
            : canonicalIntent.domain === 'zora'
                ? 'zora'
                : canonicalIntent.domain === 'assistant_meta'
                    ? 'assistant_meta'
                    : canonicalIntent.domain;

        return {
            primary_intent: canonicalPrimary,
            task_mode: canonicalIntent.taskMode,
            search_mode: canonicalIntent.searchMode,
            search_target: canonicalIntent.searchTarget,
            domain: canonicalDomain,
            execution_risk: canonicalIntent.taskMode === 'execute' || canonicalIntent.taskMode === 'confirm' ? 'mutation' : 'read_only',
            required_evidence: Array.from(new Set(canonicalIntent.evidenceRequirements)),
        };
    }

    return {
        primary_intent: 'general_answer',
        task_mode: 'discover',
        search_mode: 'forbidden',
        search_target: 'none',
        domain: 'general',
        execution_risk: 'read_only',
        required_evidence: [],
    };
}

function buildContextContract(params: {
    snapshot: ChatContextSnapshot;
    intentEnvelope: IntentEnvelope;
    querySignals: QuerySignals;
}): ChatContextContract {
    const { snapshot, intentEnvelope, querySignals } = params;
    const required = new Set<ChatContextBlockName>();
    const optional = new Set<ChatContextBlockName>();
    const hasSocialInput = Boolean(snapshot.runtime?.socialInput);
    const hasSocialImages = Array.isArray(snapshot.runtime?.socialInput?.images) && snapshot.runtime.socialInput.images.length > 0;
    const needsImagePromptPlaybook = querySignals.imagePrompting || querySignals.imageGeneration;

    const mode: ChatContextContract['mode'] = (() => {
        if (isLeanFallbackIntent(intentEnvelope.primary_intent) && !needsImagePromptPlaybook && !hasSocialInput) return 'lean';
        if (intentEnvelope.primary_intent === 'meta_debug') return 'debug';
        if (intentEnvelope.execution_risk === 'mutation') return 'execution';
        if (intentEnvelope.domain === 'x' || intentEnvelope.domain === 'farcaster' || hasSocialInput) return 'social';
        return 'analysis';
    })();

    if (mode === 'analysis' || mode === 'execution') {
        required.add('workflow_state');
        required.add('skill_prompts');
        required.add('execution_plan');
        required.add('user_context');
    } else if (mode === 'debug') {
        required.add('workflow_state');
        required.add('user_context');
    } else if (mode === 'social') {
        required.add('workflow_state');
        required.add('user_context');
    }

    if (mode === 'execution') {
        required.add('user_settings');
    }

    if (needsImagePromptPlaybook) {
        required.add('skill_prompts');
    }

    if (intentEnvelope.primary_intent === 'wallet_analysis') {
        required.add('wallet_state');
    }
    if (intentEnvelope.primary_intent === 'image_generation' || intentEnvelope.primary_intent === 'image_prompting') {
        optional.add('social_images');
    }
    if (intentEnvelope.primary_intent === 'token_analysis' || intentEnvelope.primary_intent === 'token_risk') {
        required.add('token_context');
    }
    if (intentEnvelope.primary_intent === 'swap_execution' || intentEnvelope.primary_intent === 'copytrade_execution') {
        required.add('wallet_state');
        required.add('token_context');
    }
    if (intentEnvelope.primary_intent === 'token_deploy') {
        required.add('wallet_state');
        required.add('token_context');
        required.add('launchpad_context');
        required.add('user_settings');
    }
    if (intentEnvelope.primary_intent === 'polymarket_order') {
        required.add('user_settings');
    }
    if (intentEnvelope.domain === 'zora') {
        required.add('token_context');
    }

    if (querySignals.socialChainEvidence || intentEnvelope.domain === 'x' || intentEnvelope.domain === 'farcaster') {
        optional.add('provider_native_evidence');
    }
    if (hasSocialInput) {
        optional.add('social_thread_context');
    }
    if (hasSocialImages) {
        optional.add('social_images');
    }

    const reason = (() => {
        if (mode === 'lean') return 'plain direct-answer turn';
        if (mode === 'debug') return 'assistant behavior explanation turn';
        if (mode === 'execution') return 'mutation workflow';
        if (mode === 'social') return 'social-thread aware turn';
        return 'specialist analysis turn';
    })();

    return {
        mode,
        requiredContexts: Array.from(required),
        optionalContexts: Array.from(optional),
        reason,
    };
}

function attachContextReadTools(params: {
    contextContract: ChatContextContract;
    availableToolNames: Set<string>;
    allowedTools: string[];
    preferredTools: string[];
}) {
    const { contextContract, availableToolNames, allowedTools, preferredTools } = params;
    const requiredContextTools = Array.from(new Set(
        (contextContract.requiredContexts || [])
            .map((contextName) => CONTEXT_READ_TOOL_BY_BLOCK[contextName])
            .filter((toolName): toolName is string => typeof toolName === 'string' && availableToolNames.has(toolName)),
    ));
    const optionalContextTools = Array.from(new Set(
        (contextContract.optionalContexts || [])
            .map((contextName) => CONTEXT_READ_TOOL_BY_BLOCK[contextName])
            .filter((toolName): toolName is string => typeof toolName === 'string' && availableToolNames.has(toolName)),
    ));

    for (const toolName of [...requiredContextTools, ...optionalContextTools]) {
        if (!allowedTools.includes(toolName)) {
            allowedTools.push(toolName);
        }
    }
    for (let index = requiredContextTools.length - 1; index >= 0; index -= 1) {
        prependPreferred(preferredTools, requiredContextTools[index]!);
    }
    for (const toolName of optionalContextTools) {
        pushPreferred(preferredTools, toolName);
    }
}

function buildToolPhasePolicy(
    snapshot: ChatContextSnapshot,
    tradingIntent: TradingIntent | null,
    intentEnvelope: IntentEnvelope,
): ToolPhasePolicy {
    const supportsNativeSearch = String(snapshot.model || '').toLowerCase().includes('grok');
    const confirmationKind = String(snapshot.confirmationState?.kind || '');
    const executionReady = intentEnvelope.execution_risk === 'mutation'
        && intentEnvelope.required_evidence.length === 0
        && (
            tradingIntent?.kind === 'trade_confirmation'
            || confirmationKind === 'swap_confirmation'
            || confirmationKind === 'copy_trade_confirmation'
            || confirmationKind === 'order_confirmation'
        );

    if (executionReady) {
        return {
            initialPhase: 'execution',
            nextPhaseAfterNativeSearch: null,
            searchRetryLimit: 2,
        };
    }

    if (supportsNativeSearch && shouldPreferLocalTokenLeaderboard(snapshot, intentEnvelope)) {
        return {
            initialPhase: 'local_analysis',
            nextPhaseAfterNativeSearch: null,
            searchRetryLimit: 0,
        };
    }

    if (
        supportsNativeSearch
        && intentEnvelope.primary_intent === 'social_discovery'
        && (intentEnvelope.domain === 'x' || intentEnvelope.domain === 'farcaster')
    ) {
        return {
            initialPhase: 'native_search_only',
            nextPhaseAfterNativeSearch: requiresPostSearchLocalAnalysis(intentEnvelope) ? 'local_analysis' : null,
            searchRetryLimit: 2,
        };
    }

    if (
        supportsNativeSearch
        && (
        intentEnvelope.search_mode === 'required'
        || intentEnvelope.domain === 'x'
        || intentEnvelope.search_target === 'web'
        || intentEnvelope.search_target === 'x'
        || intentEnvelope.search_target === 'x_and_web'
        )
    ) {
        return {
            initialPhase: 'native_search_only',
            nextPhaseAfterNativeSearch: requiresPostSearchLocalAnalysis(intentEnvelope) ? 'local_analysis' : null,
            searchRetryLimit: 2,
        };
    }

    return {
        initialPhase: 'local_analysis',
        nextPhaseAfterNativeSearch: null,
        searchRetryLimit: 2,
    };
}

function requiresPostSearchLocalAnalysis(intentEnvelope: IntentEnvelope): boolean {
    if (intentEnvelope.domain === 'x') {
        return true;
    }
    return intentEnvelope.required_evidence.some((item) => item !== 'native_search_results')
        || ['token_analysis', 'token_risk', 'wallet_analysis', 'polymarket_discovery', 'polymarket_order'].includes(intentEnvelope.primary_intent);
}

function describePhasePolicy(toolPhasePolicy: ToolPhasePolicy): string {
    if (toolPhasePolicy.initialPhase === 'native_search_only') {
        return `Current tool package starts in provider-native search only, then moves to ${toolPhasePolicy.nextPhaseAfterNativeSearch || 'final answer'} once the required evidence is gathered.`;
    }
    if (toolPhasePolicy.initialPhase === 'execution') {
        return 'Current tool package is in execution mode. Only the approved mutation tools for this canonical intent are allowed in this turn.';
    }
    return 'Current tool package starts with local analysis tools. Search remains gated by the phase policy.';
}

function shouldPreferLocalTokenLeaderboard(snapshot: ChatContextSnapshot, intentEnvelope: IntentEnvelope): boolean {
    if (intentEnvelope.execution_risk !== 'read_only') return false;
    const query = String(snapshot.lastUserMessage || '').trim();
    if (!TOKEN_LEADERBOARD_QUERY_RE.test(query)) return false;
    if (EXPLICIT_SOCIAL_SOURCE_QUERY_RE.test(query)) return false;
    if (EXPLICIT_SEARCH_QUERY_RE.test(query)) return false;
    const hasLocalLeaderboardTool = (snapshot.toolDefinitions || []).some((definition) => definition.name === 'get_trending_tokens');
    if (!hasLocalLeaderboardTool) return false;
    if (intentEnvelope.domain === 'token') {
        return ['search_discovery', 'social_discovery', 'token_analysis'].includes(intentEnvelope.primary_intent);
    }
    if (intentEnvelope.domain !== 'general') return false;
    return isLeanFallbackIntent(intentEnvelope.primary_intent);
}

function ensurePrimarySkill(selected: string[], skillId: string) {
    if (selected[0] === skillId) return;
    const filtered = selected.filter((item) => item !== skillId);
    filtered.unshift(skillId);
    selected.splice(0, selected.length, ...filtered);
}

function prependPreferred(preferredTools: string[], toolName: string) {
    removeTool(preferredTools, toolName);
    preferredTools.unshift(toolName);
}

function ensureSupportingSkill(selected: string[], skillId: string) {
    if (!selected.includes(skillId)) {
        selected.push(skillId);
    }
}

function pushPreferred(target: string[], toolName: string) {
    if (!target.includes(toolName)) {
        target.push(toolName);
    }
}

function removeTool(target: string[], toolName: string) {
    let index = target.indexOf(toolName);
    while (index !== -1) {
        target.splice(index, 1);
        index = target.indexOf(toolName);
    }
}

function isSyntheticBlockedTool(toolName: string): boolean {
    return ['external_web_search'].includes(String(toolName || '').trim());
}

function pushPreferredToolsForSkill(skillId: string, preferredTools: string[]) {
    const skill = skillRegistryExec.getSkill(skillId);
    if (!skill) return;
    for (const toolName of skill.metadata.tools || []) {
        pushPreferred(preferredTools, toolName);
    }
}
