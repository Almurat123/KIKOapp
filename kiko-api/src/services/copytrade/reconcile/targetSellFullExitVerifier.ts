import { PublicKey } from '@solana/web3.js';
import { ethers } from 'ethers';
import { getSolanaConnection } from '../../../config/solanaConfig.js';
import { normalizeAddress } from '../../../utils/address.js';
import { getErc20Balance, getErc20Decimals } from '../../rpcManager.js';

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
      const connection = getSolanaConnection('fast', 'critical');
      const accounts = await connection.getParsedTokenAccountsByOwner(
        new PublicKey(params.targetWallet),
        { mint: new PublicKey(params.tokenAddress) }
      );
      let remaining = 0n;
      let decimals = 6;
      for (const account of accounts.value) {
        const tokenAmount = account.account.data.parsed.info.tokenAmount;
        remaining += BigInt(String(tokenAmount.amount || '0'));
        decimals = Number(tokenAmount.decimals ?? decimals);
      }
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
      getErc20Balance(normalizedToken, normalizedTargetWallet, params.chainId),
      getErc20Decimals(normalizedToken, params.chainId).catch(() => 18),
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
