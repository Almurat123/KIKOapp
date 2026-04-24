import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { PythonGenerationClient } from './pythonGenerationClient.js';
import type { GenerationMessage } from './nodePromptAssembler.js';
import { extractEffectiveUserQuery } from './conversationStateResolver.js';
import {
    applyTaskRouteToSnapshot,
    type TaskRoute,
    type TaskRouteFacet,
    type TaskRouteSelectionReasonCode,
    type TaskRouteSelectionState,
    validateTaskRoutePayload,
} from './taskRoute.js';

export async function selectTaskRoute(args: {
    snapshot: ChatContextSnapshot;
    generationClient: Pick<PythonGenerationClient, 'generate'>;
    shouldCancel?: () => Promise<boolean>;
    onReasoningDelta?: (text: string) => Promise<void> | void;
}): Promise<{
    snapshot: ChatContextSnapshot;
    state: TaskRouteSelectionState;
}> {
    const { snapshot, generationClient, shouldCancel, onReasoningDelta } = args;
    const messages = buildRouteSelectionMessages(snapshot);
    logger.info(LogCode.AI_ORCHESTRATOR, 'Task route selection: start', {
        sessionId: snapshot.sessionId,
        taskId: snapshot.taskId,
        model: snapshot.model,
        requestedTokenAddresses: snapshot.requestedTokenAddresses.length,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
    });
    try {
        let streamedReasoning = '';
        const result = await generationClient.generate({
            sessionId: snapshot.sessionId,
            taskId: `${snapshot.taskId}:route`,
            model: snapshot.model,
            messages,
            tools: [],
            providerOptions: {
                enable_search: false,
                metadata: {
                    phase: 'task_route_selection',
                },
            },
            shouldCancel,
            onTextDelta: async () => {},
            onReasoningDelta: async (text) => {
                if (!text) return;
                streamedReasoning += text;
                await onReasoningDelta?.(text);
            },
            onUsage: () => {},
            onCitation: () => {},
        });
        const rawText = String(result.text || '').trim();
        const reasoningText = String(result.reasoning || streamedReasoning || '').trim() || undefined;
        const parsed = parseTaskRouteJson(rawText);
        if (!parsed.ok) {
            return invalidResult(snapshot, parsed.reasonCode, parsed.error, rawText, reasoningText);
        }
        const validated = validateTaskRoutePayload(parsed.payload, snapshot);
        if (!validated.ok) {
            return invalidResult(snapshot, validated.reasonCode, validated.error, rawText, reasoningText);
        }
        const deterministicRoute = buildDeterministicRouteOverride(snapshot, validated.route);
        const route = deterministicRoute || validated.route;
        const selectedSnapshot = applyTaskRouteToSnapshot(snapshot, route);
        const state: TaskRouteSelectionState = {
            status: 'ok',
            source: deterministicRoute ? 'deterministic' : 'llm',
            rawText,
            reasoningText,
        };
        selectedSnapshot.taskRouteSelectionState = state;
        logger.info(LogCode.AI_ORCHESTRATOR, 'Task route selection: success', {
            sessionId: snapshot.sessionId,
            taskId: snapshot.taskId,
            owner: route.owner,
            phase: route.phase,
            facets: route.facets,
            confidence: route.confidence,
            routeSource: state.source,
            originalOwner: validated.route.owner,
            originalPhase: validated.route.phase,
        });
        return {
            snapshot: selectedSnapshot,
            state,
        };
    } catch (error: any) {
        return invalidResult(
            snapshot,
            'task_route_invalid_json',
            error?.message || 'Task route selection failed',
            undefined,
            undefined,
        );
    }
}

function invalidResult(
    snapshot: ChatContextSnapshot,
    reasonCode: TaskRouteSelectionReasonCode,
    error: string,
    rawText?: string,
    reasoningText?: string,
): {
    snapshot: ChatContextSnapshot;
    state: TaskRouteSelectionState;
} {
    logger.warn(LogCode.AI_ORCHESTRATOR, 'Task route selection: invalid', {
        sessionId: snapshot.sessionId,
        taskId: snapshot.taskId,
        reasonCode,
        error,
        rawTextPreview: rawText?.slice(0, 240),
    });
    const state: TaskRouteSelectionState = {
        status: 'invalid',
        source: 'llm',
        reasonCode,
        error,
        rawText,
        reasoningText,
    };
    return {
        snapshot: {
            ...snapshot,
            taskRoute: null,
            taskRouteSelectionState: state,
        },
        state,
    };
}

