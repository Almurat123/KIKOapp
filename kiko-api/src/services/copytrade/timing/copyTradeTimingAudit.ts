import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { CopyTradeTimingSnapshot } from './copyTradeTimingModel.js';

function toIso(value?: number | null): string | null {
    if (!Number.isFinite(value as number)) return null;
    try {
        return new Date(Number(value)).toISOString();
    } catch {
        return null;
    }
}

export function buildCopyTradeTimingAuditFields(
    timing: CopyTradeTimingSnapshot | undefined,
    extra?: Record<string, unknown>
): Record<string, unknown> {
    return {
        firstSeenAt: timing?.firstSeenAt || null,
        firstSeenAtIso: toIso(timing?.firstSeenAt),
        swapReadyAt: timing?.swapReadyAt || null,
        swapReadyAtIso: toIso(timing?.swapReadyAt),
        dispatchEligibleAt: timing?.dispatchEligibleAt || null,
        dispatchEligibleAtIso: toIso(timing?.dispatchEligibleAt),
        enqueuedAt: timing?.enqueuedAt || null,
        enqueuedAtIso: toIso(timing?.enqueuedAt),
        timingSource: timing?.source || null,
        ...(extra || {})
    };
}

export function emitCopyTradeTimingAudit(
    stage: string,
    timing: CopyTradeTimingSnapshot | undefined,
    extra?: Record<string, unknown>
): void {
    logger.info(LogCode.SYS_INFO, `[CopyTradeTimingAudit] ${stage}`, buildCopyTradeTimingAuditFields(timing, extra));
}
