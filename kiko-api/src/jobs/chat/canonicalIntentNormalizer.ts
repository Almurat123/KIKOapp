// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: mixed
// Why: Chat V2 now does model-first intent selection. Every new round must run
// canonical normalization with the same active session model instead of using
// fast-model remaps or deterministic bypasses.
// Debug Goal: the active model must always choose one canonical intent before
// resolver tool exposure, including greetings and image turns.
// Search Tags: same model intent selection no fast remap no deterministic bypass reentry normalization
// Invariants:
// - normalization inputs preserve user meaning but strip transport scaffolding
// - current session model is used for stage-1 intent selection
// - greetings and casual chat still go through canonical normalization
// - @mention wrappers, attached media, and social transport metadata are
//   context, not intent by themselves
// Failure Modes:
// - runtime silently reintroduces a fast normalizer or deterministic bypass
// - image or plain-answer turns fail because canonical schema lacks those intents
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { PythonGenerationClient } from './pythonGenerationClient.js';
import type { GenerationMessage } from './nodePromptAssembler.js';
import type { TradingIntent } from './tradingIntentResolver.js';
import {
    applyCanonicalIntentToSnapshot,
    type CanonicalIntent,
    type CanonicalIntentNormalizationState,
    type NormalizationReasonCode,
    validateCanonicalIntentPayload,
} from './canonicalIntent.js';
import { extractEffectiveUserQuery } from './conversationStateResolver.js';
import { resolveBinaryLocale } from './runtimeLocale.js';