function buildRouteSelectionMessages(snapshot: ChatContextSnapshot): GenerationMessage[] {
    const recentHistory = snapshot.history.slice(-6).map((message) => ({
        role: message.role,
        content: message.role === 'user'
            ? extractEffectiveUserQuery(String(message.content || '')).slice(0, 600)
            : String(message.content || '').slice(0, 600),
    }));
    const socialImages = normalizeRouteSelectionSocialImages(snapshot);
    const hasSocialImages = socialImages.length > 0;
    const payload = JSON.stringify({
        latest_user_message: extractEffectiveUserQuery(snapshot.lastUserMessage),
        recent_history: recentHistory,
        requested_token_addresses: snapshot.requestedTokenAddresses || [],
        requested_token_symbols: snapshot.requestedTokenSymbols || [],
        requested_address_classifications: snapshot.requestedAddressClassifications || [],
        current_surface: snapshot.runtime?.currentPage || null,
        page_context: snapshot.runtime?.pageContext || null,
        has_social_input: Boolean(snapshot.runtime?.socialInput),
        has_social_images: hasSocialImages,
        social_images: socialImages.map((image, index) => ({
            index: index + 1,
            label: image.label,
            url: image.url,
        })),
        connected_chain_id: snapshot.runtime?.chainId || null,
        connected_chain_name: snapshot.runtime?.chainName || null,
        wallet_address: snapshot.runtime?.walletAddress || snapshot.runtime?.userAddress || null,
        confirmation_state: snapshot.confirmationState || null,
        return_schema: {
            owner: 'enum',
            phase: 'enum',
            facets: ['enum'],
            confidence: '0_to_1_number',
            explanation: 'string',
            entities: {
                token_addresses: ['string'],
                token_symbols: ['string'],
                wallet_addresses: ['string'],
                market_identifiers: ['string'],
                image_refs: ['string'],
            },
            requested_chain: {
                chain_id: 'number',
                chain_name: 'string',
            },
            requested_time_window: {
                is_time_bound: 'boolean',
                description: 'string',
                start_time: 'optional_iso_string',
                end_time: 'optional_iso_string',
            },
            row_count: 'number_or_null',
            inherit_entities_from_context: 'boolean',
            locale: 'en_or_zh',
            needs_clarification: 'boolean',
            clarification_question: 'string_or_null',
        },
    });
    return [
        {
            role: 'system',
            content: [
                'You choose one primary task route for a multilingual user request.',
                'Return JSON only. No markdown. No prose before or after the JSON.',
                'Choose exactly one owner. Facets modify the owner; they never replace it.',
                'For long prompts, prefer the concrete deliverable or action the user wants most now.',
                'Attached images, @mentions, social thread wrappers, and transport metadata are context only.',
                'If the user wants an output image now, owner=image even when token/social context exists.',
                'If the user only wants image prompt help or rewriting, owner=image with facet=prompt_only; this facet is only an advisory hint inside the image lane.',
                'If the user asks about the assistant, previous reply, runtime, fallback, or why the system behaved a certain way, owner=assistant_meta.',
                'If the user wants token early buyers, creator analysis, token risk, or token evidence, owner=token and use facets to specify subfocus.',
                'If the user wants wallet PnL or wallet-specific analysis, owner=wallet.',
                'If the user wants buy/sell/swap execution, owner=swap. Use facet=cross_chain when needed.',
                'If the user wants copy-trade configuration, owner=copy_trade.',
                'If the user wants a Polymarket answer or order, owner=polymarket.',
                'If the user wants a generic token launch, owner=token_deploy. Runtime provider mapping is chain-based: Base -> Clanker, BNB Chain / BSC -> Four.meme. For explicit X/Farcaster @mention agent launch requests, use phase=execute so the task can complete in one social reply when required fields are present.',
                'Use owner=general_answer only for ordinary direct answers that do not need a specialist owner.',
                'Use phase=answer | analyze | execute | confirm.',
                'answer = ordinary response or capability answer; analyze = research/investigation/evidence gathering; execute = do the task now; confirm = user is confirming a prepared action.',
                'Allowed owners: assistant_meta | general_answer | image | social | token | wallet | swap | copy_trade | polymarket | token_deploy | zora | market',
                'Allowed facets: prompt_only | reference_image | social_thread | social_images | realtime | onchain | full_list | wallet_followup | creator_focus | early_buyers | risk_review | cross_chain | short_window | capabilities | behavior_debug',
                'Use social_images when current-turn social images are relevant. Use reference_image when those images or explicit reference images should guide image generation/editing.',
                'Use realtime only when the user is asking for fresh/current/latest public information.',
                'Use onchain only when chain-side evidence is materially required.',
                'Set inherit_entities_from_context=true only when this turn is genuinely continuing the same token, wallet, market, or social thread subject.',
                'If ambiguous, set needs_clarification=true with one short clarification_question.',
            ].join(' '),
        },
        {
            role: 'user',
            content: buildRouteSelectionUserContent(payload, socialImages),
        },
    ];
}

