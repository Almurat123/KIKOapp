// CONTEXT MEMORY
// Updated: 2026-04-18
// Author: Renata
// Reason: LLM canonical-intent wallet entities can drift from the user's
//         literal wallet string and must not be treated as authoritative when
//         malformed. A later runtime review showed that obvious non-chain turns
//         must be able to bypass canonical normalization without losing an
//         explicit owner-visible state marker. Clanker launch requests now need
//         a first-class canonical intent so deploy turns do not collapse back
//         into generic token analysis or free-form clarification. Product owner
//         correction on 2026-04-18 moved default task selection to the main
//         model, so canonical normalization state also needs an explicit
//         `model_selected_task_menu` bypass marker.
// Goal: keep canonical intent normalization usable while filtering malformed
//       wallet entities out of downstream execution paths, and preserve
//       deterministic bypass state for non-chain turns that must not re-enter
//       the JSON normalizer, while carrying token-deploy execution intent as
//       structured runtime state.
// Owns: canonical intent schema validation and entity normalization for chat.
// Does Not Own: exact wallet extraction from the user's literal message or
//               final copy-trade tool argument repair.
// Design Language:
// - malformed wallet entities from LLM normalization are discarded
// - canonical intent may enrich context, but must not invent wallet identity
// - do not let invalid wallet entities outrank exact addresses extracted elsewhere
// - deterministic normalization bypass must be explicit state, not hidden worker memory
// - Clanker launch/deploy turns are canonical `clanker_deploy`, not generic token analysis
// - model-selected task-menu bypass means no backend canonical intent was chosen for the user-facing turn
// Document Provenance:
// - Source: chat transcript + runtime logs + production database inspection for BSC copy-trade target wallets
// - Kind: runtime observation
// - Retrieved: 2026-04-13
// - Applied To: filtering invalid wallet entities before copy-trade target resolution
// - Verification: verified in code review and unit tests
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: representing deterministic non-chain normalization bypass state
// - Verification: verified in runtime and applied in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: first-class `clanker_deploy` canonical intent
// - Verification: verified in code and targeted tests
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: `model_selected_task_menu` deterministic bypass marker
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-13-copytrade-wallet-entity-hardening.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-non-chain-normalization-bypass.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-model-selected-task-menu.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
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

export function buildCanonicalIntentClarification(params: {
    snapshot: ChatContextSnapshot;
    reasonCode?: NormalizationReasonCode;
}): string {
    const locale = resolveBinaryLocale(String(params.snapshot.lastUserMessage || ''));
    if (locale === 'zh') {
        if (params.reasonCode === 'normalization_entity_conflict') {
            return '我识别到你的请求里有冲突的链或实体信息。请明确告诉我要分析哪个链、哪个地址或哪个市场。';
        }
        return '我需要先确认你的目标再继续。请直接告诉我你要做什么、对象是什么，以及如果相关的话是哪个链或市场。';
    }
    if (params.reasonCode === 'normalization_entity_conflict') {
        return 'I detected conflicting chain or entity hints in your request. Please specify the exact chain, address, or market you want me to work on.';
    }
    return 'I need one clarification before continuing. Please state the exact task, target address or market, and chain if it matters.';
}
