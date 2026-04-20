// CONTEXT MEMORY
// Updated: 2026-04-20
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
// - Image prompt-coaching turns should explicitly read `read_skill_prompts` before answering so the OpenAI-aligned playbook actually reaches the model.
// - OpenAI-first prompt coaching should not volunteer Midjourney/SD/other-model rewrites unless the user asked for them.
// - Image prompt coaching is not a lean direct-answer turn; it must get a specialist context contract.
// - Specialist execution turns should collapse into a fixed template once the task mode is clear.
// - Required context should be gathered once and then carried forward until a hard blocker appears.
// - Prompt text must not encourage the model to restart discovery after every tool result.
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
// - Source: OpenAI GPT-image-1.5 Prompting Guide
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
import type { TradingIntent } from './tradingIntentResolver.js';

export type IntentPrimaryIntent =
    | 'model_selected_task_menu'
    | 'meta_debug'
    | 'search_discovery'
    | 'social_discovery'
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
const EXPLICIT_TRADE_ACTION_QUERY_RE = /\b(buy|sell|swap|bridge|trade)\b|买入|卖出|买\b|卖\b|换币|兑换|交换|跨链|交易/i;

function isModelSelectedTaskMenuIntent(intent: IntentPrimaryIntent | null | undefined): boolean {
    return intent === 'model_selected_task_menu';
}

function isLeanFallbackIntent(intent: IntentPrimaryIntent | null | undefined): boolean {
    return intent === 'general_answer' || isModelSelectedTaskMenuIntent(intent);
}

