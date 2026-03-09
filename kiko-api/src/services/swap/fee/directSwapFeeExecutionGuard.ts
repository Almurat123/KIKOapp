import crypto from 'node:crypto';

import { Prisma } from '@prisma/client';

import { LogCode } from '../../../config/logRegistry.js';
import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';

const STALE_SENDING_MS = 120_000;

type FeeExecutionRow = {
  status: string;
  fee_tx_hash: string | null;
  updated_at: Date;
  attempt_count: number;
};

export type DirectSwapFeeClaimResult =
  | {
    status: 'claimed';
    reasonCode: 'fee_claim_new' | 'fee_claim_retry';
    attemptCount: number;
  }
  | {
    status: 'already_sent';
    reasonCode: 'fee_already_sent';
    feeTxHash?: string;
  }
  | {
    status: 'inflight';
    reasonCode: 'fee_inflight_active' | 'fee_inflight_takeover_lost' | 'fee_inflight_unknown_state' | 'fee_inflight_row_missing';
  };

export interface DirectSwapFeeClaimParams {
  feeExecutionKey: string;
  userId: string;
  chainId: number;
  sourceTxHash: string;
  mode: string;
  feeToken: string;
  feeRecipient: string;
  feeBps: number;
}

export interface DirectSwapFeeExecutionInsertRow {
  id: string;
  feeKey: string;
  userId: string;
  chainId: number;
  sourceTxHash: string;
  mode: string;
  feeToken: string;
  feeRecipient: string;
  feeBps: number;
}

function normalizeKey(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function toRowCount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  return 0;
}

async function findFeeExecutionRow(feeExecutionKey: string): Promise<FeeExecutionRow | null> {
  const rows = await prisma.$queryRaw<FeeExecutionRow[]>`
    SELECT status, fee_tx_hash, updated_at, attempt_count
    FROM direct_swap_fee_execution
    WHERE fee_key = ${feeExecutionKey}
    LIMIT 1
  `;
  return rows[0] || null;
}

export function buildDirectSwapFeeExecutionKey(params: {
  userId: string;
  chainId: number;
  sourceTxHash: string;
  mode: string;
  feeToken: string;
  feeRecipient: string;
  feeBps: number;
}): string {
  return [
    String(params.chainId),
    normalizeKey(params.mode),
    normalizeKey(params.userId),
    normalizeKey(params.sourceTxHash),
    normalizeKey(params.feeToken),
    normalizeKey(params.feeRecipient),
    String(Math.max(0, Math.floor(Number(params.feeBps) || 0)))
  ].join(':');
}

export function buildDirectSwapFeeExecutionInsertRow(
  params: DirectSwapFeeClaimParams & { feeExecutionKey?: string }
): DirectSwapFeeExecutionInsertRow {
  const feeExecutionKey = normalizeKey(params.feeExecutionKey || '');
  return {
    id: crypto.randomUUID(),
    feeKey: feeExecutionKey,
    userId: String(params.userId || ''),
    chainId: Number(params.chainId || 0),
    sourceTxHash: normalizeKey(params.sourceTxHash),
    mode: String(params.mode || ''),
    feeToken: normalizeKey(params.feeToken),
    feeRecipient: normalizeKey(params.feeRecipient),
    feeBps: Math.max(0, Math.floor(Number(params.feeBps) || 0))
  };
}

