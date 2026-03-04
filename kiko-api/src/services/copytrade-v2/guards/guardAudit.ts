import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

export function roundGuardNumber(value: unknown, digits: number = 2): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const factor = 10 ** digits;
    return Math.round(n * factor) / factor;
}

export function emitCopyTradeBuyGuardAudit(
    payload: Record<string, unknown>,
    decision: 'pass' | 'skip',
    reason: string,
    extra?: Record<string, unknown>
): void {
    logger.info(LogCode.SYS_INFO, '[CopyTradeGuardAudit] buy guard summary', {
        ...payload,
        decision,
        reason,
        ...(extra || {})
    });
}
