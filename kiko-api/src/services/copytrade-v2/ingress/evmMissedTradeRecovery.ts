import prisma from '../../../db/prisma.js';
import { fetchTransaction, fetchTransactionReceipt, isTxProcessedDistributed, markTxAsProcessedDistributed } from '../../watcherService.js';
import { parseSwapTransaction } from '../../txDecoder.js';
import { normalizeAddress } from '../../../utils/address.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { buildCopyTradeFirstSeenTiming, markCopyTradeSwapReady, markCopyTradeTaskEnqueued } from '../timing/copyTradeTimingModel.js';
import { markCopyTradeIngressConfirmed, markCopyTradeIngressFirstSeen, markCopyTradeIngressSwapReady } from './copyTradeIngressState.js';
import { dispatchCopyTradeIfReady } from './copyTradeFastDispatcher.js';
import { persistSwapExecutionContext } from '../context/swapContextPersistence.js';
import { ensureCopytradeIngressTraceTable, hasCopytradeIngressTraceEvent, recordCopytradeIngressTrace } from './ingressTraceStore.js';
import { runBackgroundCycleWhenIdle } from '../exit/exitHotPathPressure.js';
import { findRecentTargetSellEvents } from '../exit/targetSellEventStore.js';

const EVM_RECOVERY_CHAIN_IDS = [1, 8453, 56, 42161, 10, 137];
const STARTUP_RECOVERY_DELAY_MS = Math.max(5_000, Number(process.env.COPYTRADE_STARTUP_RECOVERY_DELAY_MS || 20_000));
const STARTUP_RECOVERY_INTERVAL_MS = Math.max(30_000, Number(process.env.COPYTRADE_STARTUP_RECOVERY_INTERVAL_MS || 60_000));
const STARTUP_RECOVERY_CYCLES = Math.max(1, Number(process.env.COPYTRADE_STARTUP_RECOVERY_CYCLES || 5));
const STARTUP_RECOVERY_LOOKBACK_MS = Math.max(60_000, Number(process.env.COPYTRADE_STARTUP_RECOVERY_LOOKBACK_MS || 10 * 60_000));
const STARTUP_RECOVERY_EVENT_LIMIT = Math.max(10, Number(process.env.COPYTRADE_STARTUP_RECOVERY_EVENT_LIMIT || 30));
const EVM_STARTUP_RECOVERY_ENABLED = (process.env.COPYTRADE_ENABLE_EVM_STARTUP_RECOVERY || 'false').toLowerCase() === 'true';
const STARTUP_RECOVERY_DISPATCH_SOURCE = 'target_history_sell_recovery';
const STARTUP_SELL_RECOVERY_TRACE_PREFIX = 'startup_sell_recovery';

let started = false;

type RecoverableTargetSellEvent = {
  id: string;
  txHash: string;
  walletAddress: string;
  chainId: number;
  blockTimestamp: Date;
};

export function isEvmMissedTradeRecoveryEnabled(): boolean {
  return EVM_STARTUP_RECOVERY_ENABLED;
}

