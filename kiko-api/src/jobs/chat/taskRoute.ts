// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: mixed
// Why: chat routing needs one primary owner per turn so long prompts stop
// drifting across a fat canonical tag table. The model now selects a thin task
// route, and legacy canonical intent remains a compatibility view derived from
// that route.
// Debug Goal: route selection must choose exactly one owner and let facets
// modify that owner without stealing the task.
// Search Tags: task route primary owner facets compatibility canonical intent bridge
// Invariants:
// - one user turn has exactly one route owner
// - facets modify the owner; they do not replace it
// - legacy canonical intent is derived from TaskRoute, not vice versa
// Failure Modes:
// - long prompts produce multiple competing owners
// - compatibility mapping reintroduces control-plane booleans as route truth
import type { ChatContextSnapshot } from './contracts.js';
import type {
    CanonicalDomain,
    CanonicalEvidenceRequirement,
    CanonicalIntent,
    CanonicalIntentName,
    CanonicalOutputMode,
    CanonicalSearchMode,
    CanonicalSearchTarget,
    CanonicalTaskMode,
    CanonicalTimeContext,
} from './canonicalIntent.js';
import { resolveBinaryLocale } from './runtimeLocale.js';
import { isStrictWalletAddress } from '../../utils/validation.js';

export type TaskRouteOwner =
    | 'assistant_meta'
    | 'general_answer'
    | 'image'
    | 'social'
    | 'token'
    | 'wallet'
    | 'swap'
    | 'copy_trade'
    | 'polymarket'
    | 'token_deploy'
    | 'zora'
    | 'market';

export type TaskRoutePhase = 'answer' | 'analyze' | 'execute' | 'confirm';

export type TaskRouteFacet =
    | 'prompt_only'
    | 'reference_image'
    | 'social_thread'
    | 'social_images'
    | 'realtime'
    | 'onchain'
    | 'full_list'
    | 'wallet_followup'
    | 'creator_focus'
    | 'early_buyers'
    | 'risk_review'
    | 'cross_chain'
    | 'short_window'
    | 'capabilities'
    | 'behavior_debug';

export interface TaskRouteRequestedChain {
    chainId: number;
    chainName: string;
    source: 'llm' | 'query' | 'entity';
}

export interface TaskRouteEntities {
    tokenAddresses: string[];
    tokenSymbols: string[];
    walletAddresses: string[];
    marketIdentifiers: string[];
    imageRefs: string[];
}

export interface TaskRoute {
    owner: TaskRouteOwner;
    phase: TaskRoutePhase;
    facets: TaskRouteFacet[];
    entities: TaskRouteEntities;
    requestedChain: TaskRouteRequestedChain | null;
    timeContext: CanonicalTimeContext | null;
    rowCount: number | null;
    inheritEntitiesFromContext: boolean;
    locale: 'en' | 'zh';
    needsClarification: boolean;
    clarificationQuestion: string | null;
    explanation: string;
    confidence: number;
    source: 'llm';
}

export type TaskRouteSelectionReasonCode =
    | 'task_route_invalid_json'
    | 'task_route_schema_mismatch'
    | 'task_route_low_confidence';

export interface TaskRouteSelectionState {
    status: 'ok' | 'invalid';
    source: 'llm' | 'deterministic';
    reasonCode?: TaskRouteSelectionReasonCode;
    error?: string;
    rawText?: string;
    reasoningText?: string;
}

const OWNER_VALUES = new Set<TaskRouteOwner>([
    'assistant_meta',
    'general_answer',
    'image',
    'social',
    'token',
    'wallet',
    'swap',
    'copy_trade',
    'polymarket',
    'token_deploy',
    'zora',
    'market',
]);

