import type {
    PolymarketPreparedSelectionState,
    PolymarketSelectionCandidateState,
    PolymarketSelectionOutcomeState,
    PolymarketSelectionState,
} from './contracts.js';

function normalizeText(value: unknown): string {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ');
}

function normalizeTokenId(value: unknown): string | null {
    const tokenId = String(value || '').trim();
    return tokenId || null;
}

function normalizeOutcome(outcome: any): PolymarketSelectionOutcomeState | null {
    const name = String(outcome?.name || '').trim();
    if (!name) return null;
    return {
        name,
        tokenId: normalizeTokenId(outcome?.token_id ?? outcome?.tokenId),
        probability: outcome?.probability != null ? String(outcome.probability) : null,
        price: Number.isFinite(Number(outcome?.price)) ? Number(outcome.price) : null,
    };
}

function normalizeCandidate(candidate: any, fallbackRole?: PolymarketSelectionCandidateState['windowRole']): PolymarketSelectionCandidateState | null {
    const market = candidate?.market && typeof candidate.market === 'object'
        ? candidate.market
        : candidate;
    const title = String(candidate?.title || market?.question || '').trim();
    const question = String(market?.question || candidate?.title || '').trim();
    if (!title || !question) return null;

    const outcomes = Array.isArray(market?.outcomes)
        ? market.outcomes.map(normalizeOutcome).filter((item: PolymarketSelectionOutcomeState | null): item is PolymarketSelectionOutcomeState => Boolean(item))
        : [];

    return {
        title,
        question,
        marketId: String(market?.id || candidate?.marketId || candidate?.market_id || '').trim() || null,
        marketSlug: String(market?.slug || candidate?.marketSlug || candidate?.slug || candidate?.market_slug || '').trim() || null,
        conditionId: String(market?.conditionId || market?.condition_id || candidate?.conditionId || candidate?.condition_id || '').trim() || null,
        windowRole: fallbackRole
            || (candidate?.next_window_candidate ? 'next' : candidate?.live ? 'current' : candidate?.watchlist_only ? 'watchlist' : 'candidate'),
        orderable: typeof candidate?.orderable === 'boolean' ? candidate.orderable : undefined,
        live: typeof candidate?.live === 'boolean' ? candidate.live : undefined,
        orderableDetail: candidate?.orderable_detail ? String(candidate.orderable_detail) : null,
        windowStartEt: candidate?.window?.start_et ? String(candidate.window.start_et) : null,
        windowEndEt: candidate?.window?.end_et ? String(candidate.window.end_et) : null,
        outcomes,
    };
}

function matchesCandidateIdentity(candidate: PolymarketSelectionCandidateState, params: {
    question?: string | null;
    tokenId?: string | null;
    marketId?: string | null;
    marketSlug?: string | null;
}): boolean {
    const marketId = String(params.marketId || '').trim();
    const marketSlug = String(params.marketSlug || '').trim();
    const tokenId = String(params.tokenId || '').trim();
    const question = normalizeText(params.question);

    if (marketId && candidate.marketId === marketId) return true;
    if (marketSlug && candidate.marketSlug === marketSlug) return true;
    if (question && normalizeText(candidate.question) === question) return true;
    if (tokenId && candidate.outcomes.some((outcome) => outcome.tokenId === tokenId)) return true;
    return false;
}

export function extractPolymarketSelectionState(toolName: string, result: any): PolymarketSelectionState | null {
    const normalizedTool = String(toolName || '').trim();
    if (!result || typeof result !== 'object') return null;

    if (normalizedTool === 'get_polymarket_coin_updown_markets') {
        const candidates = Array.isArray(result.markets)
            ? result.markets
                .map((candidate: any) => normalizeCandidate(candidate))
                .filter((item: PolymarketSelectionCandidateState | null): item is PolymarketSelectionCandidateState => Boolean(item))
            : [];

        const primaryCandidate = normalizeCandidate(
            candidates.find((candidate: PolymarketSelectionCandidateState) => matchesCandidateIdentity(candidate, {
                marketId: result?.primary_candidate?.id,
                marketSlug: result?.primary_candidate?.slug,
                question: result?.primary_candidate?.title,
            })) || result?.primary_candidate,
            'next',
        );
        const currentCandidate = normalizeCandidate(
            candidates.find((candidate: PolymarketSelectionCandidateState) => matchesCandidateIdentity(candidate, {
                marketId: result?.current_candidate?.id,
                marketSlug: result?.current_candidate?.slug,
                question: result?.current_candidate?.title,
            })) || result?.current_candidate,
            'current',
        );
        const executionCandidate = normalizeCandidate(
            candidates.find((candidate: PolymarketSelectionCandidateState) => matchesCandidateIdentity(candidate, {
                marketId: result?.execution_candidate?.id,
                marketSlug: result?.execution_candidate?.slug,
                question: result?.execution_candidate?.title,
            })) || result?.execution_candidate,
            'execution',
        );

        if (candidates.length === 0 && !primaryCandidate && !currentCandidate && !executionCandidate) {
            return null;
        }

        return {
            sourceTool: normalizedTool,
            capturedAt: new Date().toISOString(),
            currentTimeEtStrict: String(result?.current_time_et_strict || result?.current_time_et || '').trim() || null,
            primaryCandidate,
            currentCandidate,
            executionCandidate,
            preparedSelection: null,
            candidates,
        };
    }

    if (normalizedTool === 'prepare_polymarket_bet') {
        const question = String(result?.selection?.question || '').trim();
        const outcome = String(result?.selection?.outcome || '').trim();
        const tokenId = String(result?.selection?.resolved_token_id || result?.selection?.token_id || '').trim();
        if (!question || !outcome || !tokenId) return null;

        const preparedSelection: PolymarketPreparedSelectionState = {
            question,
            outcome,
            tokenId,
            resolvedTokenId: String(result?.selection?.resolved_token_id || '').trim() || null,
            marketId: String(result?.authoritative_resolution?.market_id || result?.selection_validation?.market_id || '').trim() || null,
            marketSlug: String(result?.authoritative_resolution?.market_slug || result?.selection_validation?.market_slug || '').trim() || null,
            conditionId: String(result?.authoritative_resolution?.condition_id || result?.selection_validation?.condition_id || '').trim() || null,
            amountUsd: Number.isFinite(Number(result?.selection?.amount_usd)) ? Number(result.selection.amount_usd) : null,
        };

        const singleCandidate: PolymarketSelectionCandidateState = {
            title: question,
            question,
            marketId: preparedSelection.marketId || null,
            marketSlug: preparedSelection.marketSlug || null,
            conditionId: preparedSelection.conditionId || null,
            windowRole: 'candidate',
            outcomes: [{
                name: outcome,
                tokenId,
                probability: null,
                price: null,
            }],
        };

        return {
            sourceTool: normalizedTool,
            capturedAt: new Date().toISOString(),
            currentTimeEtStrict: null,
            primaryCandidate: singleCandidate,
            currentCandidate: null,
            executionCandidate: singleCandidate,
            preparedSelection,
            candidates: [singleCandidate],
        };
    }

    return null;
}

