import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { PythonGenerationClient } from './pythonGenerationClient.js';
import type { GenerationMessage } from './nodePromptAssembler.js';
import { extractEffectiveUserQuery } from './conversationStateResolver.js';
import {
    applyTaskRouteToSnapshot,
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
        const selectedSnapshot = applyTaskRouteToSnapshot(snapshot, validated.route);
        const state: TaskRouteSelectionState = {
            status: 'ok',
            source: 'llm',
            rawText,
            reasoningText,
        };
        selectedSnapshot.taskRouteSelectionState = state;
        logger.info(LogCode.AI_ORCHESTRATOR, 'Task route selection: success', {
            sessionId: snapshot.sessionId,
            taskId: snapshot.taskId,
            owner: validated.route.owner,
            phase: validated.route.phase,
            facets: validated.route.facets,
            confidence: validated.route.confidence,
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
                'If the user wants token deployment through Clanker or a generic token launch, owner=token_deploy.',
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
