export type CopyTradeTimingSnapshot = {
    firstSeenAt?: number;
    swapReadyAt?: number;
    dispatchEligibleAt?: number;
    enqueuedAt?: number;
    source?: string;
};

export type CopyTradeDelayCheckResult = {
    skip: boolean;
    delayMs: number;
    maxDelayMs: number;
    hardDelayMs: number;
    delayAnchor: 'dispatch_eligible' | 'swap_ready' | 'first_seen' | 'legacy_detected_at' | 'none';
    reasonCode?: 'copytrade_delay_exceeded_dispatch' | 'copytrade_delay_exceeded_hard_cap';
};

function sanitizeTimestamp(value: number | undefined | null, nowMs: number): number | undefined {
    if (!Number.isFinite(value as number)) return undefined;
    const numeric = Number(value);
    if (numeric <= 0) return undefined;
    if (numeric > nowMs + 5_000) return undefined;
    return numeric;
}

export function mergeCopyTradeTimingSnapshots(
    ...candidates: Array<CopyTradeTimingSnapshot | undefined | null>
): CopyTradeTimingSnapshot | undefined {
    const nowMs = Date.now();
    const merged: CopyTradeTimingSnapshot = {};
    for (const candidate of candidates) {
        if (!candidate) continue;
        const firstSeenAt = sanitizeTimestamp(candidate.firstSeenAt, nowMs);
        const swapReadyAt = sanitizeTimestamp(candidate.swapReadyAt, nowMs);
        const dispatchEligibleAt = sanitizeTimestamp(candidate.dispatchEligibleAt, nowMs);
        const enqueuedAt = sanitizeTimestamp(candidate.enqueuedAt, nowMs);
        if (firstSeenAt !== undefined) {
            merged.firstSeenAt = merged.firstSeenAt === undefined ? firstSeenAt : Math.min(merged.firstSeenAt, firstSeenAt);
        }
        if (swapReadyAt !== undefined) {
            merged.swapReadyAt = merged.swapReadyAt === undefined ? swapReadyAt : Math.max(merged.swapReadyAt, swapReadyAt);
        }
        if (dispatchEligibleAt !== undefined) {
            merged.dispatchEligibleAt = merged.dispatchEligibleAt === undefined
                ? dispatchEligibleAt
                : Math.max(merged.dispatchEligibleAt, dispatchEligibleAt);
        }
        if (enqueuedAt !== undefined) {
            merged.enqueuedAt = merged.enqueuedAt === undefined ? enqueuedAt : Math.max(merged.enqueuedAt, enqueuedAt);
        }
        if (!merged.source && candidate.source) {
            merged.source = candidate.source;
        }
    }
    return Object.keys(merged).length > 0 ? merged : undefined;
}

export function buildCopyTradeFirstSeenTiming(firstSeenAt = Date.now(), source = 'pending_hint'): CopyTradeTimingSnapshot {
    return {
        firstSeenAt,
        source
    };
}

export function markCopyTradeSwapReady(
    timing: CopyTradeTimingSnapshot | undefined,
    readyAt = Date.now(),
    source?: string
): CopyTradeTimingSnapshot {
    return mergeCopyTradeTimingSnapshots(timing, {
        swapReadyAt: readyAt,
        dispatchEligibleAt: readyAt,
        source
    }) || {
        swapReadyAt: readyAt,
        dispatchEligibleAt: readyAt,
        source
    };
}

export function markCopyTradeTaskEnqueued(
    timing: CopyTradeTimingSnapshot | undefined,
    enqueuedAt = Date.now()
): CopyTradeTimingSnapshot {
    return mergeCopyTradeTimingSnapshots(timing, {
        enqueuedAt,
        dispatchEligibleAt: enqueuedAt
    }) || {
        enqueuedAt,
        dispatchEligibleAt: enqueuedAt
    };
}

export function getCopyTradeDispatchDetectedAt(
    timing: CopyTradeTimingSnapshot | undefined,
    legacyDetectedAt?: number
): number | undefined {
    if (timing?.dispatchEligibleAt) return timing.dispatchEligibleAt;
    if (timing?.swapReadyAt) return timing.swapReadyAt;
    if (timing?.firstSeenAt) return timing.firstSeenAt;
    return legacyDetectedAt;
}

export function evaluateCopyTradeDelay(
    timingOrDetectedAt: CopyTradeTimingSnapshot | number | undefined,
    turboMode: boolean,
    limits: {
        maxDelayMs: number;
        hardMaxDelayMs: number;
    },
    nowMs = Date.now()
): CopyTradeDelayCheckResult {
    const legacyDetectedAt = typeof timingOrDetectedAt === 'number' ? timingOrDetectedAt : undefined;
    const timing = typeof timingOrDetectedAt === 'number' ? undefined : timingOrDetectedAt;
    const dispatchAnchor = sanitizeTimestamp(
        getCopyTradeDispatchDetectedAt(timing, legacyDetectedAt),
        nowMs
    );
    const firstSeenAt = sanitizeTimestamp(timing?.firstSeenAt ?? legacyDetectedAt, nowMs);
    const delayMs = dispatchAnchor ? Math.max(0, nowMs - dispatchAnchor) : 0;
    const hardDelayMs = firstSeenAt ? Math.max(0, nowMs - firstSeenAt) : delayMs;

    if (firstSeenAt && hardDelayMs > limits.hardMaxDelayMs) {
        return {
            skip: true,
            delayMs,
            hardDelayMs,
            maxDelayMs: limits.maxDelayMs,
            delayAnchor: dispatchAnchor === firstSeenAt
                ? (legacyDetectedAt ? 'legacy_detected_at' : 'first_seen')
                : 'dispatch_eligible',
            reasonCode: 'copytrade_delay_exceeded_hard_cap'
        };
    }

    if (turboMode && dispatchAnchor && delayMs > limits.maxDelayMs) {
        let delayAnchor: CopyTradeDelayCheckResult['delayAnchor'] = 'dispatch_eligible';
        if (!timing?.dispatchEligibleAt && timing?.swapReadyAt && dispatchAnchor === timing.swapReadyAt) {
            delayAnchor = 'swap_ready';
        } else if (!timing?.dispatchEligibleAt && !timing?.swapReadyAt && timing?.firstSeenAt && dispatchAnchor === timing.firstSeenAt) {
            delayAnchor = 'first_seen';
        } else if (!timing && legacyDetectedAt && dispatchAnchor === legacyDetectedAt) {
            delayAnchor = 'legacy_detected_at';
        }
        return {
            skip: true,
            delayMs,
            hardDelayMs,
            maxDelayMs: limits.maxDelayMs,
            delayAnchor,
            reasonCode: 'copytrade_delay_exceeded_dispatch'
        };
    }

    return {
        skip: false,
        delayMs,
        hardDelayMs,
        maxDelayMs: limits.maxDelayMs,
        delayAnchor: dispatchAnchor ? 'dispatch_eligible' : 'none'
    };
}
