import { ethers } from 'ethers';

import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';

export type TransferLog = { address: string; topics: string[]; data: string };

export interface TransferDecodedSwap {
  txHash?: string;
  sourceTxInput?: string;
  sourceTxValue?: string;
  sourceSelector?: string;
  poolAmountIn?: string;
  poolTokenIn?: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  router: string;
  dexName: string;
  routeHopCount?: number;
  routeHops?: Array<{
    kind: 'v4' | 'v3' | 'v2' | 'aerodrome' | 'infinity';
    dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
    poolAddress?: string;
    tokenIn?: string;
    tokenOut?: string;
    fee?: number;
  }>;
  canUseResolvedPoolFastPath?: boolean;
  resolvedPoolHint?: {
    kind: 'v4' | 'v3' | 'v2' | 'aerodrome';
    dex?: 'uniswap' | 'pancake' | 'aerodrome' | 'pancake-infinity';
    poolAddress?: string;
    fee?: number;
    v4PoolKey?: {
      currency0: string;
      currency1: string;
      hooks: string;
      poolManager: string;
      fee: number;
      tickSpacing: number;
    };
  };
  cashLegHint?: {
    cashSpentUsd?: number;
    cashReceivedUsd?: number;
    inferredTxType?: 'TARGET_BUY' | 'TARGET_SELL' | 'TARGET_TOKEN_SWAP';
  };
}

const TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const IGNORED_ADDRESSES = new Set([
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  '0x0000000000000000000000000000000000000000',
]);

type Transfer = {
  token: string;
  from: string;
  to: string;
  amount: bigint;
};

function extractTransfersFromLogs(logs: TransferLog[]): Transfer[] {
  const transfers: Transfer[] = [];

  for (const log of logs) {
    if (log.topics[0]?.toLowerCase() !== TRANSFER_EVENT) continue;
    if (log.topics.length < 3) continue;

    try {
      const from = '0x' + log.topics[1].slice(26).toLowerCase();
      const to = '0x' + log.topics[2].slice(26).toLowerCase();
      const amount = BigInt(log.data);

      transfers.push({
        token: log.address.toLowerCase(),
        from,
        to,
        amount,
      });
    } catch (error: any) {
      logger.debug(LogCode.DEC_SWAP_DETECTION, 'Failed to parse transfer log', {
        error: error.message,
      });
    }
  }

  return transfers;
}

function buildTransferTotals(
  transfers: Transfer[],
  walletAddress: string,
): {
  tokenReceived?: [string, bigint];
  tokenSent?: [string, bigint];
} {
  const incomingTotals = new Map<string, bigint>();
  const outgoingTotals = new Map<string, bigint>();

  for (const transfer of transfers) {
    if (IGNORED_ADDRESSES.has(transfer.token) || transfer.amount <= 0n) continue;
    if (transfer.to === walletAddress) {
      incomingTotals.set(transfer.token, (incomingTotals.get(transfer.token) || 0n) + transfer.amount);
    }
    if (transfer.from === walletAddress) {
      outgoingTotals.set(transfer.token, (outgoingTotals.get(transfer.token) || 0n) + transfer.amount);
    }
  }

  const tokenReceived = [...incomingTotals.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0];
  const tokenSent = [...outgoingTotals.entries()].sort((a, b) => (b[1] > a[1] ? 1 : -1))[0];

  return { tokenReceived, tokenSent };
}

export function hasLikelyTransferSwapEvidence(
  logs: TransferLog[],
  walletAddress: string,
  nativeValue: string = '0',
): boolean {
  const transfers = extractTransfersFromLogs(logs);
  if (transfers.length < 1) return false;

  const normalizedWallet = walletAddress.toLowerCase();
  const { tokenReceived, tokenSent } = buildTransferTotals(transfers, normalizedWallet);
  const hasNativeInput = BigInt(nativeValue || '0') > 0n;

  if (tokenReceived && tokenSent && tokenReceived[0] !== tokenSent[0]) return true;
  if (tokenReceived && hasNativeInput) return true;
  if (tokenSent) return true;
  return false;
}

export function decodeSwapFromLogs(
  logs: TransferLog[],
  walletAddress: string,
  nativeValue: string = '0',
): TransferDecodedSwap | null {
  logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoding swap from transaction logs', {
    logCount: logs.length,
    from: walletAddress,
    nativeValue,
  });

  const transfers = extractTransfersFromLogs(logs);

  logger.debug(LogCode.DEC_SWAP_DETECTION, `Found ${transfers.length} Transfer events in logs`);
  for (const transfer of transfers) {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Log transfer detail', {
      token: transfer.token,
      from: transfer.from,
      to: transfer.to,
      amount: transfer.amount.toString(),
    });
  }

  if (transfers.length < 1) {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'No transfer events found in logs');
    return null;
  }

  const normalizedWallet = walletAddress.toLowerCase();
  const { tokenReceived, tokenSent } = buildTransferTotals(transfers, normalizedWallet);
  let tokenSentAddress = tokenSent?.[0];
  let amountSent = tokenSent?.[1]?.toString();

  logger.debug(LogCode.DEC_SWAP_DETECTION, 'Transaction logic analysis', {
    received: tokenReceived?.[0],
    sent: tokenSentAddress,
  });

  if (!tokenSent && BigInt(nativeValue) > 0n) {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'No outgoing token transfer found but native value present; assuming native asset input');
    tokenSentAddress = NATIVE_PLACEHOLDER;
    amountSent = nativeValue;
  }

  if (tokenSentAddress && !tokenReceived) {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Found source token but no incoming transfer; assuming native asset output');
    return {
      tokenIn: tokenSentAddress,
      tokenOut: NATIVE_PLACEHOLDER,
      amountIn: amountSent || '0',
      amountOut: '0',
      router: '',
      dexName: '',
    };
  }

  if (!tokenReceived || !tokenSentAddress || !amountSent) {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoding failed: missing required swap fields', {
      hasReceived: !!tokenReceived,
      hasSent: !!tokenSentAddress,
      hasAmount: !!amountSent,
    });
    return null;
  }

  if (tokenReceived[0].toLowerCase() === tokenSentAddress.toLowerCase()) {
    logger.debug(LogCode.DEC_SWAP_DETECTION, 'Decoded same token in/out; falling back to other decoders', {
      token: tokenSentAddress,
    });
    return null;
  }

  logger.info(LogCode.DEC_SUCCESS, 'Swap successfully decoded from logs', {
    tokenIn: tokenSentAddress,
    tokenOut: tokenReceived[0],
  });
  logger.debug(LogCode.DEC_SUCCESS, 'Decoded swap values', {
    amountIn: amountSent,
    amountOut: tokenReceived[1].toString(),
  });

  return {
    tokenIn: tokenSentAddress,
    tokenOut: tokenReceived[0],
    amountIn: amountSent,
    amountOut: tokenReceived[1].toString(),
    router: '',
    dexName: '',
  };
}