const PHASE_VALUES = new Set<TaskRoutePhase>(['answer', 'analyze', 'execute', 'confirm']);
const FACET_VALUES = new Set<TaskRouteFacet>([
    'prompt_only',
    'reference_image',
    'social_thread',
    'social_images',
    'realtime',
    'onchain',
    'full_list',
    'wallet_followup',
    'creator_focus',
    'early_buyers',
    'risk_review',
    'cross_chain',
    'short_window',
    'capabilities',
    'behavior_debug',
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

function normalizeRequestedChain(value: unknown): TaskRouteRequestedChain | null {
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
    inheritEntitiesFromContext: boolean,
): TaskRouteEntities {
    const record = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
    const inheritedTokenAddresses = inheritEntitiesFromContext
        ? (snapshot.requestedTokenAddresses || []).map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    const inheritedTokenSymbols = inheritEntitiesFromContext
        ? (snapshot.requestedTokenSymbols || []).map((item) => String(item || '').trim()).filter(Boolean)
        : [];
    const socialImageRefs = inheritEntitiesFromContext && Array.isArray(snapshot.runtime?.socialInput?.images)
        ? snapshot.runtime.socialInput!.images.map((item: any) => String(item?.url || '').trim()).filter(Boolean)
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
        imageRefs: Array.from(new Set([
            ...asStringArray(record.image_refs ?? record.imageRefs),
            ...socialImageRefs,
        ])),
    };
}

export function validateTaskRoutePayload(payload: unknown, snapshot: ChatContextSnapshot): {
    ok: true;
    route: TaskRoute;
} | {
    ok: false;
    reasonCode: TaskRouteSelectionReasonCode;
    error: string;
} {
    if (!payload || typeof payload !== 'object') {
        return {
            ok: false,
            reasonCode: 'task_route_schema_mismatch',
            error: 'Task route payload must be an object.',
        };
    }
    const record = payload as Record<string, unknown>;
    const owner = String(record.owner || '').trim() as TaskRouteOwner;
    const phase = String(record.phase || '').trim() as TaskRoutePhase;
    const facets = Array.from(new Set(
        asStringArray(record.facets).filter((item): item is TaskRouteFacet => FACET_VALUES.has(item as TaskRouteFacet)),
    ));
    const confidence = Number(record.confidence);
    if (!OWNER_VALUES.has(owner)) {
        return { ok: false, reasonCode: 'task_route_schema_mismatch', error: `Invalid owner: ${owner}` };
    }
    if (!PHASE_VALUES.has(phase)) {
        return { ok: false, reasonCode: 'task_route_schema_mismatch', error: `Invalid phase: ${phase}` };
    }
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        return { ok: false, reasonCode: 'task_route_schema_mismatch', error: `Invalid confidence: ${String(record.confidence)}` };
    }
    const inheritEntitiesFromContext = Boolean(
        record.inherit_entities_from_context
        ?? record.inheritEntitiesFromContext,
    );
    const route: TaskRoute = {
        owner,
        phase,
        facets,
        entities: normalizeEntities(record.entities, snapshot, inheritEntitiesFromContext),
        requestedChain: normalizeRequestedChain(record.requested_chain ?? record.requestedChain),
        timeContext: normalizeTimeContext(record.requested_time_window ?? record.timeContext),
        rowCount: Number.isFinite(Number(record.row_count ?? record.rowCount)) && Number(record.row_count ?? record.rowCount) > 0
            ? Number(record.row_count ?? record.rowCount)
            : null,
        inheritEntitiesFromContext,
        locale: normalizeLocale(record.locale, snapshot),
        needsClarification: Boolean(record.needs_clarification ?? record.needsClarification),
        clarificationQuestion: String(record.clarification_question ?? record.clarificationQuestion ?? '').trim() || null,
        explanation: String(record.explanation ?? '').trim(),
        confidence,
        source: 'llm',
    };
    return { ok: true, route };
}

function buildSearchMode(route: TaskRoute): CanonicalSearchMode {
    if (route.owner === 'social') return hasFacet(route, 'realtime') ? 'required' : 'fallback';
    if (route.owner === 'market' || route.owner === 'zora') return 'fallback';
    if (route.owner === 'token' && hasFacet(route, 'realtime')) return 'fallback';
    if (route.owner === 'wallet' && hasFacet(route, 'realtime')) return 'fallback';
    if (route.owner === 'polymarket' && route.phase === 'analyze') return hasFacet(route, 'realtime') ? 'required' : 'fallback';
    return 'forbidden';
}

function detectSocialDomain(snapshot: ChatContextSnapshot): CanonicalDomain {
    const currentPage = String(snapshot.runtime?.currentPage || '').trim().toLowerCase();
    const pageContext = String(snapshot.runtime?.pageContext || '').trim().toLowerCase();
    if (currentPage === 'x' || pageContext.includes('x_')) return 'x';
    if (currentPage === 'farcaster' || pageContext.includes('farcaster')) return 'farcaster';
    const socialPlatform = String(snapshot.runtime?.socialInput?.platform || '').trim().toLowerCase();
    if (socialPlatform === 'x') return 'x';
    if (socialPlatform === 'farcaster') return 'farcaster';
    return 'market';
}

