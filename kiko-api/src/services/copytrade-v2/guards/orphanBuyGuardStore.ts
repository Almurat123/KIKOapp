import prisma from '../../../db/prisma.js';
import { normalizeAddress } from '../../../utils/address.js';

export type ActiveCopytradeOrphanBuyGuard = {
  positionId: string;
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  targetWallet: string;
  reasonCode: string | null;
  source: string | null;
};

let ensured = false;

export async function ensureCopytradeOrphanBuyGuardTable(): Promise<void> {
  if (ensured) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS copytrade_orphan_buy_guards (
      position_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      config_id TEXT NOT NULL,
      chain_id INT NOT NULL,
      token_address TEXT NOT NULL,
      target_wallet TEXT NOT NULL,
      reason_code TEXT,
      source TEXT,
      metadata_json JSONB,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      cleared_at TIMESTAMPTZ
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_copytrade_orphan_buy_guards_active_lookup
      ON copytrade_orphan_buy_guards (config_id, chain_id, token_address, active, updated_at DESC);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_copytrade_orphan_buy_guards_active_position
      ON copytrade_orphan_buy_guards (active, position_id);
  `);
  ensured = true;
}

export async function activateCopytradeOrphanBuyGuard(params: {
  positionId: string;
  userId: string;
  configId: string;
  chainId: number;
  tokenAddress: string;
  targetWallet?: string | null;
  reasonCode?: string | null;
  source: string;
  metadata?: unknown;
}): Promise<void> {
  await ensureCopytradeOrphanBuyGuardTable();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO copytrade_orphan_buy_guards (
        position_id,
        user_id,
        config_id,
        chain_id,
        token_address,
        target_wallet,
        reason_code,
        source,
        metadata_json,
        active,
        cleared_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, TRUE, NULL, NOW())
      ON CONFLICT (position_id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          config_id = EXCLUDED.config_id,
          chain_id = EXCLUDED.chain_id,
          token_address = EXCLUDED.token_address,
          target_wallet = EXCLUDED.target_wallet,
          reason_code = EXCLUDED.reason_code,
          source = EXCLUDED.source,
          metadata_json = EXCLUDED.metadata_json,
          active = TRUE,
          cleared_at = NULL,
          updated_at = NOW()
    `,
    String(params.positionId),
    String(params.userId),
    String(params.configId),
    Number(params.chainId),
    normalizeGuardTokenAddress(params.chainId, params.tokenAddress),
    normalizeGuardWallet(params.chainId, params.targetWallet),
    params.reasonCode || null,
    params.source,
    JSON.stringify(params.metadata || {}),
  );
}

export async function clearCopytradeOrphanBuyGuardForPosition(params: {
  positionId: string;
  source: string;
  metadata?: unknown;
}): Promise<boolean> {
  await ensureCopytradeOrphanBuyGuardTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ position_id: string }>>(
    `
      UPDATE copytrade_orphan_buy_guards
      SET active = FALSE,
          source = $2,
          metadata_json = $3::jsonb,
          cleared_at = NOW(),
          updated_at = NOW()
      WHERE position_id = $1 AND active = TRUE
      RETURNING position_id
    `,
    String(params.positionId),
    params.source,
    JSON.stringify(params.metadata || {}),
  );
  return rows.length > 0;
}

export async function pruneResolvedCopytradeOrphanBuyGuards(params?: {
  limit?: number;
}): Promise<number> {
  await ensureCopytradeOrphanBuyGuardTable();
  const limit = Math.max(1, Number(params?.limit || 500));
  const rows = await prisma.$queryRawUnsafe<Array<{ position_id: string }>>(
    `
      SELECT position_id
      FROM copytrade_orphan_buy_guards
      WHERE active = TRUE
      ORDER BY updated_at ASC
      LIMIT $1
    `,
    limit,
  );
  if (rows.length === 0) return 0;
  const positionIds = rows.map((row) => String(row.position_id || '')).filter(Boolean);
  if (positionIds.length === 0) return 0;
  const positions = await prisma.position.findMany({
    where: { id: { in: positionIds } },
    select: { id: true, status: true, closedAt: true },
  });
  const openIds = new Set(
    positions
      .filter((position) => position.status === 'open' && !position.closedAt)
      .map((position) => position.id),
  );
  const staleIds = positionIds.filter((positionId) => !openIds.has(positionId));
  if (staleIds.length === 0) return 0;
  await prisma.$executeRawUnsafe(
    `
      UPDATE copytrade_orphan_buy_guards
      SET active = FALSE,
          source = 'resolved_position_cleanup',
          cleared_at = NOW(),
          updated_at = NOW()
      WHERE active = TRUE
        AND position_id = ANY($1::text[])
    `,
    staleIds,
  );
  return staleIds.length;
}

export async function listActiveCopytradeOrphanBuyGuardsForConfigs(params: {
  configIds: string[];
  chainId: number;
  tokenAddress: string;
}): Promise<ActiveCopytradeOrphanBuyGuard[]> {
  await ensureCopytradeOrphanBuyGuardTable();
  const configIds = params.configIds.map((value) => String(value || '').trim()).filter(Boolean);
  if (configIds.length === 0) return [];
  const rows = await prisma.$queryRawUnsafe<Array<{
    position_id: string;
    user_id: string;
    config_id: string;
    chain_id: number;
    token_address: string;
    target_wallet: string;
    reason_code: string | null;
    source: string | null;
  }>>(
    `
      SELECT
        position_id,
        user_id,
        config_id,
        chain_id,
        token_address,
        target_wallet,
        reason_code,
        source
      FROM copytrade_orphan_buy_guards
      WHERE active = TRUE
        AND chain_id = $1
        AND token_address = $2
        AND config_id = ANY($3::text[])
    `,
    Number(params.chainId),
    normalizeGuardTokenAddress(params.chainId, params.tokenAddress),
    configIds,
  );
  return rows.map((row) => ({
    positionId: String(row.position_id),
    userId: String(row.user_id),
    configId: String(row.config_id),
    chainId: Number(row.chain_id),
    tokenAddress: String(row.token_address),
    targetWallet: String(row.target_wallet),
    reasonCode: row.reason_code || null,
    source: row.source || null,
  }));
}

export function partitionConfigsByActiveOrphanBuyGuards<T extends { id: string }>(
  configs: T[],
  guards: ActiveCopytradeOrphanBuyGuard[],
): {
  allowed: T[];
  blocked: T[];
  guardByConfigId: Map<string, ActiveCopytradeOrphanBuyGuard[]>;
} {
  const guardByConfigId = new Map<string, ActiveCopytradeOrphanBuyGuard[]>();
  for (const guard of guards) {
    const bucket = guardByConfigId.get(guard.configId) || [];
    bucket.push(guard);
    guardByConfigId.set(guard.configId, bucket);
  }
  const allowed: T[] = [];
  const blocked: T[] = [];
  for (const config of configs) {
    if (guardByConfigId.has(String(config.id))) {
      blocked.push(config);
    } else {
      allowed.push(config);
    }
  }
  return { allowed, blocked, guardByConfigId };
}

function normalizeGuardTokenAddress(chainId: number, tokenAddress: string): string {
  const normalized = String(tokenAddress || '').trim();
  if (!normalized) return '';
  if (chainId === 900) return normalized;
  return normalizeAddress(normalized) || normalized.toLowerCase();
}

function normalizeGuardWallet(chainId: number, targetWallet?: string | null): string {
  const normalized = String(targetWallet || '').trim();
  if (!normalized) return '';
  if (chainId === 900) return normalized;
  return normalizeAddress(normalized) || normalized.toLowerCase();
}