const IMAGE_PROMPT_ADVICE_RE = /\b(?:prompt|prompts|image prompt)\b.{0,32}\b(?:how|write|writing|improve|optimi[sz]e|tutorial|guide|better)\b|\b(?:how|write|writing|improve|optimi[sz]e)\b.{0,32}\b(?:prompt|image prompt)\b|(?:图片|出图|海报|封面|插画|视觉稿)?提示词.{0,24}(?:怎么写|教程|优化|写法|模板|指南)|(?:怎么写|优化|改写).{0,24}(?:图片|出图|海报|封面|插画|视觉稿)?提示词|给我(?:写|改写|优化)一个(?:图片|出图|海报|封面|插画|视觉稿)?提示词/i;
const IMAGE_NOW_RE = /\b(?:now|right now|directly|immediately|just generate|go ahead)\b|(?:现在|立刻|马上|直接|就生成|开始生成)/i;
const IMAGE_DIRECT_EXECUTION_RE = /\b(?:generate|create|make|design|draw|render|illustrate)\b.{0,80}\b(?:image|picture|poster|cover|illustration|thumbnail|banner|hero|visual|artwork|ad|creative|mockup|photo|photograph|wallpaper|portrait|scene|shot)\b|\b(?:image|picture|poster|cover|illustration|thumbnail|banner|hero|visual|artwork|ad|creative|mockup|photo|photograph|wallpaper|portrait|scene|shot)\b.{0,80}\b(?:generate|create|make|design|draw|render|illustrate)\b|(?:做|生成|画|设计)(?:一张|一个|个)?[^。！？\n]{0,80}(?:图|图片|海报|封面|插画|配图|宣传图|视觉稿|壁纸|头像|照片|场景图)/i;
const IMAGE_REFERENCE_EDIT_RE = /\b(?:edit|restyle|transform|replace|remove|erase|extend|inpaint|outpaint|photoshop|composite|remix|reimagine|place|put|turn)\b|\bmake\b.{0,32}\blook\b|(?:改图|修图|修照片|改照片|图像编辑|图片编辑|替换背景|去掉背景|换背景|扩图|补图|抠图|把.+变成|把.+放到|换成|放到|放在|合成|变成|做成)/i;
const IMAGE_CONTINUATION_EXECUTION_RE = /\b(?:regenerate|generate again|try again|rerun|redo|remake|make another|again)\b|(?:再生成|重新生成|重生成|重画|重新画|按原图|按上一张|按刚才|再来一张|再来一次|换一版|重做|重新做|继续生成)/i;
const META_QUESTION_RE = /\b(?:why|what happened|how come)\b|(?:为什么|怎么回事|咋回事|怎么没有|为什么没|为何)/i;
const WALLET_QUERY_RE = /(\b(wallet|balance|balances|holdings|portfolio|pnl|profit|loss|position|positions|asset|assets)\b|钱包|余额|持仓|资产|收益|利润|亏损|仓位)/i;
const WALLET_CONTINUATION_RE = /(?:上下文|context|继续|接着|然后呢|那现在|这次呢|再看|再查|看不到|没看到|基于这个|按这个|用这个|继续说|继续看|钱包里|资产里)/i;
const CAPABILITY_OR_ONBOARDING_RE = /(?:\bwhat can you do\b|\bcapabilit(?:y|ies)\b|\bwho are you\b|你是谁|你能做什么|你会什么)/i;
const WALLET_CONTEXT_TOOLS = new Set(['read_wallet_state', 'get_wallet_info', 'analyze_wallet_pnl', 'analyze_wallet_pnl_batch']);