export function mergePolymarketSelectionState(
    current: PolymarketSelectionState | null | undefined,
    next: PolymarketSelectionState | null | undefined,
): PolymarketSelectionState | null {
    if (!next) return current || null;
    if (!current) return next;

    const mergedCandidates = new Map<string, PolymarketSelectionCandidateState>();
    for (const candidate of [...(current.candidates || []), ...(next.candidates || [])]) {
        const key = `${candidate.marketId || ''}:${candidate.marketSlug || ''}:${normalizeText(candidate.question)}`;
        if (!key.replace(/:/g, '')) continue;
        mergedCandidates.set(key, candidate);
    }

    return {
        sourceTool: next.sourceTool || current.sourceTool,
        capturedAt: next.capturedAt || current.capturedAt,
        currentTimeEtStrict: next.currentTimeEtStrict || current.currentTimeEtStrict || null,
        primaryCandidate: next.primaryCandidate || current.primaryCandidate || null,
        currentCandidate: next.currentCandidate || current.currentCandidate || null,
        executionCandidate: next.executionCandidate || current.executionCandidate || null,
        preparedSelection: next.preparedSelection || current.preparedSelection || null,
        candidates: Array.from(mergedCandidates.values()),
    };
}

export function extractRecentPolymarketSelection(messages: any[]): PolymarketSelectionState | null {
    const assistantMessages = [...(messages || [])]
        .filter((msg) => msg?.role === 'assistant' && msg?.data?.polymarketSelection)
        .sort((a, b) => {
            const aIndex = Number(a?.message_index || a?.messageIndex || 0);
            const bIndex = Number(b?.message_index || b?.messageIndex || 0);
            if (aIndex !== bIndex) return aIndex - bIndex;
            const aCreated = Date.parse(String(a?.created_at || a?.createdAt || 0)) || 0;
            const bCreated = Date.parse(String(b?.created_at || b?.createdAt || 0)) || 0;
            return aCreated - bCreated;
        });
    if (assistantMessages.length === 0) return null;
    return assistantMessages[assistantMessages.length - 1]?.data?.polymarketSelection || null;
}

export function resolvePolymarketSelectionMatch(
    selection: PolymarketSelectionState | null | undefined,
    params: {
        question?: string | null;
        outcome?: string | null;
        tokenId?: string | null;
        marketId?: string | null;
        marketSlug?: string | null;
    },
): {
    question: string;
    outcome: string;
    tokenId: string | null;
    marketId: string | null;
    marketSlug: string | null;
    conditionId: string | null;
} | null {
    if (!selection) return null;

    const normalizedOutcome = normalizeText(params.outcome);
    const directPrepared = selection.preparedSelection;
    if (directPrepared && (
        matchesCandidateIdentity({
            title: directPrepared.question,
            question: directPrepared.question,
            marketId: directPrepared.marketId || null,
            marketSlug: directPrepared.marketSlug || null,
            conditionId: directPrepared.conditionId || null,
            outcomes: [{ name: directPrepared.outcome, tokenId: directPrepared.tokenId }],
        }, params)
        || (normalizeText(params.question) && normalizeText(directPrepared.question) === normalizeText(params.question) && normalizedOutcome === normalizeText(directPrepared.outcome))
    )) {
        return {
            question: directPrepared.question,
            outcome: directPrepared.outcome,
            tokenId: directPrepared.tokenId,
            marketId: directPrepared.marketId || null,
            marketSlug: directPrepared.marketSlug || null,
            conditionId: directPrepared.conditionId || null,
        };
    }

    for (const candidate of selection.candidates || []) {
        if (!matchesCandidateIdentity(candidate, params)) continue;
        const matchedOutcome = candidate.outcomes.find((outcome) =>
            normalizeText(outcome.name) === normalizedOutcome
            || (params.tokenId && outcome.tokenId === String(params.tokenId).trim())
        ) || (normalizedOutcome ? null : candidate.outcomes[0] || null);
        if (!matchedOutcome) continue;
        return {
            question: candidate.question,
            outcome: matchedOutcome.name,
            tokenId: matchedOutcome.tokenId,
            marketId: candidate.marketId,
            marketSlug: candidate.marketSlug,
            conditionId: candidate.conditionId,
        };
    }

    return null;
}
