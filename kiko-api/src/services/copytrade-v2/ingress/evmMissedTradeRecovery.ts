import prisma from '../../../db/prisma.js';
import { fetchTransaction, fetchTransactionReceipt, isTxProcessedDistributed, markTxAsProcessedDistributed } from '../../watcherService.js';
import { parseSwapTransaction } from '../../txDecoder.js';
import { normalizeAddress } from '../../../utils/address.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { bootstrapTrackedWalletHistory } from '../../targetWalletTrackingService.js';
import { buildCopyTradeFirstSeenTiming, markCopyTradeSwapReady, markCopyTradeTaskEnqueued } from '../timing/copyTradeTimingModel.js';
import { markCopyTradeIngressConfirmed, markCopyTradeIngressFirstSeen, markCopyTradeIngressSwapReady } from './copyTradeIngressState.js';
import { dispatchCopyTradeIfReady } from './copyTradeFastDispatcher.js';
import { persistSwapExecutionContext } from '../context/swapContextPersistence.js';
import { ensureCopytradeIngressTraceTable, hasCopytradeIngressTraceEvent, recordCopytradeIngressTrace } from './ingressTraceStore.js';

const EVM_RECOVERY_CHAIN_IDS = [1, 8453, 56, 42161, 10, 137];
const STARTUP_RECOVERY_DELAY_MS = Math.max(5_000, Number(process.env.COPYTRADE_STARTUP_RECOVERY_DELAY_MS || 20_000));
const STARTUP_RECOVERY_INTERVAL_MS = Math.max(30_000, Number(process.env.COPYTRADE_STARTUP_RECOVERY_INTERVAL_MS || 60_000));
const STARTUP_RECOVERY_CYCLES = Math.max(1, Number(process.env.COPYTRADE_STARTUP_RECOVERY_CYCLES || 5));
const STARTUP_RECOVERY_LOOKBACK_MS = Math.max(60_000, Number(process.env.COPYTRADE_STARTUP_RECOVERY_LOOKBACK_MS || 10 * 60_000));
const STARTUP_RECOVERY_HISTORY_LIMIT = Math.max(10, Number(process.env.COPYTRADE_STARTUP_RECOVERY_HISTORY_LIMIT || 30));

let started = false;

type RecoverableWalletTx = {
  txHash: string;
  walletAddress: string;
  chainId: number;
  blockTimestamp: Date;
  txType: string;
};

export function startEvmMissedTradeRecovery(): void {
  if (started) return;
  started = true;

  let remainingRuns = STARTUP_RECOVERY_CYCLES;
  const schedule = () => {
    if (remainingRuns <= 0) return;
    const runNumber = STARTUP_RECOVERY_CYCLES - remainingRuns + 1;
    remainingRuns -= 1;
    void runEvmMissedTradeRecoveryCycle(runNumber).catch((error: any) => {
      logger.error(LogCode.SYS_ERROR, '[CopyTradeRecovery] startup recovery cycle failed', {
        error: error?.message || String(error),
        runNumber,
      });
    });
    if (remainingRuns > 0) {
      setTimeout(schedule, STARTUP_RECOVERY_INTERVAL_MS).unref();
    }
  };

  setTimeout(schedule, STARTUP_RECOVERY_DELAY_MS).unref();
}

