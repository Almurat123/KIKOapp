import { ethers } from 'ethers';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { NATIVE_TOKEN_ADDRESS, isNativeToken } from '../config/tokenRegistry.js';
import {
  callRpc,
  getErc20Allowance,
  getErc20Decimals,
  getTransactionReceipt
} from './rpcManager.js';
import { isTransactionQueueBusy, sendTransaction } from './privyWallet.js';
import { recordFollowerTransactionFactForLatestPosition } from './copytrade-v2/data-flow/followerTransactionFactLedger.js';
import { getZeroExQuote } from './zeroEx.js';
import { clearApprovalPreheatState, upsertApprovalPreheatState } from './swap/approvalPreheatState.js';
import { TX_NONCE_PROFILE } from './rpc/profile.js';

const PREHEAT_ENABLED = (process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_ENABLED || 'false') === 'true';
const PREHEAT_MIN_USD = Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_MIN_USD || '0.5');
const PREHEAT_MAX_SPENDERS = Math.max(1, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_MAX_SPENDERS || '2'));
const PREHEAT_TIMEOUT_MS = Math.max(8_000, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_TIMEOUT_MS || '60_000'));
const PREHEAT_SLIPPAGE_BPS = Math.max(500, Number(process.env.COPYTRADE_SELL_APPROVAL_PREHEAT_SLIPPAGE_BPS || '2500'));
const PREHEAT_SPENDER_CACHE_TTL_MS = Math.max(10_000, Number(process.env.COPYTRADE_SELL_APPROVAL_SPENDER_CACHE_TTL_MS || '180000'));
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_UINT256 = (2n ** 256n) - 1n;
const ERC20_APPROVE_IFACE = new ethers.Interface(['function approve(address spender, uint256 amount)']);
const spenderCache = new Map<string, { spenders: string[]; timestamp: number }>();
const spenderRefreshInflight = new Map<string, Promise<string[]>>();

export interface SellApprovalPreheatParams {
  userId: string;
  accessToken?: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  tokenPriceUsd?: number;
  tokenDecimals?: number;
}

export interface SellApprovalPreheatOptions {
  queueBehavior?: 'skip_if_busy' | 'allow_queue';
  txPurpose?: 'approval' | 'preheat';
}

export interface SellApprovalPreheatResult {
  status: 'completed' | 'deferred' | 'noop';
  reasonCode: string;
}

