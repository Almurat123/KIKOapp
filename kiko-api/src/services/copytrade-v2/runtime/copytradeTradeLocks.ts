import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const scopedTradeLocks = new Map<string, Promise<any>>();
const scopedTokenLocks = new Map<string, number>();

const TRADE_LOCK_TIMEOUT_MS = 90000;
const TOKEN_LOCK_DURATION_MS = 30000;

function buildChainScopedKey(userId: string, chainId: number, tokenAddress: string): string {
    return `${userId}:${chainId}:${tokenAddress.toLowerCase()}`;
}

export function buildCopytradeTradeScopeKey(userId: string, chainId: number, tokenAddress: string): string {
    return buildChainScopedKey(userId, chainId, tokenAddress);
}

export async function withCopytradeTradeLock<T>(scopeKey: string, fn: () => Promise<T>): Promise<T> {
    const existingLock = scopedTradeLocks.get(scopeKey);
    if (existingLock) {
        logger.debug(LogCode.WTC_TX_SKIPPED, `Waiting for existing trade lock for scope ${scopeKey.slice(0, 32)}...`, { scopeKey });
        try {
            await Promise.race([
                existingLock,
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Lock timeout')), TRADE_LOCK_TIMEOUT_MS)
                )
            ]);
        } catch (err: any) {
            if (err.message === 'Lock timeout') {
                logger.warn(LogCode.SYS_ERROR, 'Trade lock timeout, forcing lock release', {
                    scopeKey: scopeKey.slice(0, 32)
                });
                scopedTradeLocks.delete(scopeKey);
            }
        }
    }

    const lockPromise = fn();
    scopedTradeLocks.set(scopeKey, lockPromise);

    try {
        return await lockPromise;
    } finally {
        if (scopedTradeLocks.get(scopeKey) === lockPromise) {
            scopedTradeLocks.delete(scopeKey);
        }
    }
}

export function isCopytradeTokenLockedForUser(
    userId: string,
    chainId: number,
    tokenAddress: string,
    sourceTxHash?: string
): boolean {
    const normalizedTxHash = String(sourceTxHash || '').toLowerCase();
    const baseKey = buildChainScopedKey(userId, chainId, tokenAddress);
    const key = normalizedTxHash ? `${baseKey}:${normalizedTxHash}` : baseKey;
    const lockTime = scopedTokenLocks.get(key);
    const now = Date.now();

    if (lockTime && now - lockTime < TOKEN_LOCK_DURATION_MS) {
        return true;
    }

    scopedTokenLocks.set(key, now);

    if (scopedTokenLocks.size > 500) {
        for (const [candidateKey, timestamp] of scopedTokenLocks.entries()) {
            if (now - timestamp > TOKEN_LOCK_DURATION_MS) {
                scopedTokenLocks.delete(candidateKey);
            }
        }
    }

    return false;
}

export function __resetCopytradeTradeLocksForTests(): void {
    scopedTradeLocks.clear();
    scopedTokenLocks.clear();
}