export function resolveNodeSkills(snapshot: ChatContextSnapshot, tradingIntent: TradingIntent | null, canonicalIntent?: CanonicalIntent | null): SkillResolution {
    const isGrok = String(snapshot.model || '').toLowerCase().includes('grok');
    const rawQuery = String(snapshot.lastUserMessage || '');
    const asksDetailedOnboarding = DETAILED_ONBOARDING_QUERY_RE.test(rawQuery);
    const asksProfitRankingFollowup = /\b(pnl|profit|roi|rank|earned?)\b/i.test(rawQuery) || /收益|盈利|利润|利益|获利|赚(?:了)?多少|回报|回报率|排名|排行/.test(rawQuery);
    const asksWalletTradeSummaryFollowup = /\b(buy|sell|bought|sold|trade summary|trading summary)\b/i.test(rawQuery) || /买入|卖出|交易汇总|买卖汇总/.test(rawQuery);
    const normalizedIntent = canonicalIntent || snapshot.normalizedIntent || null;
    const inheritsEntitiesFromContext = normalizedIntent?.inheritEntitiesFromContext ?? true;
    const effectiveRequestedTokenAddresses = inheritsEntitiesFromContext
        ? (snapshot.requestedTokenAddresses || [])
        : (normalizedIntent?.entities?.tokenAddresses || []);
    const effectiveRequestedTokenSymbols = inheritsEntitiesFromContext
        ? (snapshot.requestedTokenSymbols || [])
        : (normalizedIntent?.entities?.tokenSymbols || []);
    const availableToolNames = new Set((snapshot.toolDefinitions || []).map((definition) => String(definition.name || '').trim()).filter(Boolean));
    const blockedTools: string[] = [];
    const preferredTools: string[] = [];
    const strategyNotes: string[] = [];
    let allowAllTools = false;
    const strictPolicy = snapshot.policySnapshot?.enforcementLevel === 'hard';
    const sessionToolNames = Array.from(new Set(
        (snapshot.recentToolTrace?.toolCalls || [])
            .map((call) => String(call?.tool || '').trim())
            .filter((toolName) => toolName && availableToolNames.has(toolName)),
    ));
    const hasRequestedTokenAddress = effectiveRequestedTokenAddresses.length > 0;
    const refersToPriorWalletSet = /\b(these|those|them|their)\b/i.test(rawQuery) || /这些|它们|他们|这批|这几个|这群/.test(rawQuery);

    const matchResult = matchSkillsForQuery({ snapshot: normalizedIntent ? { ...snapshot, normalizedIntent } : snapshot, tradingIntent });
    const querySignals = matchResult.querySignals;
    const explicitRiskRequest = querySignals.risk;
    const asksWalletPnl = querySignals.pnl;
    const hasRequestedToken = querySignals.hasRequestedToken;
    const requiresSocialChainEvidence = querySignals.socialChainEvidence;
    if (querySignals.imageGeneration) {
        strategyNotes.push('This turn is an image-generation request. If the user is clearly asking for a visual asset, optimize the prompt into structured image direction and call generate_image_from_intent directly.');
        strategyNotes.push('Do not ask for a second confirmation before generating. If a truly critical visual field is missing, ask one precise clarification instead of calling the tool.');
        strategyNotes.push('If prompt structure is still weak before generation, call read_skill_prompts first so the request follows the OpenAI-aligned image prompting playbook.');
    }
    if (querySignals.imagePrompting && !querySignals.imageGeneration) {
        strategyNotes.push('This turn is asking for image prompt guidance, not automatic image execution. Call read_skill_prompts before answering so the rewrite follows the OpenAI-aligned image prompting playbook.');
        strategyNotes.push('Return one copy-ready prompt, the negative constraints, and a few single-variable refinements. Do not call generate_image_from_intent unless the user explicitly asks to generate now.');
        strategyNotes.push('Do not volunteer Midjourney, Stable Diffusion, or other non-OpenAI prompt variants unless the user explicitly asks for another model.');
    }
    if (querySignals.clankerDeploy) {
        strategyNotes.push('This is a Clanker launch or Clanker history request. Follow the Clanker launch safety template: collect only hard-missing launch inputs, keep optional defaults implicit, prepare a dry-run preview first, and wait for explicit user confirmation before any real deploy. Do not restate this internal checklist to the user.');
    }
    const requestedChain = resolveCanonicalChainRef({
        canonicalIntent: normalizedIntent,
        requestedTokenAddresses: effectiveRequestedTokenAddresses,
        requestedTokenSymbols: effectiveRequestedTokenSymbols,
        runtimeChainId: snapshot.runtime.chainId,
        runtimeChainName: snapshot.runtime.chainName,
    });
    const explicitlyMentionsFarcaster = normalizedIntent?.domain === 'farcaster';
    const preferXNativeSearch = normalizedIntent
        ? (normalizedIntent.searchTarget === 'x' || normalizedIntent.searchTarget === 'x_and_web' || normalizedIntent.domain === 'x')
        : false;
    const asksEarlyBuyerWalletPnlFollowup = sessionToolNames.includes('get_early_buyers')
        && hasRequestedToken
        && refersToPriorWalletSet
        && (querySignals.pnl || asksProfitRankingFollowup || asksWalletTradeSummaryFollowup);
    const asksEarlyBuyers = normalizedIntent?.intent === 'early_buyers' && !asksEarlyBuyerWalletPnlFollowup;
    const explicitEarlyBuyerRowCount = normalizedIntent?.rowCount ?? null;
    const explicitlyRequestsEarlyBuyerFullList = normalizedIntent?.outputMode === 'full_table'
        || (asksEarlyBuyers && explicitEarlyBuyerRowCount !== null);
    const wantsEarlyBuyerFullList = asksEarlyBuyers || explicitlyRequestsEarlyBuyerFullList;
    const normalizedTokenSymbols = Array.isArray(normalizedIntent?.entities?.tokenSymbols)
        ? normalizedIntent!.entities.tokenSymbols.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
    const requestedTokenSymbols = Array.isArray(effectiveRequestedTokenSymbols)
        ? effectiveRequestedTokenSymbols.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
    const hasExplicitPolymarketCoinSelection = normalizedTokenSymbols.length > 0 || requestedTokenSymbols.length > 0;
    const asksCreator = normalizedIntent?.intent === 'creator_analysis';
    const shouldConstrainToolExposure = querySignals.welcome || querySignals.metaDebug;

    let selected = matchResult.rankedMatches.map((item) => item.skillId);
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

    if (tradingIntent) {
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
    } else {
        if (querySignals.imageGeneration) {
            ensurePrimarySkill(selected, 'image_generation');
            ensureSupportingSkill(selected, 'image_prompting');
        } else if (querySignals.imagePrompting) {
            ensurePrimarySkill(selected, 'image_prompting');
        }
        if (querySignals.wallet || asksWalletPnl) {
            ensurePrimarySkill(selected, 'wallet_portfolio');
        }
        if (explicitRiskRequest) {
            ensureSupportingSkill(selected, 'risk_security');
        }
        if (hasRequestedToken) {
            ensureSupportingSkill(selected, 'token_analysis');
        }
        if ((asksProfitRankingFollowup || asksWalletTradeSummaryFollowup) && sessionToolNames.includes('get_early_buyers')) {
            ensurePrimarySkill(selected, 'wallet_portfolio');
            if (hasRequestedToken) {
                ensureSupportingSkill(selected, 'token_analysis');
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

    const polymarketShortWindowQuery = normalizedIntent?.intent === 'polymarket_short_window';
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
    const polymarketOrderQuery = normalizedIntent?.intent === 'polymarket_order';
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
        if (normalizedIntent?.timeContext?.isTimeBound) {
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
        for (const toolName of sessionToolNames) {
            if (!allowedTools.includes(toolName)) {
                allowedTools.push(toolName);
            }
        }
        for (const toolName of sessionToolNames) {
            pushPreferred(preferredTools, toolName);
        }
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
        tradingIntent,
        canonicalIntent: normalizedIntent,
        querySignals,
        searchMode: effectiveSearchMode,
        preferXNativeSearch,
        explicitlyMentionsFarcaster,
        explicitRiskRequest,
        asksWalletPnl,
        hasRequestedToken,
        selectedSkills: selected,
    });
    const contextContract = buildContextContract({
        snapshot,
        tradingIntent,
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
    const toolPhasePolicy = buildToolPhasePolicy(snapshot, tradingIntent, intentEnvelope, Boolean(normalizedIntent));
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
    };
}

function buildIntentEnvelope(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
    canonicalIntent: CanonicalIntent | null;
    querySignals: QuerySignals;
    searchMode: SearchMode;
    preferXNativeSearch: boolean;
    explicitlyMentionsFarcaster: boolean;
    explicitRiskRequest: boolean;
    asksWalletPnl: boolean;
    hasRequestedToken: boolean;
    selectedSkills: string[];
}): IntentEnvelope {
    // CONTEXT MEMORY
    // Updated: 2026-04-20
    // Status: verified
    // Why: TASK_MENU routing makes the main model own task selection, so this
    // function must stop fabricating a business intent for unresolved turns.
    // Debug Goal: unresolved model-led turns keep backend safety/search gates
    // without claiming `general_answer` as if the backend had classified them.
    // Search Tags: model selected task menu unresolved intent envelope general_answer fallback
    // Invariants:
    // - Canonical intents and explicit mutation/search routes still map to concrete envelopes.
    // - Catch-all fallback must stay neutral and preserve model-owned task choice.
    // Failure Modes:
    // - A generic fallback reappears and overrides model task selection.
    // - Prompt/context layers silently coerce unresolved turns back to general_answer.
    const {
        snapshot,
        tradingIntent,
        canonicalIntent,
        querySignals,
        searchMode,
        preferXNativeSearch,
        explicitlyMentionsFarcaster,
        explicitRiskRequest,
        asksWalletPnl,
        hasRequestedToken,
        selectedSkills,
    } = params;

    if (canonicalIntent) {
        const canonicalPrimary = (() => {
            switch (canonicalIntent.intent) {
                case 'assistant_meta':
                    return canonicalIntent.taskMode === 'analyze'
                        ? 'meta_debug' as const
                        : 'general_answer' as const;
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

    if (tradingIntent?.type === 'copy_trade') {
        return {
            primary_intent: 'copytrade_execution',
            task_mode: tradingIntent.kind === 'trade_confirmation' ? 'confirm' : 'execute',
            search_mode: searchMode,
            search_target: 'none',
            domain: 'wallet',
            execution_risk: 'mutation',
            required_evidence: [],
        };
    }
    if (tradingIntent?.type === 'swap' || tradingIntent?.type === 'cross_chain_trade') {
        return {
            primary_intent: 'swap_execution',
            task_mode: tradingIntent.kind === 'trade_confirmation' ? 'confirm' : 'execute',
            search_mode: searchMode,
            search_target: 'none',
            domain: hasRequestedToken ? 'token' : 'general',
            execution_risk: 'mutation',
            required_evidence: [],
        };
    }
    if (querySignals.clankerDeploy) {
        return {
            primary_intent: 'token_deploy',
            task_mode: 'execute',
            search_mode: searchMode,
            search_target: 'none',
            domain: 'token',
            execution_risk: 'mutation',
            required_evidence: [],
        };
    }
    const rawQuery = String(snapshot.lastUserMessage || '');
    const selectedSet = new Set(selectedSkills);
    if (selectedSet.has('swap') && querySignals.swap && EXPLICIT_TRADE_ACTION_QUERY_RE.test(rawQuery)) {
        return {
            primary_intent: 'swap_execution',
            task_mode: 'execute',
            search_mode: searchMode,
            search_target: 'none',
            domain: hasRequestedToken ? 'token' : 'general',
            execution_risk: 'mutation',
            required_evidence: [],
        };
    }
    if (selectedSet.has('copy_trade') && querySignals.copyTrade) {
        return {
            primary_intent: 'copytrade_execution',
            task_mode: 'execute',
            search_mode: searchMode,
            search_target: 'none',
            domain: 'wallet',
            execution_risk: 'mutation',
            required_evidence: [],
        };
    }
    if (selectedSet.has('wallet_portfolio') && (querySignals.wallet || asksWalletPnl)) {
        return {
            primary_intent: 'wallet_analysis',
            task_mode: 'analyze',
            search_mode: searchMode,
            search_target: 'none',
            domain: 'wallet',
            execution_risk: 'read_only',
            required_evidence: ['onchain_wallet_evidence'],
        };
    }
    if (selectedSet.has('token_analysis') && (hasRequestedToken || querySignals.tokenAnalysis)) {
        return {
            primary_intent: explicitRiskRequest ? 'token_risk' : 'token_analysis',
            task_mode: 'analyze',
            search_mode: searchMode,
            search_target: 'none',
            domain: 'token',
            execution_risk: 'read_only',
            required_evidence: ['onchain_token_evidence'],
        };
    }
    if (selectedSet.has('polymarket_prediction') || querySignals.prediction) {
        return {
            primary_intent: 'polymarket_discovery',
            task_mode: 'discover',
            search_mode: searchMode,
            search_target: searchMode === 'forbidden' ? 'none' : 'web',
            domain: 'polymarket',
            execution_risk: 'read_only',
            required_evidence: searchMode === 'forbidden' ? [] : ['native_search_results'],
        };
    }
    if (selectedSet.has('social_farcaster') || querySignals.social) {
        return {
            primary_intent: 'social_discovery',
            task_mode: 'discover',
            search_mode: searchMode,
            search_target: preferXNativeSearch ? 'x' : searchMode === 'forbidden' ? 'none' : 'x_and_web',
            domain: explicitlyMentionsFarcaster ? 'farcaster' : querySignals.xSearch ? 'x' : 'general',
            execution_risk: 'read_only',
            required_evidence: searchMode === 'forbidden' ? [] : ['native_search_results'],
        };
    }
    if (selectedSet.has('market_macro') || searchMode === 'required') {
        return {
            primary_intent: 'search_discovery',
            task_mode: 'discover',
            search_mode: searchMode,
            search_target: querySignals.xSearch ? 'x' : querySignals.webSearch ? 'web' : searchMode === 'forbidden' ? 'none' : 'web',
            domain: querySignals.market ? 'market' : 'general',
            execution_risk: 'read_only',
            required_evidence: searchMode === 'forbidden' ? [] : ['native_search_results'],
        };
    }

    return {
        primary_intent: 'model_selected_task_menu',
        task_mode: 'discover',
        search_mode: searchMode,
        search_target: 'none',
        domain: 'general',
        execution_risk: 'read_only',
        required_evidence: [],
    };
}

function buildContextContract(params: {
    snapshot: ChatContextSnapshot;
    tradingIntent: TradingIntent | null;
    intentEnvelope: IntentEnvelope;
    querySignals: QuerySignals;
}): ChatContextContract {
    const { snapshot, tradingIntent, intentEnvelope, querySignals } = params;
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

    if (intentEnvelope.primary_intent === 'wallet_analysis') {
        required.add('wallet_state');
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
    hasCanonicalIntent: boolean,
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
        return `Model chooses one or more tasks from TASK_MENU. Backend safety phase: start with provider-native search only, then move to ${toolPhasePolicy.nextPhaseAfterNativeSearch || 'final answer'} once evidence is gathered.`;
    }
    if (toolPhasePolicy.initialPhase === 'execution') {
        return 'Model chooses one or more tasks from TASK_MENU. Backend safety phase: execution is allowed only for the approved mutation tools in this turn.';
    }
    return 'Model chooses one or more tasks from TASK_MENU. Backend safety phase: start with local analysis tools; search stays gated by the phase policy.';
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
