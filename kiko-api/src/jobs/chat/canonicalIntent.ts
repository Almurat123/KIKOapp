// CONTEXT MEMORY
// Updated: 2026-04-21
// Status: mixed
// Why: chat v2 now selects one canonical intent with the current session model
// before backend tool exposure. The schema must therefore cover plain direct
// answers and image work instead of relying on resolver-side query matching to
// invent those routes later.
// Debug Goal: keep canonical intent validation strict while allowing runtime to
// map one model-chosen intent to one tool package per round.
// Search Tags: model first intent selection canonical general answer image generation image prompting
// Invariants:
// - malformed wallet entities from LLM normalization are discarded
// - canonical intent may enrich context, but must not invent wallet identity
// - canonical schema must represent direct-answer and image-routing turns
// Failure Modes:
// - runtime falls back to legacy matcher because canonical schema cannot represent the turn
// - invalid wallet entities outrank exact addresses extracted elsewhere
import type { ChatContextSnapshot } from './contracts.js';
import { resolveBinaryLocale } from './runtimeLocale.js';
import { isStrictWalletAddress } from '../../utils/validation.js';

export type CanonicalDomain =
    | 'assistant_meta'
    | 'general'
    | 'token'
    | 'wallet'
    | 'polymarket'
    | 'x'
    | 'farcaster'
    | 'zora'
    | 'market';

export type CanonicalIntentName =
    | 'assistant_meta'
    | 'general_answer'
    | 'image_generation'
    | 'image_prompting'
    | 'swap'
    | 'cross_chain_swap'
    | 'copy_trade'
    | 'token_analysis'
    | 'early_buyers'
    | 'creator_analysis'
    | 'token_risk'
    | 'wallet_analysis'
    | 'wallet_pnl'
    | 'social_discovery'
    | 'market_macro'
    | 'polymarket_discovery'
    | 'polymarket_order'
    | 'polymarket_short_window'
    | 'zora_discovery'
    | 'token_alerts'
    | 'clanker_deploy';

export type CanonicalTaskMode = 'discover' | 'analyze' | 'execute' | 'confirm';
export type CanonicalOutputMode = 'narrative' | 'full_table' | 'shortlist' | 'execution_ready' | 'confirmation_required';
export type CanonicalSearchMode = 'forbidden' | 'fallback' | 'required';
export type CanonicalSearchTarget = 'x' | 'web' | 'x_and_web' | 'none';
export type CanonicalEvidenceRequirement =
    | 'native_search_results'
    | 'onchain_token_evidence'
    | 'onchain_wallet_evidence'
    | 'connected_chain_evidence'
    | 'verified_polymarket_token_id';

export type NormalizationReasonCode =
    | 'normalization_invalid_json'
    | 'normalization_schema_mismatch'
    | 'normalization_low_confidence'
    | 'normalization_entity_conflict';

export interface CanonicalRequestedChain {
    chainId: number;
    chainName: string;
    source: 'llm' | 'query' | 'entity';
}

export interface CanonicalTimeContext {
    isTimeBound: boolean;
    description?: string;
    startTime?: string;
    endTime?: string;
}

export interface CanonicalEntities {
    tokenAddresses: string[];
    tokenSymbols: string[];
    walletAddresses: string[];
    marketIdentifiers: string[];
}

export interface CanonicalIntent {
    domain: CanonicalDomain;
    intent: CanonicalIntentName;
    taskMode: CanonicalTaskMode;
    outputMode: CanonicalOutputMode;
    searchMode: CanonicalSearchMode;
    searchTarget: CanonicalSearchTarget;
    confidence: number;
    explanation: string;
    entities: CanonicalEntities;
    requestedChain: CanonicalRequestedChain | null;
    timeContext: CanonicalTimeContext | null;
    evidenceRequirements: CanonicalEvidenceRequirement[];
    requiresRealtime: boolean;
    requiresOnchainEvidence: boolean;
    executionCandidate: boolean;
    inheritEntitiesFromContext?: boolean;
    rowCount: number | null;
    locale: 'en' | 'zh';
    needsClarification: boolean;
    clarificationQuestion: string | null;
    source: 'llm';
}

export interface CanonicalIntentNormalizationState {
    status: 'ok' | 'invalid';
    source: 'llm' | 'deterministic';
    bypassKind?: 'general_non_chain' | 'model_selected_task_menu';
    reasonCode?: NormalizationReasonCode;
    error?: string;
    rawText?: string;
    reasoningText?: string;
}

const DOMAIN_VALUES = new Set<CanonicalDomain>([
    'assistant_meta',
    'general',
    'token',
    'wallet',
    'polymarket',
    'x',
    'farcaster',
    'zora',
    'market',
]);

const INTENT_VALUES = new Set<CanonicalIntentName>([
    'assistant_meta',
    'general_answer',
    'image_generation',
    'image_prompting',
    'swap',
    'cross_chain_swap',
    'copy_trade',
    'token_analysis',
    'early_buyers',
    'creator_analysis',
    'token_risk',
    'wallet_analysis',
    'wallet_pnl',
    'social_discovery',
    'market_macro',
    'polymarket_discovery',
    'polymarket_order',
    'polymarket_short_window',
    'zora_discovery',
    'token_alerts',
    'clanker_deploy',
]);

