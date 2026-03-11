import { Prisma } from '@prisma/client';

import prisma from '../../../db/prisma.js';
import { getJson as cacheGetJson, setJson as cacheSetJson } from '../../../cache/cacheClient.js';
import { normalizeToken, normalizeWallet } from '../runtime/chainIdentityNormalizer.js';
import type { TargetSellEventPayload } from './intentTypes.js';

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