function buildDeterministicRouteOverride(snapshot: ChatContextSnapshot, selected: TaskRoute): TaskRoute | null {
    return buildImmediateImageExecutionOverride(snapshot, selected)
        || buildWalletFollowupOverride(snapshot, selected);
}

function buildImmediateImageExecutionOverride(snapshot: ChatContextSnapshot, selected: TaskRoute): TaskRoute | null {
    if (selected.owner === 'image' && selected.phase === 'execute') return null;
    const latest = extractEffectiveUserQuery(snapshot.lastUserMessage);
    if (!latest) return null;

    const hasPromptAdviceOnly = IMAGE_PROMPT_ADVICE_RE.test(latest) && !IMAGE_NOW_RE.test(latest);
    if (hasPromptAdviceOnly) return null;

    const socialImages = normalizeRouteSelectionSocialImages(snapshot);
    const hasCurrentImageInput = socialImages.length > 0 || selected.entities.imageRefs.length > 0;
    const directImageExecution = IMAGE_DIRECT_EXECUTION_RE.test(latest);
    const referenceImageExecution = hasCurrentImageInput && IMAGE_REFERENCE_EDIT_RE.test(latest);
    const continuationExecution = IMAGE_CONTINUATION_EXECUTION_RE.test(latest) && hasPriorImageExecutionContext(snapshot, hasCurrentImageInput);
    const isMetaQuestionWithoutExecution = META_QUESTION_RE.test(latest) && !continuationExecution && !referenceImageExecution;
    if ((!directImageExecution && !referenceImageExecution && !continuationExecution) || isMetaQuestionWithoutExecution) {
        return null;
    }

    const facets = new Set<TaskRouteFacet>(selected.facets.filter((facet) => facet !== 'behavior_debug' && facet !== 'capabilities'));
    if (socialImages.length > 0) facets.add('social_images');
    if (hasCurrentImageInput || referenceImageExecution) facets.add('reference_image');
    if (String(snapshot.runtime?.socialInput?.threadContextText || '').trim()) facets.add('social_thread');
    return {
        ...selected,
        owner: 'image',
        phase: 'execute',
        facets: Array.from(facets),
        entities: {
            ...selected.entities,
            imageRefs: Array.from(new Set([
                ...selected.entities.imageRefs,
                ...socialImages.map((image) => image.url),
            ])),
        },
        inheritEntitiesFromContext: true,
        explanation: [
            'Deterministic image execution override:',
            'the latest user turn explicitly asks for image generation/editing/regeneration,',
            'so assistant_meta/general routing must not hide generate_image_from_intent.',
        ].join(' '),
        confidence: Math.max(selected.confidence, 0.99),
        source: 'deterministic',
    };
}

function buildWalletFollowupOverride(snapshot: ChatContextSnapshot, selected: TaskRoute): TaskRoute | null {
    if (!snapshot.runtime?.socialInput) return null;
    if (!['assistant_meta', 'general_answer'].includes(selected.owner)) return null;
    if (selected.owner === 'assistant_meta' && !selected.facets.includes('behavior_debug')) return null;

    const latest = extractEffectiveUserQuery(snapshot.lastUserMessage).trim();
    if (!latest || CAPABILITY_OR_ONBOARDING_RE.test(latest)) return null;
    if (!hasWalletCarryForwardContext(snapshot)) return null;
    if (!looksLikeWalletCarryForwardFollowup(latest)) return null;

    const facets = new Set<TaskRouteFacet>(selected.facets.filter((facet) => facet !== 'behavior_debug' && facet !== 'capabilities'));
    facets.add('wallet_followup');
    if (String(snapshot.runtime?.socialInput?.threadContextText || '').trim()) {
        facets.add('social_thread');
    }
    return {
        ...selected,
        owner: 'wallet',
        phase: 'answer',
        facets: Array.from(facets),
        inheritEntitiesFromContext: true,
        explanation: [
            'Deterministic wallet follow-up override:',
            'the latest short social-thread turn is continuing prior wallet evidence/context,',
            'so assistant_meta/general routing must not hide read_wallet_state.',
        ].join(' '),
        confidence: Math.max(selected.confidence, 0.98),
        source: 'deterministic',
    };
}