export function startEvmMissedTradeRecovery(): boolean {
  if (started) return true;
  if (!EVM_STARTUP_RECOVERY_ENABLED) {
    logger.info(LogCode.SYS_INFO, '[CopyTradeRecovery] EVM startup recovery disabled', {
      mode: 'event_driven_only',
    });
    return false;
  }
  started = true;

  let remainingRuns = STARTUP_RECOVERY_CYCLES;
  const schedule = () => {
    if (remainingRuns <= 0) return;
    const runNumber = STARTUP_RECOVERY_CYCLES - remainingRuns + 1;
    void runEvmMissedTradeRecoveryCycle(runNumber).then((executed) => {
      if (executed) {
        remainingRuns -= 1;
      }
    }).catch((error: any) => {
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
  return true;
}

export function selectRecoverableRecentTargetSellEvents(
  rows: RecoverableTargetSellEvent[],
  nowMs: number,
  lookbackMs: number,
): RecoverableTargetSellEvent[] {
  const minTimestamp = nowMs - lookbackMs;
  const seen = new Set<string>();
  return rows
    .filter((row) => row.blockTimestamp.getTime() >= minTimestamp)
    .filter((row) => {
      const key = `${row.chainId}:${row.walletAddress.toLowerCase()}:${row.txHash.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.blockTimestamp.getTime() - a.blockTimestamp.getTime());
}

async function runEvmMissedTradeRecoveryCycle(runNumber: number): Promise<boolean> {
  const gated = await runBackgroundCycleWhenIdle({
    cycle: 'startup_recovery',
    fn: async () => true,
  }).catch(() => ({ skipped: false, result: true }));
  if (gated.skipped) {
    return false;
  }

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
  let scannedEvents = 0;
  let recoveredTxs = 0;
  const nowMs = Date.now();
  const targetWallets = wallets
    .map((wallet) => normalizeAddress(wallet.targetWallet))
    .filter(Boolean);
  const recentEvents = targetWallets.length > 0
    ? await findRecentTargetSellEvents({
      chainIds: EVM_RECOVERY_CHAIN_IDS,
      targetWallets,
      detectedAfter: new Date(nowMs - STARTUP_RECOVERY_LOOKBACK_MS),
      take: STARTUP_RECOVERY_EVENT_LIMIT,
    }).catch(() => [])
    : [];
  const recoverable = selectRecoverableRecentTargetSellEvents(
    recentEvents.map((event) => ({
      id: event.id,
      txHash: event.targetSellTxHash,
      walletAddress: event.targetWallet,
      chainId: event.chainId,
      blockTimestamp: event.detectedAt,
    })),
    nowMs,
    STARTUP_RECOVERY_LOOKBACK_MS,
  );
  scannedWallets = targetWallets.length;
  scannedEvents = recoverable.length;

  for (const row of recoverable) {
    const pressure = await runBackgroundCycleWhenIdle({
      cycle: 'startup_recovery_mid_cycle_guard',
      fn: async () => false,
    }).catch(() => ({ skipped: false, result: false }));
    if (pressure.skipped) {
      logger.info(LogCode.SYS_INFO, '[CopyTradeRecovery] startup recovery paused by live exit pressure', {
        runNumber,
        scannedWallets,
        scannedEvents,
        recoveredTxs,
      });
      break;
    }
    const recovered = await recoverMissedTargetSellFromEvent({
      eventId: row.id,
      chainId: row.chainId,
      txHash: row.txHash,
      targetWallet: row.walletAddress,
      blockTimestamp: row.blockTimestamp,
    }).catch(() => false);
    if (recovered) recoveredTxs += 1;
  }

  const logLevel = scannedEvents > 0 || recoveredTxs > 0 ? 'info' : 'debug';
  logger[logLevel](LogCode.SYS_INFO, '[CopyTradeRecovery] startup recovery cycle finished', {
    runNumber,
    scannedWallets,
    scannedEvents,
    recoveredTxs,
    lookbackMs: STARTUP_RECOVERY_LOOKBACK_MS,
  });
  return true;
}

async function recoverMissedTargetSellFromEvent(params: {
  eventId: string;
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
    eventTypes: ['dispatch_enqueued', 'startup_recovery_dispatch_enqueued', `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_dispatch_enqueued`],
  }).catch(() => false);
  if (alreadyDispatched) return false;

    await recordCopytradeIngressTrace({
      chainId: params.chainId,
      txHash,
      targetWallet,
      eventType: `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_attempt`,
      source: 'startup_recovery',
      payload: { blockTimestamp: params.blockTimestamp.toISOString(), eventId: params.eventId },
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
      eventType: `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_missing_tx_or_receipt`,
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
      eventType: `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_non_success_receipt`,
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
      eventType: `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_no_swap`,
      source: 'startup_recovery',
    }).catch(() => undefined);
    return false;
  }

  const nowMs = Date.now();
  const timing = markCopyTradeTaskEnqueued(
    markCopyTradeSwapReady(
      buildCopyTradeFirstSeenTiming(nowMs, STARTUP_RECOVERY_DISPATCH_SOURCE),
      nowMs,
      STARTUP_RECOVERY_DISPATCH_SOURCE,
    ),
    nowMs,
  );

  await Promise.allSettled([
    markCopyTradeIngressFirstSeen(params.chainId, txHash, nowMs, STARTUP_RECOVERY_DISPATCH_SOURCE),
    markCopyTradeIngressConfirmed(params.chainId, txHash, nowMs, STARTUP_RECOVERY_DISPATCH_SOURCE),
    markCopyTradeIngressSwapReady(params.chainId, txHash, nowMs, STARTUP_RECOVERY_DISPATCH_SOURCE),
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
    eventType: `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_swap_decoded`,
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
    sourceBlockTimestampMs: params.blockTimestamp.getTime(),
    detectedAt: nowMs,
    timing,
    source: STARTUP_RECOVERY_DISPATCH_SOURCE,
  });

  await recordCopytradeIngressTrace({
    chainId: params.chainId,
    txHash,
    targetWallet,
    eventType: accepted
      ? `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_dispatch_enqueued`
      : `${STARTUP_SELL_RECOVERY_TRACE_PREFIX}_dispatch_suppressed`,
    source: 'startup_recovery',
  }).catch(() => undefined);

  await markTxAsProcessedDistributed(txHash, params.chainId).catch(() => undefined);
  return true;
}