const TASK_MODE_VALUES = new Set<CanonicalTaskMode>(['discover', 'analyze', 'execute', 'confirm']);
const OUTPUT_MODE_VALUES = new Set<CanonicalOutputMode>(['narrative', 'full_table', 'shortlist', 'execution_ready', 'confirmation_required']);
const SEARCH_MODE_VALUES = new Set<CanonicalSearchMode>(['forbidden', 'fallback', 'required']);
const SEARCH_TARGET_VALUES = new Set<CanonicalSearchTarget>(['x', 'web', 'x_and_web', 'none']);
const EVIDENCE_VALUES = new Set<CanonicalEvidenceRequirement>([
    'native_search_results',
    'onchain_token_evidence',
    'onchain_wallet_evidence',
    'connected_chain_evidence',
    'verified_polymarket_token_id',
]);

function asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function normalizeLocale(value: unknown, snapshot: ChatContextSnapshot): 'en' | 'zh' {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'zh' || raw === 'cn' || raw === 'zh-cn') return 'zh';
    if (raw === 'en') return 'en';
    return resolveBinaryLocale(String(snapshot.lastUserMessage || ''));
}

function normalizeRequestedChain(value: unknown): CanonicalRequestedChain | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const chainId = Number(record.chain_id ?? record.chainId);
    const chainName = String(record.chain_name ?? record.chainName ?? '').trim();
    if (!Number.isFinite(chainId) || chainId <= 0 || !chainName) return null;
    return {
        chainId,
        chainName,
        source: 'llm',
    };
}

function normalizeTimeContext(value: unknown): CanonicalTimeContext | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const isTimeBound = Boolean(record.is_time_bound ?? record.isTimeBound);
    const description = String(record.description ?? '').trim() || undefined;
    const startTime = String(record.start_time ?? record.startTime ?? '').trim() || undefined;
    const endTime = String(record.end_time ?? record.endTime ?? '').trim() || undefined;
    if (!isTimeBound && !description && !startTime && !endTime) return null;
    return {
        isTimeBound,
        description,
        startTime,
        endTime,
    };
}

function normalizeEntities(
    value: unknown,
    snapshot: ChatContextSnapshot,
    options?: { inheritEntitiesFromContext?: boolean },
): CanonicalEntities {
    const record = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
    const inheritedTokenAddresses = options?.inheritEntitiesFromContext
        ? (snapshot.requestedTokenAddresses || []).map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    const inheritedTokenSymbols = options?.inheritEntitiesFromContext
        ? (snapshot.requestedTokenSymbols || []).map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    return {
        tokenAddresses: Array.from(new Set([
            ...asStringArray(record.token_addresses ?? record.tokenAddresses),
            ...inheritedTokenAddresses,
        ])),
        tokenSymbols: Array.from(new Set([
            ...asStringArray(record.token_symbols ?? record.tokenSymbols),
            ...inheritedTokenSymbols,
        ])),
        walletAddresses: Array.from(new Set(
            asStringArray(record.wallet_addresses ?? record.walletAddresses)
                .filter((item) => isStrictWalletAddress(item)),
        )),
        marketIdentifiers: Array.from(new Set(asStringArray(record.market_identifiers ?? record.marketIdentifiers))),
    };
}