export async function claimDirectSwapFeeExecution(params: DirectSwapFeeClaimParams): Promise<DirectSwapFeeClaimResult> {
  const feeExecutionKey = normalizeKey(params.feeExecutionKey);
  if (!feeExecutionKey) {
    return {
      status: 'inflight',
      reasonCode: 'fee_inflight_row_missing'
    };
  }

  const insertRow = buildDirectSwapFeeExecutionInsertRow({
    ...params,
    feeExecutionKey
  });

  try {
    await prisma.$executeRaw`
      INSERT INTO direct_swap_fee_execution (
        id,
        fee_key,
        user_id,
        chain_id,
        source_tx_hash,
        mode,
        fee_token,
        fee_recipient,
        fee_bps,
        status,
        attempt_count,
        created_at,
        updated_at
      )
      VALUES (
        ${insertRow.id},
        ${insertRow.feeKey},
        ${insertRow.userId},
        ${insertRow.chainId},
        ${insertRow.sourceTxHash},
        ${insertRow.mode},
        ${insertRow.feeToken},
        ${insertRow.feeRecipient},
        ${insertRow.feeBps},
        'sending',
        1,
        NOW(),
        NOW()
      )
    `;
    return {
      status: 'claimed',
      reasonCode: 'fee_claim_new',
      attemptCount: 1
    };
  } catch (error: any) {
    const isUniqueConflict = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
    if (!isUniqueConflict) throw error;
  }

  const existing = await findFeeExecutionRow(feeExecutionKey);
  if (!existing) {
    return {
      status: 'inflight',
      reasonCode: 'fee_inflight_row_missing'
    };
  }

  if (existing.status === 'sent') {
    return {
      status: 'already_sent',
      reasonCode: 'fee_already_sent',
      feeTxHash: existing.fee_tx_hash || undefined
    };
  }

  if (existing.status === 'sending') {
    const staleThreshold = new Date(Date.now() - STALE_SENDING_MS);
    const takeoverRows = toRowCount(await prisma.$executeRaw`
      UPDATE direct_swap_fee_execution
      SET attempt_count = attempt_count + 1,
          updated_at = NOW(),
          last_error = NULL
      WHERE fee_key = ${feeExecutionKey}
        AND status = 'sending'
        AND updated_at <= ${staleThreshold}
    `);
    if (takeoverRows > 0) {
      return {
        status: 'claimed',
        reasonCode: 'fee_claim_retry',
        attemptCount: (existing.attempt_count || 0) + 1
      };
    }
    return {
      status: 'inflight',
      reasonCode: 'fee_inflight_active'
    };
  }

  if (existing.status === 'failed') {
    const retryRows = toRowCount(await prisma.$executeRaw`
      UPDATE direct_swap_fee_execution
      SET status = 'sending',
          attempt_count = attempt_count + 1,
          updated_at = NOW(),
          last_error = NULL
      WHERE fee_key = ${feeExecutionKey}
        AND status = 'failed'
    `);
    if (retryRows > 0) {
      return {
        status: 'claimed',
        reasonCode: 'fee_claim_retry',
        attemptCount: (existing.attempt_count || 0) + 1
      };
    }
    const reloaded = await findFeeExecutionRow(feeExecutionKey);
    if (reloaded?.status === 'sent') {
      return {
        status: 'already_sent',
        reasonCode: 'fee_already_sent',
        feeTxHash: reloaded.fee_tx_hash || undefined
      };
    }
    return {
      status: 'inflight',
      reasonCode: 'fee_inflight_takeover_lost'
    };
  }

  return {
    status: 'inflight',
    reasonCode: 'fee_inflight_unknown_state'
  };
}

export async function markDirectSwapFeeExecutionSent(params: {
  feeExecutionKey: string;
  feeTxHash: string;
  feeAmount: string;
  feeToken: string;
  feeRecipient: string;
}): Promise<void> {
  const feeExecutionKey = normalizeKey(params.feeExecutionKey);
  if (!feeExecutionKey) return;
  await prisma.$executeRaw`
    UPDATE direct_swap_fee_execution
    SET status = 'sent',
        fee_tx_hash = ${params.feeTxHash},
        fee_amount = ${params.feeAmount},
        fee_token = ${normalizeKey(params.feeToken)},
        fee_recipient = ${normalizeKey(params.feeRecipient)},
        sent_at = NOW(),
        updated_at = NOW(),
        last_error = NULL
    WHERE fee_key = ${feeExecutionKey}
  `;
}

export async function markDirectSwapFeeExecutionFailed(params: {
  feeExecutionKey: string;
  error: string;
}): Promise<void> {
  const feeExecutionKey = normalizeKey(params.feeExecutionKey);
  if (!feeExecutionKey) return;
  const errorText = String(params.error || '').slice(0, 1024);
  const rowCount = toRowCount(await prisma.$executeRaw`
    UPDATE direct_swap_fee_execution
    SET status = 'failed',
        last_error = ${errorText},
        updated_at = NOW()
    WHERE fee_key = ${feeExecutionKey}
  `);
  if (rowCount <= 0) {
    logger.warn(LogCode.SYS_INFO, '[DirectSwapFeeExecution] Mark failed skipped: execution row missing', {
      feeExecutionKey: feeExecutionKey.slice(0, 64)
    });
  }
}
