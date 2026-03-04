import { ethers } from 'ethers';
import { normalizeAddress } from '../../../utils/address.js';
import {
  readEvmTokenBalanceFast,
  readEvmTokenDecimalsFast,
  readSolanaTokenBalanceFast,
} from '../../rpc/balanceRpcReader.js';

export type TargetFullExitReasonCode =
  | 'TARGET_FULL_EXIT_CONFIRMED'
  | 'TARGET_BALANCE_REMAINING'
  | 'TARGET_BALANCE_UNAVAILABLE'
  | 'TARGET_INVALID_WALLET';

export interface TargetFullExitVerificationResult {
  isFullExit: boolean;
  reasonCode: TargetFullExitReasonCode;
  remainingBalanceRaw: string;
  decimals: number;
  dustThresholdRaw: string;
}

function computeDustThresholdRaw(decimals: number): bigint {
  const normalized = Math.max(0, Number.isFinite(decimals) ? Math.floor(decimals) : 0);
  const exponent = normalized > 6 ? normalized - 6 : 0;
  return 10n ** BigInt(exponent);
}

export async function verifyTargetFullExit(params: {
  targetWallet: string;
  chainId: number;
  tokenAddress: string;
}): Promise<TargetFullExitVerificationResult> {
  if (!params.targetWallet) {
    return {
      isFullExit: false,
      reasonCode: 'TARGET_INVALID_WALLET',
      remainingBalanceRaw: '0',
      decimals: 18,
      dustThresholdRaw: '0',
    };
  }

  try {
    if (params.chainId === 900) {
      const { balanceRaw: remaining, decimals } = await readSolanaTokenBalanceFast({
        walletAddress: params.targetWallet,
        tokenAddress: params.tokenAddress,
        path: 'copytrade_target_full_exit_verify',
      });
      const dustThresholdRaw = computeDustThresholdRaw(decimals);
      return {
        isFullExit: remaining <= dustThresholdRaw,
        reasonCode: remaining <= dustThresholdRaw ? 'TARGET_FULL_EXIT_CONFIRMED' : 'TARGET_BALANCE_REMAINING',
        remainingBalanceRaw: remaining.toString(),
        decimals,
        dustThresholdRaw: dustThresholdRaw.toString(),
      };
    }

    const normalizedTargetWallet = normalizeAddress(params.targetWallet);
    const normalizedToken = normalizeAddress(params.tokenAddress);
    const [remaining, decimalsRaw] = await Promise.all([
      readEvmTokenBalanceFast({
        tokenAddress: normalizedToken,
        walletAddress: normalizedTargetWallet,
        chainId: params.chainId,
        path: 'copytrade_target_full_exit_verify',
      }),
      readEvmTokenDecimalsFast({
        tokenAddress: normalizedToken,
        chainId: params.chainId,
        path: 'copytrade_target_decimals_verify',
      }).catch(() => 18),
    ]);
    const decimals = Number(decimalsRaw);
    const dustThresholdRaw = computeDustThresholdRaw(decimals);
    return {
      isFullExit: remaining <= dustThresholdRaw,
      reasonCode: remaining <= dustThresholdRaw ? 'TARGET_FULL_EXIT_CONFIRMED' : 'TARGET_BALANCE_REMAINING',
      remainingBalanceRaw: remaining.toString(),
      decimals,
      dustThresholdRaw: dustThresholdRaw.toString(),
    };
  } catch {
    return {
      isFullExit: false,
      reasonCode: 'TARGET_BALANCE_UNAVAILABLE',
      remainingBalanceRaw: '0',
      decimals: 18,
      dustThresholdRaw: '0',
    };
  }
}

export function formatTargetRemainingBalance(result: TargetFullExitVerificationResult): string {
  try {
    return ethers.formatUnits(BigInt(result.remainingBalanceRaw || '0'), result.decimals);
  } catch {
    return result.remainingBalanceRaw;
  }
}