export function validateCanonicalIntentPayload(payload: unknown, snapshot: ChatContextSnapshot): {
    ok: true;
    intent: CanonicalIntent;
} | {
    ok: false;
    reasonCode: NormalizationReasonCode;
    error: string;
} {
    if (!payload || typeof payload !== 'object') {
        return {
            ok: false,
            reasonCode: 'normalization_schema_mismatch',
            error: 'Normalization payload must be an object.',
        };
    }
    const record = payload as Record<string, unknown>;
    const domain = String(record.domain || '').trim() as CanonicalDomain;
    const intent = String(record.intent || '').trim() as CanonicalIntentName;
    const taskMode = String(record.task_mode ?? record.taskMode ?? '').trim() as CanonicalTaskMode;
    const outputMode = String(record.output_mode ?? record.outputMode ?? '').trim() as CanonicalOutputMode;
    const searchMode = String(record.search_mode ?? record.searchMode ?? '').trim() as CanonicalSearchMode;
    const searchTarget = String(record.search_target ?? record.searchTarget ?? '').trim() as CanonicalSearchTarget;
    const confidence = Number(record.confidence);

    if (!DOMAIN_VALUES.has(domain)) {
        return { ok: false, reasonCode: 'normalization_schema_mismatch', error: `Invalid domain: ${domain}` };
    }
    if (!INTENT_VALUES.has(intent)) {
        return { ok: false, reasonCode: 'normalization_schema_mismatch', error: `Invalid intent: ${intent}` };
    }
    if (!TASK_MODE_VALUES.has(taskMode)) {
        return { ok: false, reasonCode: 'normalization_schema_mismatch', error: `Invalid taskMode: ${taskMode}` };
    }
    if (!OUTPUT_MODE_VALUES.has(outputMode)) {
        return { ok: false, reasonCode: 'normalization_schema_mismatch', error: `Invalid outputMode: ${outputMode}` };
    }
    if (!SEARCH_MODE_VALUES.has(searchMode)) {
        return { ok: false, reasonCode: 'normalization_schema_mismatch', error: `Invalid searchMode: ${searchMode}` };
    }
    if (!SEARCH_TARGET_VALUES.has(searchTarget)) {
        return { ok: false, reasonCode: 'normalization_schema_mismatch', error: `Invalid searchTarget: ${searchTarget}` };
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        return { ok: false, reasonCode: 'normalization_schema_mismatch', error: `Invalid confidence: ${String(record.confidence)}` };
    }

    const evidenceRequirements = asStringArray(record.evidence_requirements ?? record.evidenceRequirements)
        .filter((item): item is CanonicalEvidenceRequirement => EVIDENCE_VALUES.has(item as CanonicalEvidenceRequirement));
    const inheritEntitiesFromContext = Boolean(
        record.inherit_entities_from_context
        ?? record.inheritEntitiesFromContext,
    );
    const entities = normalizeEntities(record.entities, snapshot, {
        inheritEntitiesFromContext,
    });
    const requestedChain = normalizeRequestedChain(record.requested_chain ?? record.requestedChain);
    const timeContext = normalizeTimeContext(record.requested_time_window ?? record.timeContext);
    const explanation = String(record.explanation ?? '').trim();
    const rowCountRaw = record.row_count ?? record.rowCount;
    const rowCount = Number.isFinite(Number(rowCountRaw)) && Number(rowCountRaw) > 0 ? Number(rowCountRaw) : null;
    const locale = normalizeLocale(record.locale, snapshot);
    const needsClarification = Boolean(record.needs_clarification ?? record.needsClarification);
    const clarificationQuestion = String(record.clarification_question ?? record.clarificationQuestion ?? '').trim() || null;

    const requestedSymbols = entities.tokenSymbols.map((item) => item.toUpperCase());
    if (requestedChain?.chainId === 56 && requestedSymbols.includes('BASE')) {
        return {
            ok: false,
            reasonCode: 'normalization_entity_conflict',
            error: 'Conflicting chain and symbol hints detected.',
        };
    }

    return {
        ok: true,
        intent: {
            domain,
            intent,
            taskMode,
            outputMode,
            searchMode,
            searchTarget,
            confidence,
            explanation,
            entities,
            requestedChain,
            timeContext,
            evidenceRequirements,
            requiresRealtime: Boolean(record.requires_realtime ?? record.requiresRealtime),
            requiresOnchainEvidence: Boolean(record.requires_onchain_evidence ?? record.requiresOnchainEvidence),
            executionCandidate: Boolean(record.execution_candidate ?? record.executionCandidate),
            inheritEntitiesFromContext,
            rowCount,
            locale,
            needsClarification,
            clarificationQuestion,
            source: 'llm',
        },
    };
}

export function summarizeCanonicalIntent(intent: CanonicalIntent | null | undefined): Record<string, any> | undefined {
    if (!intent) return undefined;
    return {
        domain: intent.domain,
        intent: intent.intent,
        task_mode: intent.taskMode,
        output_mode: intent.outputMode,
        search_mode: intent.searchMode,
        search_target: intent.searchTarget,
        confidence: intent.confidence,
        requested_chain: intent.requestedChain
            ? `${intent.requestedChain.chainName} (${intent.requestedChain.chainId})`
            : undefined,
        row_count: intent.rowCount ?? undefined,
        evidence_requirements: intent.evidenceRequirements,
        requires_realtime: intent.requiresRealtime,
        requires_onchain_evidence: intent.requiresOnchainEvidence,
        inherit_entities_from_context: intent.inheritEntitiesFromContext ?? true,
    };
}

export function applyCanonicalIntentToSnapshot(snapshot: ChatContextSnapshot, intent: CanonicalIntent | null | undefined): ChatContextSnapshot {
    if (!intent) return snapshot;
    const inheritEntitiesFromContext = intent.inheritEntitiesFromContext ?? true;
    const requestedTokenAddresses = inheritEntitiesFromContext
        ? Array.from(new Set([
            ...(snapshot.requestedTokenAddresses || []),
            ...intent.entities.tokenAddresses,
        ]))
        : [...intent.entities.tokenAddresses];
    const requestedTokenSymbols = inheritEntitiesFromContext
        ? Array.from(new Set([
            ...(snapshot.requestedTokenSymbols || []),
            ...intent.entities.tokenSymbols,
        ]))
        : [...intent.entities.tokenSymbols];
    return {
        ...snapshot,
        requestedTokenAddresses,
        requestedTokenSymbols,
        normalizedIntent: intent,
    };
}
