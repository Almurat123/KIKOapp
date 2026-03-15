import prisma from '../../../db/prisma.js';
import { releaseLock as releaseRedisLock, setIfNotExists, isRedisAvailable } from '../../../cache/cacheClient.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

const TOKEN_EXIT_LOCK_TTL_SECONDS = Math.max(10, Number(process.env.COPYTRADE_TOKEN_EXIT_LOCK_TTL_SECONDS || '45'));
const TOKEN_EXIT_LOCK_REDIS_PREFIX = 'copytrade:exit-token-lock:redis:v1';
const TOKEN_EXIT_LOCK_DB_PREFIX = 'copytrade:exit-token-lock:db:v1';

export interface DistributedTokenExitLock {
  owner: string;
  redisKey: string;
  dbKey: string;
  redisAcquired: boolean;
  dbAcquired: boolean;
}

function normalizeWalletScope(walletAddress?: string | null, ownerScope?: string | null): string {
  const normalizedWallet = String(walletAddress || '').trim().toLowerCase();
  if (normalizedWallet) return normalizedWallet;
  const normalizedOwnerScope = String(ownerScope || '').trim().toLowerCase();
  return normalizedOwnerScope || 'unknown-wallet';
}

export function buildTokenExitLockScopeKey(params: {
  chainId: number;
  tokenAddress: string;
  walletAddress?: string | null;
  ownerScope?: string | null;
}): string {
  return [
    params.chainId,
    String(params.tokenAddress || '').toLowerCase(),
    normalizeWalletScope(params.walletAddress, params.ownerScope),
  ].join(':');
}

function buildScopedKey(prefix: string, scopeKey: string): string {
  return `${prefix}:${scopeKey}`;
}

async function acquireDbLock(key: string, owner: string): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + TOKEN_EXIT_LOCK_TTL_SECONDS * 1000);
    const rows = await prisma.$queryRaw<Array<{ key: string }>>`
      INSERT INTO "Cache" ("key", "value", "expiresAt", "createdAt", "updatedAt")
      VALUES (${key}, ${owner}, ${expiresAt}, NOW(), NOW())
      ON CONFLICT ("key") DO UPDATE
      SET "value" = EXCLUDED."value",
          "expiresAt" = EXCLUDED."expiresAt",
          "updatedAt" = NOW()
      WHERE "Cache"."expiresAt" IS NULL OR "Cache"."expiresAt" < NOW()
      RETURNING "key"
    `;
    return rows.length > 0;
  } catch (error: any) {
    logger.error(LogCode.SYS_ERROR, 'Failed to acquire DB token exit lock', {
      key,
      error: error?.message || String(error),
    });
    return false;
  }
}

async function releaseDbLock(key: string, owner: string): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM "Cache"
      WHERE "key" = ${key}
        AND "value" = ${owner}
    `;
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, 'Failed to release DB token exit lock', {
      key,
      error: error?.message || String(error),
    });
  }
}

export async function acquireDistributedTokenExitLock(params: {
  chainId: number;
  tokenAddress: string;
  walletAddress?: string | null;
  ownerScope?: string | null;
  owner: string;
}): Promise<DistributedTokenExitLock | null> {
  const scopeKey = buildTokenExitLockScopeKey({
    chainId: params.chainId,
    tokenAddress: params.tokenAddress,
    walletAddress: params.walletAddress,
    ownerScope: params.ownerScope,
  });
  const redisKey = buildScopedKey(TOKEN_EXIT_LOCK_REDIS_PREFIX, scopeKey);
  const dbKey = buildScopedKey(TOKEN_EXIT_LOCK_DB_PREFIX, scopeKey);
  const redisReady = isRedisAvailable();

  let redisAcquired = false;
  if (redisReady) {
    redisAcquired = await setIfNotExists(redisKey, params.owner, TOKEN_EXIT_LOCK_TTL_SECONDS);
    if (!redisAcquired) {
      logger.info(LogCode.WTC_TX_SKIPPED, 'Distributed token exit lock blocked by Redis', {
        chainId: params.chainId,
        token: params.tokenAddress,
        walletAddress: params.walletAddress || null,
        redisKey,
      });
      return null;
    }
  }

  const dbAcquired = await acquireDbLock(dbKey, params.owner);
  if (!dbAcquired) {
    if (redisAcquired) {
      await releaseRedisLock(redisKey, params.owner).catch(() => {});
    }
    logger.info(LogCode.WTC_TX_SKIPPED, 'Distributed token exit lock blocked by DB', {
      chainId: params.chainId,
      token: params.tokenAddress,
      walletAddress: params.walletAddress || null,
      dbKey,
    });
    return null;
  }

  if (!redisReady) {
    logger.warn(LogCode.SYS_INFO, 'Redis unavailable for token exit lock; DB lock only', {
      chainId: params.chainId,
      token: params.tokenAddress,
      walletAddress: params.walletAddress || null,
      dbKey,
    });
  }

  return {
    owner: params.owner,
    redisKey,
    dbKey,
    redisAcquired,
    dbAcquired,
  };
}

export async function releaseDistributedTokenExitLock(lock: DistributedTokenExitLock | null | undefined): Promise<void> {
  if (!lock) return;
  if (lock.dbAcquired) {
    await releaseDbLock(lock.dbKey, lock.owner);
  }
  if (lock.redisAcquired) {
    await releaseRedisLock(lock.redisKey, lock.owner).catch(() => {});
  }
}

export const __testOnly = {
  buildTokenExitLockScopeKey,
};
