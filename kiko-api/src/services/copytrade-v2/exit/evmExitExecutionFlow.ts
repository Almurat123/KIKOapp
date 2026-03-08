import { ethers } from 'ethers';

import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { getErc20Balance } from '../../rpcManager.js';
import { executeSwapViaPort } from '../../swap/swapExecutionPort.js';
import { emitCopytradeDomainAudit } from '../audit/copytradeDomainAudit.js';
import { executeEvmExitPlan } from './executor.js';
import {
  buildMirrorSellIdempotencyKeys,
  claimMirrorSellIdempotency,
  settleMirrorSellIdempotency,
} from './mirrorSellIdempotency.js';
import { handlePendingExitFinality } from './pendingFinality.js';
import type { EvmExitSwapPlan, PositionExitReason } from './types.js';

export async function executePlannedEvmExitFlow(params: {
  exitPlan: EvmExitSwapPlan;
  exitReason: PositionExitReason;
  userId: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  tokenInfo: { price?: number };
  targetWallet?: string | null;
  persistedExitPositions: any[];
  copyTradeDisableMirrorSellDustSweep: boolean;
}): Promise<{
  status: 'pending' | 'confirmed';
  txHash?: string;
  isPartialSell?: boolean;
  runtimeContext?: any;
}> {
  let claimedMirrorSellIdempotency = false;
  let mirrorSellIdempotencyKeys: string[] = [];
  let runtimeContext: any;

  try {
    if (params.exitReason === 'mirror_sell') {
      mirrorSellIdempotencyKeys = buildMirrorSellIdempotencyKeys({
        positionIds: (params.persistedExitPositions || [])
          .map((position: any) => String(position?.id || '').trim())
          .filter(Boolean),
        targetSellTxHash: params.exitPlan.latestTargetSellTxHash,
      });
      if (mirrorSellIdempotencyKeys.length > 0) {
        const claim = await claimMirrorSellIdempotency({ keys: mirrorSellIdempotencyKeys });
        if (!claim.allowed) {
          emitCopytradeDomainAudit('mirror_sell_idempotent_skip', {
            runtimeContext,
            extra: {
              userId: params.userId,
              chainId: params.chainId,
              tokenAddress: params.tokenAddress,
              targetWallet: params.targetWallet || null,
              targetSellTxHash: params.exitPlan.latestTargetSellTxHash || null,
              blockedReason: claim.blockedReason || 'unknown',
              retryAfterMs: claim.retryAfterMs || null,
            },
          });
          return { status: 'pending', runtimeContext };
        }
        claimedMirrorSellIdempotency = true;
      }
    }

    const settledExitResult = await executeEvmExitPlan(params.exitPlan);
    runtimeContext = settledExitResult.runtimeContext;

    if (claimedMirrorSellIdempotency && mirrorSellIdempotencyKeys.length > 0) {
      await settleMirrorSellIdempotency({
        keys: mirrorSellIdempotencyKeys,
        finalityState: settledExitResult.finalityState,
      });
      claimedMirrorSellIdempotency = false;
    }

    if (await handlePendingExitFinality({
      settledExitResult,
      runtimeContext,
      userId: params.userId,
      chainId: params.chainId,
      tokenAddress: params.tokenAddress,
      targetWallet: params.targetWallet,
      exitReason: params.exitReason,
      positions: params.persistedExitPositions,
    })) {
      return { status: 'pending', runtimeContext };
    }

    if (!settledExitResult.success || !settledExitResult.txHash) {
      throw new Error(settledExitResult.error || settledExitResult.finalityReasonCode || 'Unified EVM exit failed');
    }

    emitCopytradeDomainAudit('exit_finality_confirmed', {
      runtimeContext,
      extra: {
        userId: params.userId,
        chainId: params.chainId,
        tokenAddress: params.tokenAddress,
        targetWallet: params.targetWallet || null,
        executionTxHash: settledExitResult.txHash,
        canonicalTxHash: settledExitResult.txHash || settledExitResult.allTxHashes?.[0] || null,
        allTxHashes: settledExitResult.allTxHashes || [],
        adjudicatedState: settledExitResult.finalityState,
        adjudicatedReason: settledExitResult.finalityReasonCode || null,
      },
    });

    const txHash = settledExitResult.txHash;
    const isPartialSell = settledExitResult.isPartialSell;
    const skipDustSweepForMirrorSell = params.exitReason === 'mirror_sell'
      && (params.copyTradeDisableMirrorSellDustSweep || params.exitPlan.hasExternalBalance);

    if (skipDustSweepForMirrorSell) {
      logger.debug(LogCode.SYS_INFO, 'Mirror sell dust sweep skipped to prevent duplicate sell race', {
        userId: params.userId,
        tokenAddress: params.tokenAddress,
        chainId: params.chainId,
        hasExternalBalance: params.exitPlan.hasExternalBalance,
      });
    } else {
      try {
        const remainingBalance = await getErc20Balance(params.tokenAddress, params.walletAddress, params.chainId, 'latest', { lane: 'critical' });
        const dustUsd = Number(ethers.formatUnits(remainingBalance, params.exitPlan.decimals)) * (params.tokenInfo?.price || 0);
        if (remainingBalance > 1000n && (dustUsd >= 0.05 || isPartialSell)) {
          const dustAmountHuman = ethers.formatUnits(remainingBalance, params.exitPlan.decimals);
          await executeSwapViaPort({
            userId: params.userId,
            walletAddress: params.walletAddress,
            tokenIn: params.tokenAddress,
            tokenOut: 'ETH',
            amountIn: dustAmountHuman,
            chainId: params.chainId,
            slippageBps: 2000,
            mode: 'copytrade',
            executionContext: {
              executionStep: 'sell_dust_sweep',
              strictReplica: false,
              sellRoutePolicy: 'external_primary',
            },
            userSettings: {
              fastSwapMode: false,
              copyTradeExecutionMode: params.exitPlan.executionMode,
            },
          });
        }
      } catch (sweepErr: any) {
        logger.debug(LogCode.EXE_TX_REVERTED, 'EVM dust sweep failed', { error: sweepErr.message });
      }
    }

    return {
      status: 'confirmed',
      txHash,
      isPartialSell,
      runtimeContext,
    };
  } catch (error) {
    if (claimedMirrorSellIdempotency && mirrorSellIdempotencyKeys.length > 0) {
      await settleMirrorSellIdempotency({
        keys: mirrorSellIdempotencyKeys,
        finalityState: 'retryable_unresolved',
      });
    }
    throw error;
  }
}