function hasWalletCarryForwardContext(snapshot: ChatContextSnapshot): boolean {
    const recentTools = snapshot.recentToolTrace?.toolCalls || [];
    if (recentTools.some((call) => WALLET_CONTEXT_TOOLS.has(String(call?.tool || '')))) return true;
    if (snapshot.runtime?.prefetchedToolResults?.get_wallet_info) return true;
    const priorHistory = snapshot.history
        .slice(0, Math.max(0, snapshot.history.length - 1))
        .map((message) => `${message.role}: ${message.content || ''}`)
        .join('\n');
    return WALLET_QUERY_RE.test(priorHistory);
}

function looksLikeWalletCarryForwardFollowup(latest: string): boolean {
    if (WALLET_QUERY_RE.test(latest)) return true;
    return Array.from(latest).length <= 24 && WALLET_CONTINUATION_RE.test(latest);
}

function hasPriorImageExecutionContext(snapshot: ChatContextSnapshot, hasCurrentImageInput: boolean): boolean {
    if (hasCurrentImageInput) return true;
    if ((snapshot.recentToolTrace?.toolCalls || []).some((call) => String(call?.tool || '') === 'generate_image_from_intent')) {
        return true;
    }
    const priorHistory = snapshot.history
        .slice(0, Math.max(0, snapshot.history.length - 1))
        .map((message) => `${message.role}: ${message.content || ''} ${JSON.stringify(message.toolCalls || [])}`)
        .join('\n');
    return /generate_image_from_intent|generated-image|image_generation|image_prompting|生成.{0,24}(图|图片|照片|海报)|generate.{0,40}(image|picture|photo|poster)/i.test(priorHistory);
}

// CONTEXT MEMORY
// Updated: 2026-04-23
// Status: mixed
// Why: social image edit/generate turns need route selection to see the same
// current-turn images that the main model sees, otherwise vague requests like
// "turn this into a poster" can be routed as text/social answers.
// Debug Goal: X/Farcaster uploaded or attached images must reach GPT route
// selection as image_url parts before tool visibility is decided.
// Search Tags: route selection social images image_url reference edit
// Invariants:
// - Social images remain current-turn context, not replayed history.
// - The route selector still returns JSON only; image parts are input context.
// Failure Modes:
// - A post with an attached image and edit wording never exposes generate_image_from_intent.
// - Route selection sees only has_social_images and cannot inspect the source image.
function normalizeRouteSelectionSocialImages(snapshot: ChatContextSnapshot): Array<{ url: string; label: string }> {
    const images = Array.isArray(snapshot.runtime?.socialInput?.images)
        ? snapshot.runtime.socialInput.images
        : [];
    return images
        .map((image: any, index: number) => ({
            url: String(image?.url || '').trim(),
            label: String(image?.sourceLabel || `social image ${index + 1}`).trim(),
        }))
        .filter((image) => /^https?:\/\//i.test(image.url))
        .slice(0, 4);
}

function buildRouteSelectionUserContent(
    payload: string,
    socialImages: Array<{ url: string; label: string }>,
): string | Array<Record<string, any>> {
    if (socialImages.length === 0) return payload;
    return [
        { type: 'text', text: payload },
        ...socialImages.map((image) => ({
            type: 'image_url',
            image_url: {
                url: image.url,
            },
        })),
    ];
}

function parseTaskRouteJson(text: string): {
    ok: true;
    payload: unknown;
} | {
    ok: false;
    reasonCode: TaskRouteSelectionReasonCode;
    error: string;
} {
    const candidate = stripCodeFence(String(text || '').trim());
    if (!candidate) {
        return {
            ok: false,
            reasonCode: 'task_route_invalid_json',
            error: 'Task route response was empty.',
        };
    }
    const json = extractFirstJsonObject(candidate);
    if (!json) {
        return {
            ok: false,
            reasonCode: 'task_route_invalid_json',
            error: 'Task route response did not contain a JSON object.',
        };
    }
    try {
        return {
            ok: true,
            payload: JSON.parse(json),
        };
    } catch (error: any) {
        return {
            ok: false,
            reasonCode: 'task_route_invalid_json',
            error: error?.message || 'Failed to parse task route JSON.',
        };
    }
}

function stripCodeFence(text: string): string {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
        const char = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{') {
            depth += 1;
            continue;
        }
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}