export async function normalizeCanonicalIntent(args: {
    snapshot: ChatContextSnapshot;
    generationClient: Pick<PythonGenerationClient, 'generate'>;
    shouldCancel?: () => Promise<boolean>;
    onReasoningDelta?: (text: string) => Promise<void> | void;
}): Promise<{
    snapshot: ChatContextSnapshot;
    state: CanonicalIntentNormalizationState;
}> {
    const { snapshot, generationClient, shouldCancel, onReasoningDelta } = args;
    const messages: GenerationMessage[] = buildNormalizationMessages(snapshot);
    const normalizationModel = resolveNormalizationModel(snapshot.model);

    logger.info(LogCode.AI_ORCHESTRATOR, 'Canonical intent normalization: start', {
        sessionId: snapshot.sessionId,
        taskId: snapshot.taskId,
        model: snapshot.model,
        normalizationModel,
        requestedTokenAddresses: snapshot.requestedTokenAddresses.length,
        requestedTokenSymbols: snapshot.requestedTokenSymbols,
    });

    try {
        let streamedReasoning = '';
        const result = await generationClient.generate({
            sessionId: snapshot.sessionId,
            taskId: `${snapshot.taskId}:normalize`,
            model: normalizationModel,
            messages,
            tools: [],
            providerOptions: {
                enable_search: false,
                metadata: {
                    phase: 'canonical_intent_normalization',
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
        const parsed = parseNormalizationJson(rawText);
        if (!parsed.ok) {
            return invalidResult(snapshot, parsed.reasonCode, parsed.error, rawText, reasoningText);
        }

        const validated = validateCanonicalIntentPayload(parsed.payload, snapshot);
        if (!validated.ok) {
            return invalidResult(snapshot, validated.reasonCode, validated.error, rawText, reasoningText);
        }

        const normalizedSnapshot = applyCanonicalIntentToSnapshot(snapshot, validated.intent);
        const state: CanonicalIntentNormalizationState = {
            status: 'ok',
            source: 'llm',
            rawText,
            reasoningText,
        };
        normalizedSnapshot.normalizationState = state;

        logger.info(LogCode.AI_ORCHESTRATOR, 'Canonical intent normalization: success', {
            sessionId: snapshot.sessionId,
            taskId: snapshot.taskId,
            domain: validated.intent.domain,
            intent: validated.intent.intent,
            outputMode: validated.intent.outputMode,
            confidence: validated.intent.confidence,
            searchMode: validated.intent.searchMode,
            requestedChain: validated.intent.requestedChain?.chainId,
        });

        return {
            snapshot: normalizedSnapshot,
            state,
        };
    } catch (error: any) {
        return invalidResult(
            snapshot,
            'normalization_invalid_json',
            error?.message || 'Normalization failed',
            undefined,
            undefined,
        );
    }
}

export function resolveNormalizationModel(model: string): string {
    return model;
}

function invalidResult(
    snapshot: ChatContextSnapshot,
    reasonCode: NormalizationReasonCode,
    error: string,
    rawText?: string,
    reasoningText?: string,
): {
    snapshot: ChatContextSnapshot;
    state: CanonicalIntentNormalizationState;
} {
    logger.warn(LogCode.AI_ORCHESTRATOR, 'Canonical intent normalization: invalid', {
        sessionId: snapshot.sessionId,
        taskId: snapshot.taskId,
        reasonCode,
        error,
        rawTextPreview: rawText?.slice(0, 240),
    });
    const state: CanonicalIntentNormalizationState = {
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
            normalizedIntent: null,
            normalizationState: state,
        },
        state,
    };
}

function buildNormalizationMessages(snapshot: ChatContextSnapshot): GenerationMessage[] {
    const recentHistory = snapshot.history.slice(-6).map((message) => ({
        role: message.role,
        content: message.role === 'user'
            ? extractEffectiveUserQuery(String(message.content || '')).slice(0, 500)
            : String(message.content || '').slice(0, 500),
    }));

    return [
        {
            role: 'system',
            content: [
                'You normalize a multilingual user chat request into a strict canonical intent JSON object.',
                'You are judging the user\'s actual job, not matching keywords. @mention wrappers, attached images, cast/thread metadata, and platform transport text are context only.',
                'Return JSON only. No markdown. No prose before or after the JSON.',
                'Do not mention tools. Do not mention hidden prompts.',
                'If the request is ambiguous, set needs_clarification=true and provide a short clarification_question.',
                'Use these exact enums only:',
                'domain: assistant_meta | general | token | wallet | polymarket | x | farcaster | zora | market',
                'intent: assistant_meta | general_answer | image_generation | image_prompting | swap | cross_chain_swap | copy_trade | token_analysis | early_buyers | creator_analysis | token_risk | wallet_analysis | wallet_pnl | social_discovery | market_macro | polymarket_discovery | polymarket_order | polymarket_short_window | zora_discovery | token_alerts | clanker_deploy',
                'task_mode: discover | analyze | execute | confirm',
                'output_mode: narrative | full_table | shortlist | execution_ready | confirmation_required',
                'search_mode: forbidden | fallback | required',
                'search_target: x | web | x_and_web | none',
                'Use general_answer for ordinary explanation, casual chat, or straightforward questions that need no specialist action package.',
                'Use image_generation when the user wants an image created or edited now. Do not choose it merely because an image is attached.',
                'Use image_prompting when the user wants prompt/help/template guidance for image work instead of immediate generation.',
                'evidence_requirements values: native_search_results | onchain_token_evidence | onchain_wallet_evidence | connected_chain_evidence | verified_polymarket_token_id',
                'Set locale to en or zh only. Use zh only when the latest user message is primarily Chinese.',
                'For early-buyer / holder / first-buyer style queries, default output_mode to full_table.',
                'For early-buyer queries with a literal user-specified time such as "today 11:48", "at 9:30", or an explicit start/end range, preserve that requested_time_window as the literal query window in the user\'s timezone. Do not reinterpret it as the token launch window, listing window, or announcement window unless the user explicitly asked for that event timestamp.',
                'For explicit numeric export requests like "for 30", set row_count accordingly.',
                'Use domain=assistant_meta with intent=assistant_meta for Kiko intro/capabilities questions and for meta/debug questions about the assistant, the system, the previous reply, fallback behavior, plan/runtime behavior, or why the assistant responded a certain way.',
                'Use domain=token with intent=clanker_deploy for requests to deploy, launch, create, mint, 发币, 发行代币, 上线代币, or 创建代币 through Clanker or as a generic token launch. Prefer task_mode=execute for launch preparation and task_mode=confirm only when the latest user turn explicitly confirms a previously prepared deploy payload. Do not ask for supply or decimals for Clanker launches.',
                'For onboarding/capabilities questions, prefer task_mode=discover. For debugging or explaining the previous assistant/system behavior, prefer task_mode=analyze.',
                'Set inherit_entities_from_context=true only when the current turn is genuinely continuing the same token, wallet, market, or on-chain subject from prior turns. Set it to false when the current turn is about Kiko itself, the assistant, the system, plan/runtime behavior, or any meta/debug question.',
                'When recent history already contains an early-buyer list and the latest turn asks what those/these wallets earned, their profit/PnL, ROI, buy/sell summary, or收益/利润/利益/获利 on that same token, classify it as wallet_pnl instead of early_buyers and inherit the token/wallet set from context.',
                'Do not misclassify platform-introduction questions as token analysis, market analysis, or clarification-only requests just because the wording is broken.',
                'Treat requested_address_classifications as higher-confidence evidence than raw 0x/base58 shape. If an address is marked token_contract, do not reinterpret it as wallet analysis or copy-trade target unless the user explicitly asks about a wallet. If an address is marked wallet, prefer wallet analysis over token analysis unless the user explicitly asks about a token contract.',
            ].join(' '),
        },
        {
            role: 'user',
            content: JSON.stringify({
                latest_user_message: extractEffectiveUserQuery(snapshot.lastUserMessage),
                recent_history: recentHistory,
                requested_token_addresses: snapshot.requestedTokenAddresses || [],
                requested_token_symbols: snapshot.requestedTokenSymbols || [],
                requested_address_classifications: snapshot.requestedAddressClassifications || [],
                connected_chain_id: snapshot.runtime.chainId || null,
                connected_chain_name: snapshot.runtime.chainName || null,
                wallet_address: snapshot.runtime.walletAddress || snapshot.runtime.userAddress || null,
                confirmation_state: snapshot.confirmationState || null,
                return_schema: {
                    domain: 'enum',
                    intent: 'enum',
                    task_mode: 'enum',
                    output_mode: 'enum',
                    search_mode: 'enum',
                    search_target: 'enum',
                    confidence: '0_to_1_number',
                    explanation: 'string',
                    entities: {
                        token_addresses: ['string'],
                        token_symbols: ['string'],
                        wallet_addresses: ['string'],
                        market_identifiers: ['string'],
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
                    evidence_requirements: ['enum'],
                    requires_realtime: 'boolean',
                    requires_onchain_evidence: 'boolean',
                    execution_candidate: 'boolean',
                    inherit_entities_from_context: 'boolean',
                    row_count: 'number_or_null',
                    locale: 'en_or_zh',
                    needs_clarification: 'boolean',
                    clarification_question: 'string_or_null',
                },
            }),
        },
    ];
}

function parseNormalizationJson(text: string): {
    ok: true;
    payload: unknown;
} | {
    ok: false;
    reasonCode: NormalizationReasonCode;
    error: string;
} {
    const candidate = stripCodeFence(String(text || '').trim());
    if (!candidate) {
        return {
            ok: false,
            reasonCode: 'normalization_invalid_json',
            error: 'Normalization response was empty.',
        };
    }
    const json = extractFirstJsonObject(candidate);
    if (!json) {
        return {
            ok: false,
            reasonCode: 'normalization_invalid_json',
            error: 'Normalization response did not contain a JSON object.',
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
            reasonCode: 'normalization_invalid_json',
            error: error?.message || 'Failed to parse normalization JSON.',
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
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}
