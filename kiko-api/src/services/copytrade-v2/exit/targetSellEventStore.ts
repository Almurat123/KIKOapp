import { Prisma } from '@prisma/client';

import prisma from '../../../db/prisma.js';
import { getJson as cacheGetJson, setJson as cacheSetJson } from '../../../cache/cacheClient.js';
import { normalizeToken, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import type { TargetSellEventPayload } from './intentTypes.js';

// CONTEXT MEMORY
// Updated: 2026-04-13
// Author: Avery Lin
// Reason: Copytrade needs one durable sell-fact owner while webhook/pending/recovery remain temporary signal layers.
// Goal: Preserve a durable mirror-sell memory that later owner layers can replay without silently leaving open positions stranded in monitoring loops.
// Owns: Target-sell event persistence, normalization, and bounded replay queries.
// Does Not Own: Webhook ingress attribution, buy-confirmation state transitions, exit-intent scheduling, or deciding whether a replayed sell should execute immediately.
// Design Language:
// - Durable sell events must be queryable by token wallet scope, not only by hash.
// - Historical replay must be bounded by caller-provided anchors to avoid stale reuse.
// - Webhook memory is not durable sell truth; targetSellEventStore is.
// - Do not hide race recovery inside cache-only behavior.
// - Forbidden local patch patterns: treating ingress-state timestamps as substitute durable sell evidence.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: durable sell owner boundary and replay rules
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/owner-map/copytrade-webhook-ingress.md
// - Kind: repo doc
// - Retrieved: 2026-04-13
// - Applied To: webhook-to-durable-sell handoff boundary
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/copytrade-race-recovery.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-webhook-ingress.md
// - /Users/almurat/KiKo/system-journal/owner-map/copytrade-buy-confirmation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-buy-confirm-target-sell-replay-gap.md

const TARGET_SELL_EVENT_TTL_SEC = Math.max(30, Number(process.env.COPYTRADE_TARGET_SELL_EVENT_TTL_SEC || '60'));

export interface TargetSellEventRecord {
  id: string;
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  targetSellTxHash: string;
  targetSellRatioBps: number | null;
  targetFullExitVerified: boolean;
  targetRemainingBalanceRaw: string | null;
  detectedAt: Date;
  source: string;
  metadata: Record<string, unknown> | null;
}

function cacheKey(params: {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  targetSellTxHash: string;
}): string {
  return `copytrade:target_sell_event:${params.chainId}:${params.targetWallet}:${params.tokenAddress}:${params.targetSellTxHash.toLowerCase()}`;
}

function latestCacheKey(params: {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
}): string {
  return `copytrade:target_sell_event_latest:${params.chainId}:${params.targetWallet}:${params.tokenAddress}`;
}

function normalizePayload(input: TargetSellEventPayload) {
  return {
    chainId: input.chainId,
    targetWallet: normalizeWallet(input.chainId, input.targetWallet),
    tokenAddress: normalizeToken(input.chainId, input.tokenAddress),
    targetSellTxHash: String(input.targetSellTxHash || '').trim(),
    targetSellRatioBps: Number.isFinite(Number(input.targetSellRatioBps))
      ? Math.max(0, Math.min(10_000, Math.floor(Number(input.targetSellRatioBps))))
      : null,
    targetFullExitVerified: Boolean(input.targetFullExitVerified),
    targetRemainingBalanceRaw: input.targetRemainingBalanceRaw ? String(input.targetRemainingBalanceRaw) : null,
    detectedAt: input.detectedAt || new Date(),
    source: input.source,
    metadata: input.metadata || null,
  };
}

function toRecord(row: any): TargetSellEventRecord {
  return {
    id: row.id,
    chainId: row.chainId,
    targetWallet: row.targetWallet,
    tokenAddress: row.tokenAddress,
    targetSellTxHash: row.targetSellTxHash,
    targetSellRatioBps: row.targetSellRatioBps ?? null,
    targetFullExitVerified: Boolean(row.targetFullExitVerified),
    targetRemainingBalanceRaw: row.targetRemainingBalanceRaw || null,
    detectedAt: row.detectedAt,
    source: row.source,
    metadata: (row.metadataJson as Record<string, unknown> | null) || null,
  };
}

export async function upsertTargetSellEvent(input: TargetSellEventPayload): Promise<TargetSellEventRecord> {
  const normalized = normalizePayload(input);
  const identity = {
    chainId_targetWallet_tokenAddress_targetSellTxHash: {
      chainId: normalized.chainId,
      targetWallet: normalized.targetWallet,
      tokenAddress: normalized.tokenAddress,
      targetSellTxHash: normalized.targetSellTxHash,
    },
  };
  const existing = await prisma.targetSellEvent.findUnique({ where: identity }).catch(() => null);
  const metadata = {
    ...((existing?.metadataJson as Record<string, unknown> | null) || {}),
    ...(normalized.metadata || {}),
  };
  const row = await prisma.targetSellEvent.upsert({
    where: identity,
    create: {
      chainId: normalized.chainId,
      targetWallet: normalized.targetWallet,
      tokenAddress: normalized.tokenAddress,
      targetSellTxHash: normalized.targetSellTxHash,
      targetSellRatioBps: normalized.targetSellRatioBps,
      targetFullExitVerified: normalized.targetFullExitVerified,
      targetRemainingBalanceRaw: normalized.targetRemainingBalanceRaw,
      detectedAt: normalized.detectedAt,
      source: normalized.source,
      metadataJson: Object.keys(metadata).length > 0 ? metadata as Prisma.InputJsonValue : undefined,
    },
    update: {
      targetSellRatioBps: normalized.targetSellRatioBps ?? existing?.targetSellRatioBps ?? undefined,
      targetFullExitVerified: normalized.targetFullExitVerified || Boolean(existing?.targetFullExitVerified),
      targetRemainingBalanceRaw: normalized.targetRemainingBalanceRaw || existing?.targetRemainingBalanceRaw || undefined,
      detectedAt: existing?.detectedAt || normalized.detectedAt,
      source: normalized.source,
      metadataJson: Object.keys(metadata).length > 0 ? metadata as Prisma.InputJsonValue : Prisma.JsonNull,
    },
  });
  const record = toRecord(row);
  await cacheSetJson(cacheKey(record), record, TARGET_SELL_EVENT_TTL_SEC).catch(() => undefined);
  await cacheSetJson(latestCacheKey(record), record, TARGET_SELL_EVENT_TTL_SEC).catch(() => undefined);
  return record;
}

export async function getTargetSellEvent(input: {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  targetSellTxHash: string;
}): Promise<TargetSellEventRecord | null> {
  const normalized = {
    chainId: input.chainId,
    targetWallet: normalizeWallet(input.chainId, input.targetWallet),
    tokenAddress: normalizeToken(input.chainId, input.tokenAddress),
    targetSellTxHash: String(input.targetSellTxHash || '').trim(),
  };
  const key = cacheKey(normalized);
  const cached = await cacheGetJson<TargetSellEventRecord>(key).catch(() => null);
  if (cached) return cached;
  const row = await prisma.targetSellEvent.findUnique({
    where: {
      chainId_targetWallet_tokenAddress_targetSellTxHash: normalized,
    },
  });
  if (!row) return null;
  const record = toRecord(row);
  await cacheSetJson(key, record, TARGET_SELL_EVENT_TTL_SEC).catch(() => undefined);
  return record;
}

export async function findLatestTargetSellEvent(input: {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
}): Promise<TargetSellEventRecord | null> {
  const normalized = {
    chainId: input.chainId,
    targetWallet: normalizeWallet(input.chainId, input.targetWallet),
    tokenAddress: normalizeToken(input.chainId, input.tokenAddress),
  };
  const key = latestCacheKey(normalized);
  const cached = await cacheGetJson<TargetSellEventRecord>(key).catch(() => null);
  if (cached) return cached;

  const row = await prisma.targetSellEvent.findFirst({
    where: {
      chainId: normalized.chainId,
      targetWallet: normalized.targetWallet,
      tokenAddress: normalized.tokenAddress,
    },
    orderBy: [{ updatedAt: 'desc' }, { detectedAt: 'desc' }],
  });
  if (!row) return null;
  const record = toRecord(row);
  await cacheSetJson(key, record, TARGET_SELL_EVENT_TTL_SEC).catch(() => undefined);
  await cacheSetJson(cacheKey(record), record, TARGET_SELL_EVENT_TTL_SEC).catch(() => undefined);
  return record;
}

export async function findLatestTargetSellEventSince(input: {
  chainId: number;
  targetWallet: string;
  tokenAddress: string;
  detectedAfter?: Date | null;
}): Promise<TargetSellEventRecord | null> {
  if (!(input.detectedAfter instanceof Date)) {
    return findLatestTargetSellEvent(input);
  }

  const normalized = {
    chainId: input.chainId,
    targetWallet: normalizeWallet(input.chainId, input.targetWallet),
    tokenAddress: normalizeToken(input.chainId, input.tokenAddress),
  };

  const row = await prisma.targetSellEvent.findFirst({
    where: {
      chainId: normalized.chainId,
      targetWallet: normalized.targetWallet,
      tokenAddress: normalized.tokenAddress,
      detectedAt: { gte: input.detectedAfter },
    },
    orderBy: [{ updatedAt: 'desc' }, { detectedAt: 'desc' }],
  });
  return row ? toRecord(row) : null;
}

export async function findRecentTargetSellEvents(input: {
  chainIds: number[];
  targetWallets: string[];
  detectedAfter: Date;
  take?: number;
}): Promise<TargetSellEventRecord[]> {
  const chainIds = [...new Set(input.chainIds.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))];
  const targetWallets = [...new Set(
    input.targetWallets
      .map((wallet) => String(wallet || '').trim().toLowerCase())
      .filter(Boolean),
  )];
  if (chainIds.length === 0 || targetWallets.length === 0) return [];

  const rows = await prisma.targetSellEvent.findMany({
    where: {
      chainId: { in: chainIds },
      targetWallet: { in: targetWallets },
      detectedAt: { gte: input.detectedAfter },
    },
    orderBy: [{ updatedAt: 'desc' }, { detectedAt: 'desc' }],
    take: Math.max(1, Math.min(500, Number(input.take || 200))),
  });
  return rows.map(toRecord);
}

export async function replaceTargetSellEventMetadata(
  eventId: string,
  metadata: Record<string, unknown> | null,
): Promise<TargetSellEventRecord | null> {
  const normalizedId = String(eventId || '').trim();
  if (!normalizedId) return null;
  const row = await prisma.targetSellEvent.update({
    where: { id: normalizedId },
    data: {
      metadataJson: metadata && Object.keys(metadata).length > 0
        ? metadata as Prisma.InputJsonValue
        : Prisma.JsonNull,
    },
  }).catch(() => null);
  if (!row) return null;

  const record = toRecord(row);
  await cacheSetJson(cacheKey(record), record, TARGET_SELL_EVENT_TTL_SEC).catch(() => undefined);
  await cacheSetJson(latestCacheKey(record), record, TARGET_SELL_EVENT_TTL_SEC).catch(() => undefined);
  return record;
}
