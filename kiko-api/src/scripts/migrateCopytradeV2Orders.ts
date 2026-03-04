import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const BATCH_SIZE = 200;

function toMode(mode: string | null | undefined): 'turbo' | 'normal' | 'safety' {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'turbo') return 'turbo';
  if (normalized === 'safe' || normalized === 'safety') return 'safety';
  return 'normal';
}

function mapPositionStatusToLifecycle(status: string): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'closed') return 'EXIT_CONFIRMED_CLOSED';
  if (normalized === 'open') return 'EXIT_ARMED';
  if (normalized === 'closing' || normalized === 'close_pending') return 'EXIT_SUBMITTING';
  if (normalized === 'pending' || normalized === 'pending_broadcast') return 'BUY_SUBMITTING';
  if (normalized === 'broadcasted_unseen') return 'BUY_ACCEPTED';
  if (normalized === 'failed' || normalized === 'failed_final') return 'FAILED_TERMINAL';
  return 'VALIDATED';
}

function mapPositionStatusToReason(status: string): string {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'closed') return 'ok_exit_confirmed_closed';
  if (normalized === 'failed' || normalized === 'failed_final') return 'failed_terminal';
  return 'ok_validated';
}

async function migratePositions(): Promise<{
  processed: number;
  created: number;
  updated: number;
  executions: number;
}> {
  let cursor: string | undefined;
  let processed = 0;
  let created = 0;
  let updated = 0;
  let executions = 0;

  while (true) {
    const rows = await prisma.position.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      include: {
        config: {
          select: {
            id: true,
            targetWallet: true,
            executionMode: true,
          },
        },
        pendingAttributed: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (rows.length === 0) break;

    for (const row of rows) {
      processed += 1;

      const chainId = row.chainId;
      const txHash = String(row.leaderTxHash || row.entryTxHash || `legacy-position-${row.id}`).toLowerCase();
      const targetWallet = String(row.config?.targetWallet || row.userId || '').toLowerCase();
      if (!targetWallet) continue;

      const lifecycleState = mapPositionStatusToLifecycle(String(row.status));
      const lastReasonCode = mapPositionStatusToReason(String(row.status));
      const mode = toMode(row.config?.executionMode);

      const existing = await prisma.copytradeOrder.findUnique({
        where: {
          chainId_txHash_targetWallet: {
            chainId,
            txHash,
            targetWallet,
          },
        },
      });

      const metadata = {
        legacyPositionId: row.id,
        legacyEntryTxHash: row.entryTxHash,
        legacyExitTxHash: row.exitTxHash,
        entryAmount: row.entryAmount,
        exitAmount: row.exitAmount,
        pendingAttributedId: row.pendingAttributed?.id || null,
        pendingAttributedStatus: row.pendingAttributed?.status || null,
      } as Record<string, unknown>;

      const upserted = existing
        ? await prisma.copytradeOrder.update({
            where: { id: existing.id },
            data: {
              mode,
              direction: 'buy',
              lifecycleState,
              lastReasonCode,
              retryCount: 0,
              userId: row.userId,
              configId: row.configId,
              detectedAt: row.createdAt,
              lastExecutionAt: row.closedAt || row.updatedAt,
              closedAt: lifecycleState === 'EXIT_CONFIRMED_CLOSED' ? (row.closedAt || row.updatedAt) : null,
              metadataJson: metadata as Prisma.InputJsonValue,
            },
          })
        : await prisma.copytradeOrder.create({
            data: {
              id: crypto.randomUUID(),
              chainId,
              txHash,
              targetWallet,
              tokenIn: 'legacy_unknown',
              tokenOut: row.tokenAddress.toLowerCase(),
              mode,
              direction: 'buy',
              lifecycleState,
              lastReasonCode,
              retryCount: 0,
              userId: row.userId,
              configId: row.configId,
              detectedAt: row.createdAt,
              lastExecutionAt: row.closedAt || row.updatedAt,
              closedAt: lifecycleState === 'EXIT_CONFIRMED_CLOSED' ? (row.closedAt || row.updatedAt) : null,
              metadataJson: metadata as Prisma.InputJsonValue,
            },
          });

      if (existing) {
        updated += 1;
      } else {
        created += 1;
      }

      await prisma.copytradeOrderEvent.create({
        data: {
          id: crypto.randomUUID(),
          orderId: upserted.id,
          eventType: 'MIGRATED_POSITION',
          lifecycleState,
          reasonCode: lastReasonCode,
          payloadJson: {
            legacyPositionId: row.id,
            migratedAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
          createdAt: row.updatedAt,
        },
      }).catch(() => undefined);

      await prisma.copytradeOrderExecution.upsert({
        where: {
          orderId_attemptNo: {
            orderId: upserted.id,
            attemptNo: 1,
          },
        },
        create: {
          id: crypto.randomUUID(),
          orderId: upserted.id,
          attemptNo: 1,
          mode,
          status: 'confirmed',
          txHash: row.entryTxHash,
          reasonCode: 'ok_buy_confirmed_open',
          retryable: false,
          metadataJson: {
            source: 'legacy_position_entry',
          } as Prisma.InputJsonValue,
          createdAt: row.createdAt,
        },
        update: {
          status: 'confirmed',
          txHash: row.entryTxHash,
          reasonCode: 'ok_buy_confirmed_open',
          retryable: false,
          metadataJson: {
            source: 'legacy_position_entry',
          } as Prisma.InputJsonValue,
        },
      });
      executions += 1;

      if (row.exitTxHash) {
        await prisma.copytradeOrderExecution.upsert({
          where: {
            orderId_attemptNo: {
              orderId: upserted.id,
              attemptNo: 2,
            },
          },
          create: {
            id: crypto.randomUUID(),
            orderId: upserted.id,
            attemptNo: 2,
            mode,
            status: lifecycleState === 'EXIT_CONFIRMED_CLOSED' ? 'confirmed' : 'submitted',
            txHash: row.exitTxHash,
            reasonCode: lifecycleState === 'EXIT_CONFIRMED_CLOSED' ? 'ok_exit_confirmed_closed' : 'ok_exit_submitted',
            retryable: false,
            metadataJson: {
              source: 'legacy_position_exit',
            } as Prisma.InputJsonValue,
            createdAt: row.closedAt || row.updatedAt,
          },
          update: {
            status: lifecycleState === 'EXIT_CONFIRMED_CLOSED' ? 'confirmed' : 'submitted',
            txHash: row.exitTxHash,
            reasonCode: lifecycleState === 'EXIT_CONFIRMED_CLOSED' ? 'ok_exit_confirmed_closed' : 'ok_exit_submitted',
            retryable: false,
            metadataJson: {
              source: 'legacy_position_exit',
            } as Prisma.InputJsonValue,
          },
        });
        executions += 1;
      }
    }

    cursor = rows[rows.length - 1]?.id;
  }

  return { processed, created, updated, executions };
}

async function migrateOrphanLedgerRows(): Promise<{ processed: number; created: number }> {
  let processed = 0;
  let created = 0;

  const rows = await prisma.copytradePositionLedger.findMany({
    where: {
      positionIdLegacy: null,
    },
  });

  for (const row of rows) {
    processed += 1;

    const txHash = String(row.leaderBuyTxHash || row.targetSellTxHash || `legacy-ledger-${row.id}`).toLowerCase();
    const targetWallet = String(row.targetWallet || '').toLowerCase();
    if (!targetWallet) continue;

    const existing = await prisma.copytradeOrder.findUnique({
      where: {
        chainId_txHash_targetWallet: {
          chainId: row.chainId,
          txHash,
          targetWallet,
        },
      },
    });
    if (existing) continue;

    await prisma.copytradeOrder.create({
      data: {
        id: crypto.randomUUID(),
        chainId: row.chainId,
        txHash,
        targetWallet,
        tokenIn: 'legacy_unknown',
        tokenOut: row.tokenAddress.toLowerCase(),
        mode: 'normal',
        direction: 'unknown',
        lifecycleState: 'VALIDATED',
        lastReasonCode: 'ok_validated',
        retryCount: 0,
        userId: row.userId,
        configId: row.configId,
        detectedAt: row.createdAt,
        closedAt: row.closedAt,
        metadataJson: {
          legacyLedgerId: row.id,
          source: 'copytrade_position_ledger',
        } as Prisma.InputJsonValue,
      },
    });
    created += 1;
  }

  return { processed, created };
}

async function main(): Promise<void> {
  logger.info(LogCode.SYS_INFO, '[CopyTradeV2Migration] started');

  const [positionRes, orphanRes] = await Promise.all([
    migratePositions(),
    migrateOrphanLedgerRows(),
  ]);

  const orderCount = await prisma.copytradeOrder.count();
  const eventCount = await prisma.copytradeOrderEvent.count();
  const executionCount = await prisma.copytradeOrderExecution.count();

  logger.info(LogCode.SYS_INFO, '[CopyTradeV2Migration] completed', {
    positionRes,
    orphanRes,
    orderCount,
    eventCount,
    executionCount,
  });
}

main()
  .catch((error) => {
    logger.error(LogCode.SYS_ERROR, '[CopyTradeV2Migration] failed', {
      error: error?.message || String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