function buildSearchTarget(route: TaskRoute, snapshot: ChatContextSnapshot): CanonicalSearchTarget {
    if (route.owner === 'social') {
        const domain = detectSocialDomain(snapshot);
        if (domain === 'x') return 'x';
        if (domain === 'farcaster') return 'x_and_web';
        return 'x_and_web';
    }
    if (route.owner === 'market' || route.owner === 'zora') return 'web';
    if ((route.owner === 'token' || route.owner === 'wallet' || route.owner === 'polymarket') && hasFacet(route, 'realtime')) return 'web';
    return 'none';
}

function buildEvidenceRequirements(route: TaskRoute): CanonicalEvidenceRequirement[] {
    const evidence = new Set<CanonicalEvidenceRequirement>();
    if (route.owner === 'social' || hasFacet(route, 'realtime') || route.owner === 'market' || route.owner === 'zora') {
        evidence.add('native_search_results');
    }
    if (route.owner === 'token' || route.owner === 'swap' || route.owner === 'copy_trade' || route.owner === 'token_deploy') {
        if (hasFacet(route, 'onchain') || hasFacet(route, 'early_buyers') || hasFacet(route, 'creator_focus') || hasFacet(route, 'risk_review') || route.owner !== 'token') {
            evidence.add('onchain_token_evidence');
        }
    }
    if (route.owner === 'wallet' || hasFacet(route, 'wallet_followup') || route.owner === 'copy_trade') {
        evidence.add('onchain_wallet_evidence');
    }
    if (route.owner === 'swap' || route.owner === 'copy_trade' || route.owner === 'token_deploy') {
        evidence.add('connected_chain_evidence');
    }
    if (route.owner === 'polymarket') {
        evidence.add('verified_polymarket_token_id');
    }
    return Array.from(evidence);
}

export function hasTaskRouteFacet(route: TaskRoute | null | undefined, facet: TaskRouteFacet): boolean {
    if (!route) return false;
    return route.facets.includes(facet);
}

export function resolveTaskRouteEvidenceRequirements(route: TaskRoute | null | undefined): CanonicalEvidenceRequirement[] {
    if (!route) return [];
    return buildEvidenceRequirements(route);
}

export function taskRouteNeedsRealtime(route: TaskRoute | null | undefined): boolean {
    if (!route) return false;
    return hasTaskRouteFacet(route, 'realtime') || route.owner === 'social' || route.owner === 'market' || route.owner === 'zora';
}

export function taskRouteNeedsOnchainEvidence(route: TaskRoute | null | undefined): boolean {
    const evidence = resolveTaskRouteEvidenceRequirements(route);
    return evidence.includes('onchain_token_evidence')
        || evidence.includes('onchain_wallet_evidence')
        || evidence.includes('connected_chain_evidence');
}

export function taskRouteNeedsCreatorEvidence(route: TaskRoute | null | undefined): boolean {
    return Boolean(route && route.owner === 'token' && hasTaskRouteFacet(route, 'creator_focus'));
}

export function isTaskRouteExecutionPhase(route: TaskRoute | null | undefined): boolean {
    return Boolean(route && (route.phase === 'execute' || route.phase === 'confirm'));
}

export function isTaskRouteAssistantMetaDebug(route: TaskRoute | null | undefined): boolean {
    return Boolean(route && route.owner === 'assistant_meta' && (route.phase === 'analyze' || hasTaskRouteFacet(route, 'behavior_debug')));
}

export function taskRouteCarriesTokenContext(route: TaskRoute | null | undefined): boolean {
    return Boolean(route && ['token', 'swap', 'copy_trade', 'token_deploy'].includes(route.owner));
}

function buildIntentName(route: TaskRoute): CanonicalIntentName {
    switch (route.owner) {
        case 'assistant_meta':
            return 'assistant_meta';
        case 'general_answer':
            return 'general_answer';
        case 'image':
            return hasFacet(route, 'prompt_only') ? 'image_prompting' : 'image_generation';
        case 'social':
            return 'social_discovery';
        case 'token':
            if (hasFacet(route, 'early_buyers')) return 'early_buyers';
            if (hasFacet(route, 'creator_focus')) return 'creator_analysis';
            if (hasFacet(route, 'risk_review')) return 'token_risk';
            return 'token_analysis';
        case 'wallet':
            return hasFacet(route, 'wallet_followup') ? 'wallet_pnl' : 'wallet_analysis';
        case 'swap':
            return hasFacet(route, 'cross_chain') ? 'cross_chain_swap' : 'swap';
        case 'copy_trade':
            return 'copy_trade';
        case 'polymarket':
            if (route.phase === 'execute' || route.phase === 'confirm') return 'polymarket_order';
            if (hasFacet(route, 'short_window')) return 'polymarket_short_window';
            return 'polymarket_discovery';
        case 'token_deploy':
            return 'clanker_deploy';
        case 'zora':
            return 'zora_discovery';
        case 'market':
            return 'market_macro';
        default:
            return 'general_answer';
    }
}