export function selectRecoverableRecentTargetTxs(
  rows: RecoverableWalletTx[],
  nowMs: number,
  lookbackMs: number,
): RecoverableWalletTx[] {
  const minTimestamp = nowMs - lookbackMs;
  const seen = new Set<string>();
  return rows
    .filter((row) => row.blockTimestamp.getTime() >= minTimestamp)
    .filter((row) => row.txType === 'TARGET_BUY' || row.txType === 'TARGET_SELL' || row.txType === 'TARGET_TOKEN_SWAP')
    .filter((row) => {
      const key = `${row.chainId}:${row.walletAddress.toLowerCase()}:${row.txHash.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

async function runEvmMissedTradeRecoveryCycle(runNumber: number): Promise<void> {
  await ensureCopytradeIngressTraceTable();
  const wallets = await prisma.copyTradeConfig.findMany({
    where: {
      status: 'active',
      chainId: { in: EVM_RECOVERY_CHAIN_IDS },
    },
    select: {
      targetWallet: true,
      chainId: true,
    },
    distinct: ['targetWallet', 'chainId'],
  });

  let scannedWallets = 0;
  let recoveredTxs = 0;
  const nowMs = Date.now();

  for (const wallet of wallets) {
    const targetWallet = normalizeAddress(wallet.targetWallet);
    if (!targetWallet) continue;
    scannedWallets += 1;

    await recordCopytradeIngressTrace({
      chainId: wallet.chainId,
      txHash: `startup-cycle-${runNumber}`,
      targetWallet,
      eventType: 'startup_recovery_wallet_scan',
      source: 'startup_recovery',
      payload: { runNumber },
    }).catch(() => undefined);

    await bootstrapTrackedWalletHistory(
      targetWallet,
      wallet.chainId,
      STARTUP_RECOVERY_HISTORY_LIMIT,
      { force: true, source: 'startup_recovery' },
    ).catch(() => undefined);

    const recentRows = await prisma.walletTransaction.findMany({
      where: {
        walletAddress: targetWallet,
        chainId: wallet.chainId,
        blockTimestamp: { gte: new Date(nowMs - STARTUP_RECOVERY_LOOKBACK_MS) },
        txType: { in: ['TARGET_BUY', 'TARGET_SELL', 'TARGET_TOKEN_SWAP'] },
      },
      select: {
        txHash: true,
        walletAddress: true,
        chainId: true,
        blockTimestamp: true,
        txType: true,
      },
      orderBy: { blockTimestamp: 'desc' },
      take: STARTUP_RECOVERY_HISTORY_LIMIT,
    });

    const recoverable = selectRecoverableRecentTargetTxs(
      recentRows as RecoverableWalletTx[],
      nowMs,
      STARTUP_RECOVERY_LOOKBACK_MS,
    );

    for (const row of recoverable) {
      const recovered = await recoverTargetTxFromHistory({
        chainId: row.chainId,
        txHash: row.txHash,
        targetWallet,
        blockTimestamp: row.blockTimestamp,
      }).catch(() => false);
      if (recovered) recoveredTxs += 1;
    }
  }

  logger.info(LogCode.SYS_INFO, '[CopyTradeRecovery] startup recovery cycle finished', {
    runNumber,
    scannedWallets,
    recoveredTxs,
    lookbackMs: STARTUP_RECOVERY_LOOKBACK_MS,
  });
}

async function recoverTargetTxFromHistory(params: {
  chainId: number;
  txHash: string;
  targetWallet: string;
  blockTimestamp: Date;
}): Promise<boolean> {
  const txHash = params.txHash.toLowerCase();
  const targetWallet = normalizeAddress(params.targetWallet);
  if (!targetWallet) return false;

  if (await isTxProcessedDistributed(txHash, params.chainId).catch(() => false)) {
    await recordCopytradeIngressTrace({
      chainId: params.chainId,
      txHash,
      targetWallet,
      eventType: 'startup_recovery_skip_processed',
      source: 'startup_recovery',
    }).catch(() => undefined);
    return false;
  }

  const alreadyDispatched = await hasCopytradeIngressTraceEvent({
    chainId: params.chainId,
    txHash,
    targetWallet,
    eventTypes: ['dispatch_enqueued', 'startup_recovery_dispatch_enqueued'],
  }).catch(() => false);
  if (alreadyDispatched) return false;

  await recordCopytradeIngressTrace({
    chainId: params.chainId,
    txHash,
    targetWallet,
    eventType: 'startup_recovery_attempt',
    source: 'startup_recovery',
    payload: { blockTimestamp: params.blockTimestamp.toISOString() },
  }).catch(() => undefined);

  const [tx, receipt] = await Promise.all([
    fetchTransaction(txHash, params.chainId).catch(() => null),
    fetchTransactionReceipt(txHash, params.chainId).catch(() => null),
  ]);
  if (!tx || !receipt) {
    await recordCopytradeIngressTrace({
      chainId: params.chainId,
      txHash,
      targetWallet,
      eventType: 'startup_recovery_missing_tx_or_receipt',
      source: 'startup_recovery',
      payload: { hasTx: Boolean(tx), hasReceipt: Boolean(receipt) },
    }).catch(() => undefined);
    return false;
  }

  const status = Number.parseInt(String(receipt.status || '0x0'), 16);
  if (status !== 1) {
    await recordCopytradeIngressTrace({
      chainId: params.chainId,
      txHash,
      targetWallet,
      eventType: 'startup_recovery_non_success_receipt',
      source: 'startup_recovery',
      payload: { status },
    }).catch(() => undefined);
    return false;
  }

  const swap = await parseSwapTransaction(
    {
      hash: txHash,
      from: tx.from,
      to: tx.to,
      input: tx.input,
      value: tx.value,
    },
    {
      logs: receipt.logs || [],
      status,
    },
    params.chainId,
    targetWallet,
  ).catch(() => null);

  if (!swap) {
    await recordCopytradeIngressTrace({
      chainId: params.chainId,
      txHash,
      targetWallet,
      eventType: 'startup_recovery_no_swap',
      source: 'startup_recovery',
    }).catch(() => undefined);
    return false;
  }

  const nowMs = Date.now();
  const timing = markCopyTradeTaskEnqueued(
    markCopyTradeSwapReady(
      buildCopyTradeFirstSeenTiming(nowMs, 'target_history_recovery'),
      nowMs,
      'target_history_recovery',
    ),
    nowMs,
  );

  await Promise.allSettled([
    markCopyTradeIngressFirstSeen(params.chainId, txHash, nowMs, 'target_history_recovery'),
    markCopyTradeIngressConfirmed(params.chainId, txHash, nowMs, 'target_history_recovery'),
    markCopyTradeIngressSwapReady(params.chainId, txHash, nowMs, 'target_history_recovery'),
    persistSwapExecutionContext({
      chainId: params.chainId,
      txHash,
      txFrom: tx.from,
      txTo: tx.to,
      txInput: tx.input,
      txValue: tx.value,
      receiptLogs: receipt.logs || [],
      swap,
      targetWallet,
      detectedAt: nowMs,
    }),
  ]);

  await recordCopytradeIngressTrace({
    chainId: params.chainId,
    txHash,
    targetWallet,
    eventType: 'startup_recovery_swap_decoded',
    source: 'startup_recovery',
    payload: {
      tokenIn: swap.tokenIn,
      tokenOut: swap.tokenOut,
      dex: swap.dexName || null,
      sourceTxFrom: normalizeAddress(String(tx.from || '')) || null,
    },
  }).catch(() => undefined);

  const accepted = await dispatchCopyTradeIfReady({
    chainId: params.chainId,
    txHash,
    targetWallet,
    swap,
    sourceTxFrom: normalizeAddress(String(tx.from || '')) || undefined,
    detectedAt: nowMs,
    timing,
    source: 'target_history_recovery',
  });

  await recordCopytradeIngressTrace({
    chainId: params.chainId,
    txHash,
    targetWallet,
    eventType: accepted ? 'startup_recovery_dispatch_enqueued' : 'startup_recovery_dispatch_suppressed',
    source: 'startup_recovery',
  }).catch(() => undefined);

  await markTxAsProcessedDistributed(txHash, params.chainId).catch(() => undefined);
  return true;
}