async function waitForReceipt(chainId: number, txHash: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = await getTransactionReceipt(chainId, txHash).catch(() => null);
    if (receipt) {
      const status = Number.parseInt(String(receipt.status || '0x0'), 16);
      return status === 1;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

async function hasPendingOutgoingTx(chainId: number, walletAddress: string): Promise<boolean> {
  try {
    const [latestHex, pendingHex] = await Promise.all([
      callRpc<string>(chainId, 'eth_getTransactionCount', [walletAddress, 'latest'], {
        strategy: TX_NONCE_PROFILE.strategy,
        purpose: TX_NONCE_PROFILE.purpose,
        importance: TX_NONCE_PROFILE.importance,
      }),
      callRpc<string>(chainId, 'eth_getTransactionCount', [walletAddress, 'pending'], {
        strategy: TX_NONCE_PROFILE.strategy,
        purpose: TX_NONCE_PROFILE.purpose,
        importance: TX_NONCE_PROFILE.importance,
      })
    ]);
    const latest = latestHex ? BigInt(latestHex) : 0n;
    const pending = pendingHex ? BigInt(pendingHex) : latest;
    return pending > latest;
  } catch {
    // If nonce state cannot be verified, skip preheat to avoid competing with critical swaps.
    return true;
  }
}

function toAddress(value: string): string | null {
  if (!value) return null;
  try {
    return ethers.getAddress(value);
  } catch {
    return null;
  }
}

function buildProbeAmountBase(
  decimals: number,
  tokenPriceUsd: number | undefined,
  balance?: bigint
): bigint {
  const minByPrecision = decimals >= 6 ? 10n ** BigInt(decimals - 6) : 1n;
  let minByPrice = 0n;
  if (Number.isFinite(tokenPriceUsd) && (tokenPriceUsd || 0) > 0) {
    const probeTokens = PREHEAT_MIN_USD / Number(tokenPriceUsd);
    if (Number.isFinite(probeTokens) && probeTokens > 0) {
      const probe = ethers.parseUnits(probeTokens.toFixed(Math.min(8, decimals)), decimals);
      if (probe > 0n) minByPrice = probe;
    }
  }

  const probe = [1n, minByPrecision, minByPrice].reduce((acc, cur) => (cur > acc ? cur : acc), 1n);
  if (typeof balance === 'bigint' && balance > 0n && probe > balance) return balance;
  return probe;
}

function extractSpenders(rawSpenders: Array<string | null | undefined>): string[] {
  const raw = rawSpenders.filter(Boolean);

  const seen = new Set<string>();
  const output: string[] = [];
  for (const item of raw) {
    const addr = toAddress(String(item));
    if (!addr || addr.toLowerCase() === ZERO_ADDRESS) continue;
    const key = addr.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(addr);
    if (output.length >= PREHEAT_MAX_SPENDERS) break;
  }
  return output;
}

function buildSpenderCacheKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

function getCachedSpenders(chainId: number, tokenAddress: string): string[] {
  const key = buildSpenderCacheKey(chainId, tokenAddress);
  const hit = spenderCache.get(key);
  if (!hit) return [];
  if (Date.now() - hit.timestamp > PREHEAT_SPENDER_CACHE_TTL_MS) {
    spenderCache.delete(key);
    return [];
  }
  return hit.spenders;
}

function setCachedSpenders(chainId: number, tokenAddress: string, spenders: string[]): void {
  const key = buildSpenderCacheKey(chainId, tokenAddress);
  if (!spenders.length) return;
  spenderCache.set(key, { spenders, timestamp: Date.now() });
}

async function refreshSpendersFromQuotes(params: {
  chainId: number;
  tokenAddress: string;
  walletAddress: string;
  probeAmountBase: bigint;
  decimals: number;
}): Promise<string[]> {
  const key = buildSpenderCacheKey(params.chainId, params.tokenAddress);
  const inflight = spenderRefreshInflight.get(key);
  if (inflight) return await inflight;

  const task = (async (): Promise<string[]> => {
    const amountInBase = params.probeAmountBase.toString();
    const zeroExQuote = await getZeroExQuote(
      params.tokenAddress,
      NATIVE_TOKEN_ADDRESS,
      amountInBase,
      params.chainId,
      PREHEAT_SLIPPAGE_BPS,
      params.walletAddress,
      undefined,
      false,
      true
    ).catch(() => null);

    const spenders = extractSpenders([
      zeroExQuote?.allowanceTarget || zeroExQuote?.issues?.allowance?.spender,
    ]);
    setCachedSpenders(params.chainId, params.tokenAddress, spenders);
    return spenders;
  })().finally(() => {
    spenderRefreshInflight.delete(key);
  });

  spenderRefreshInflight.set(key, task);
  return await task;
}

async function approveWithFallback(params: {
  userId: string;
  accessToken?: string;
  walletAddress: string;
  chainId: number;
  tokenAddress: string;
  spender: string;
  queueBehavior: 'skip_if_busy' | 'allow_queue';
  txPurpose: 'approval' | 'preheat';
}): Promise<{ success: boolean; txHashes: string[]; error?: string }> {
  const { userId, accessToken, chainId, tokenAddress, spender } = params;
  const txHashes: string[] = [];
  const sendApprove = async (amount: bigint): Promise<boolean> => {
    if (params.queueBehavior === 'skip_if_busy' && isTransactionQueueBusy(userId, chainId)) {
      throw new Error('wallet_tx_queue_busy_skip_preheat');
    }
    const data = ERC20_APPROVE_IFACE.encodeFunctionData('approve', [spender, amount]);
    const txHash = await sendTransaction(userId, accessToken || '', {
      to: tokenAddress,
      data,
      value: '0',
      chainId,
      txPurpose: params.txPurpose
    });
    txHashes.push(txHash);
    if (amount === MAX_UINT256) {
      await upsertApprovalPreheatState({
        userId,
        chainId,
        walletAddress: params.walletAddress,
        tokenAddress,
        spenderAddress: spender,
        txHash,
        status: 'submitted',
      }).catch(() => undefined);
    }
    return await waitForReceipt(chainId, txHash, PREHEAT_TIMEOUT_MS);
  };

  try {
    const ok = await sendApprove(MAX_UINT256);
    if (ok) {
      await upsertApprovalPreheatState({
        userId,
        chainId,
        walletAddress: params.walletAddress,
        tokenAddress,
        spenderAddress: spender,
        txHash: txHashes[txHashes.length - 1] || '',
        status: 'confirmed',
      }).catch(() => undefined);
      return { success: true, txHashes };
    }
  } catch (error: any) {
    const message = String(error?.message || error || '');
    if (message.includes('wallet_tx_queue_busy_skip_preheat')) {
      return { success: false, txHashes, error: 'preheat_skipped_wallet_busy' };
    }
    // Fallback below.
  }

  try {
    const zeroOk = await sendApprove(0n);
    if (!zeroOk) return { success: false, txHashes, error: 'approve_zero_not_confirmed' };
    const maxOk = await sendApprove(MAX_UINT256);
    return maxOk
      ? { success: true, txHashes }
      : { success: false, txHashes, error: 'approve_max_after_zero_not_confirmed' };
  } catch (error: any) {
    const message = String(error?.message || error || '');
    if (message.includes('wallet_tx_queue_busy_skip_preheat')) {
      return { success: false, txHashes, error: 'preheat_skipped_wallet_busy' };
    }
    return { success: false, txHashes, error: String(error?.message || error || 'approve_failed') };
  }
}

export async function preheatSellApprovalForToken(
  params: SellApprovalPreheatParams,
  options: SellApprovalPreheatOptions = {},
): Promise<SellApprovalPreheatResult> {
  if (!PREHEAT_ENABLED) return { status: 'noop', reasonCode: 'preheat_disabled' };

  const tokenAddress = toAddress(params.tokenAddress);
  const walletAddress = toAddress(params.walletAddress);
  if (!tokenAddress || !walletAddress) return { status: 'noop', reasonCode: 'invalid_address' };
  if (isNativeToken(tokenAddress, params.chainId)) return { status: 'noop', reasonCode: 'native_token_no_approval' };

  const queueBehavior = options.queueBehavior || 'skip_if_busy';
  const txPurpose = options.txPurpose || 'preheat';

  if (queueBehavior === 'skip_if_busy' && await hasPendingOutgoingTx(params.chainId, walletAddress)) {
    logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Skipped due to pending wallet tx', {
      chainId: params.chainId,
      token: tokenAddress
    });
    return { status: 'deferred', reasonCode: 'pending_wallet_tx' };
  }

  try {
    const decimals = typeof params.tokenDecimals === 'number'
      ? params.tokenDecimals
      : await getErc20Decimals(tokenAddress, params.chainId, 'latest', { lane: 'critical' }).catch(() => 18);

    const probeAmountBase = buildProbeAmountBase(decimals, params.tokenPriceUsd);
    if (probeAmountBase <= 0n) return { status: 'noop', reasonCode: 'probe_amount_zero' };

    const cachedSpenders = getCachedSpenders(params.chainId, tokenAddress);
    if (cachedSpenders.length) {
      logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Spender cache hit', {
        chainId: params.chainId,
        token: tokenAddress,
        spenderCount: cachedSpenders.length
      });
    }
    const freshSpendersPromise = refreshSpendersFromQuotes({
      chainId: params.chainId,
      tokenAddress,
      walletAddress,
      probeAmountBase,
      decimals
    }).catch(() => []);

    const spenders = cachedSpenders.length ? cachedSpenders : await freshSpendersPromise;
    if (!spenders.length) return { status: 'noop', reasonCode: 'spender_missing' };
    let warmedAny = false;

    for (const spender of spenders) {
      const allowance = await getErc20Allowance(tokenAddress, walletAddress, spender, params.chainId, 'latest', { lane: 'critical' }).catch(() => 0n);
      if (allowance >= probeAmountBase) {
        logger.debug(LogCode.SYS_INFO, '[SellApprovalPreheat] Existing allowance already sufficient', {
          chainId: params.chainId,
          token: tokenAddress,
          spender,
          allowance: allowance.toString(),
          required: probeAmountBase.toString()
        });
        continue;
      }

      const approval = await approveWithFallback({
        userId: params.userId,
        accessToken: params.accessToken,
        walletAddress,
        chainId: params.chainId,
        tokenAddress,
        spender,
        queueBehavior,
        txPurpose,
      });

      if (approval.success) {
        warmedAny = true;
        for (const txHash of approval.txHashes) {
          void recordFollowerTransactionFactForLatestPosition({
            userId: params.userId,
            chainId: params.chainId,
            tokenAddress,
            kind: 'approval',
            phase: 'confirmed',
            txHash,
            walletAddress,
            reasonCode: 'ok_sell_approval_warmed',
            metadata: {
              spender,
              txPurpose,
            },
          });
        }
        logger.info(LogCode.EXE_TX_CONFIRMED, '[SellApprovalPreheat] Approval warmed for future sell', {
          chainId: params.chainId,
          token: tokenAddress,
          spender,
          txHashes: approval.txHashes
        });
      } else if (approval.error === 'preheat_skipped_wallet_busy') {
        logger.info(LogCode.SYS_INFO, '[SellApprovalPreheat] Skipped while wallet tx queue busy', {
          chainId: params.chainId,
          token: tokenAddress,
          spender
        });
        return { status: 'deferred', reasonCode: 'wallet_tx_queue_busy' };
      } else {
        await clearApprovalPreheatState({
          chainId: params.chainId,
          walletAddress,
          tokenAddress,
          spenderAddress: spender,
        }).catch(() => undefined);
        for (const txHash of approval.txHashes) {
          void recordFollowerTransactionFactForLatestPosition({
            userId: params.userId,
            chainId: params.chainId,
            tokenAddress,
            kind: 'approval',
            phase: 'failed',
            txHash,
            walletAddress,
            reasonCode: approval.error || 'approval_warmup_failed',
            metadata: {
              spender,
              txPurpose,
            },
          });
        }
        logger.warn(LogCode.SYS_ERROR, '[SellApprovalPreheat] Approval warmup failed (non-fatal)', {
          chainId: params.chainId,
          token: tokenAddress,
          spender,
          txHashes: approval.txHashes,
          error: approval.error
        });
      }
    }

    // Background refresh may discover a better spender route after cached fast-path.
    if (cachedSpenders.length) {
      void freshSpendersPromise.then((freshSpenders) => {
        if (!freshSpenders.length) return;
        logger.debug(LogCode.SYS_INFO, '[SellApprovalPreheat] Spender cache refreshed', {
          chainId: params.chainId,
          token: tokenAddress,
          spenderCount: freshSpenders.length
        });
      });
    }
    return { status: warmedAny ? 'completed' : 'noop', reasonCode: warmedAny ? 'approval_warmed' : 'approval_already_sufficient' };
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[SellApprovalPreheat] Unexpected failure (non-fatal)', {
      chainId: params.chainId,
      token: params.tokenAddress,
      error: String(error?.message || error || 'unknown_error')
    });
    return { status: 'deferred', reasonCode: String(error?.message || error || 'unknown_error') };
  }
}

export const __sellApprovalPreheatTest = {
  buildProbeAmountBase,
  extractSpenders
};