function buildDomain(route: TaskRoute, snapshot: ChatContextSnapshot): CanonicalDomain {
    switch (route.owner) {
        case 'assistant_meta':
            return 'assistant_meta';
        case 'social':
            return detectSocialDomain(snapshot);
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
}

function buildTaskMode(route: TaskRoute): CanonicalTaskMode {
    switch (route.phase) {
        case 'answer':
            return 'discover';
        case 'analyze':
            return 'analyze';
        case 'execute':
            return 'execute';
        case 'confirm':
            return 'confirm';
        default:
            return 'discover';
    }
}

function buildOutputMode(route: TaskRoute): CanonicalOutputMode {
    if (route.phase === 'confirm') return 'confirmation_required';
    if (route.phase === 'execute') return 'execution_ready';
    if (hasFacet(route, 'full_list') || hasFacet(route, 'early_buyers')) return 'full_table';
    return 'narrative';
}

function hasFacet(route: TaskRoute, facet: TaskRouteFacet): boolean {
    return route.facets.includes(facet);
}

export function deriveCanonicalIntentFromTaskRoute(
    route: TaskRoute,
    snapshot: ChatContextSnapshot,
): CanonicalIntent {
    const evidenceRequirements = buildEvidenceRequirements(route);
    const searchMode = buildSearchMode(route);
    const searchTarget = buildSearchTarget(route, snapshot);
    const domain = buildDomain(route, snapshot);
    const intent = buildIntentName(route);
    return {
        domain,
        intent,
        taskMode: buildTaskMode(route),
        outputMode: buildOutputMode(route),
        searchMode,
        searchTarget,
        confidence: route.confidence,
        explanation: route.explanation,
        entities: {
            tokenAddresses: route.entities.tokenAddresses,
            tokenSymbols: route.entities.tokenSymbols,
            walletAddresses: route.entities.walletAddresses,
            marketIdentifiers: route.entities.marketIdentifiers,
        },
        requestedChain: route.requestedChain,
        timeContext: route.timeContext,
        evidenceRequirements,
        requiresRealtime: hasFacet(route, 'realtime') || route.owner === 'social' || route.owner === 'market' || route.owner === 'zora',
        requiresOnchainEvidence: evidenceRequirements.includes('onchain_token_evidence')
            || evidenceRequirements.includes('onchain_wallet_evidence')
            || evidenceRequirements.includes('connected_chain_evidence'),
        executionCandidate: route.phase === 'execute' || route.phase === 'confirm',
        inheritEntitiesFromContext: route.inheritEntitiesFromContext,
        rowCount: route.rowCount,
        locale: route.locale,
        needsClarification: route.needsClarification,
        clarificationQuestion: route.clarificationQuestion,
        source: 'llm',
    };
}

export function summarizeTaskRoute(route: TaskRoute | null | undefined): Record<string, any> | undefined {
    if (!route) return undefined;
    return {
        owner: route.owner,
        phase: route.phase,
        facets: route.facets,
        row_count: route.rowCount ?? undefined,
        requested_chain: route.requestedChain
            ? `${route.requestedChain.chainName} (${route.requestedChain.chainId})`
            : undefined,
        time_bound: route.timeContext?.isTimeBound || undefined,
    };
}

export function applyTaskRouteToSnapshot(
    snapshot: ChatContextSnapshot,
    route: TaskRoute | null | undefined,
): ChatContextSnapshot {
    if (!route) return snapshot;
    const requestedTokenAddresses = route.inheritEntitiesFromContext
        ? Array.from(new Set([
            ...(snapshot.requestedTokenAddresses || []),
            ...route.entities.tokenAddresses,
        ]))
        : [...route.entities.tokenAddresses];
    const requestedTokenSymbols = route.inheritEntitiesFromContext
        ? Array.from(new Set([
            ...(snapshot.requestedTokenSymbols || []),
            ...route.entities.tokenSymbols,
        ]))
        : [...route.entities.tokenSymbols];
    const normalizedIntent = deriveCanonicalIntentFromTaskRoute(route, {
        ...snapshot,
        requestedTokenAddresses,
        requestedTokenSymbols,
    });
    return {
        ...snapshot,
        requestedTokenAddresses,
        requestedTokenSymbols,
        taskRoute: route,
        normalizedIntent,
    };
}
