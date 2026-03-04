import { ethers } from 'ethers';
import { LogCode } from '../../../config/logRegistry.js';
import { isNativeToken } from '../../../config/tokenRegistry.js';
import { logger } from '../../../utils/logger.js';
import { resolveCopytradeExecutionAuth } from '../../copytrade-v2/auth/copytradeExecutionAuth.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from '../../platformFeeService.js';
import { sendTransaction } from '../../privyWallet.js';
import { getTokenInfo } from '../../tokenService.js';
import {
  buildDirectSwapFeeExecutionKey,
  claimDirectSwapFeeExecution,
  markDirectSwapFeeExecutionFailed,
  markDirectSwapFeeExecutionSent,
  type DirectSwapFeeClaimResult
} from './directSwapFeeExecutionGuard.js';

export interface DirectSwapFeeRequest {
  userId: string;
  accessToken?: string;
  amountIn: string;
  chainId: number;
  feeBpsOverride?: number;
  mode: string;
  sourceTxHash?: string;
}

export interface DirectSwapFeeSettlement {
  amountIn: string;
  chainId: number;
  mode: string;
  accessToken?: string;
  feeBpsOverride?: number;
  normalizedTokenIn: string;
  normalizedTokenOut: string;
  amountOutBase?: string;
  feeContext: FeeContext;
  deferred: boolean;
  reasonCode: string;
  sourceTxHash?: string;
}

export interface DirectSwapFeeCollectorDeps {
  resolvePlatformFee?: typeof getPlatformFee;
  validateEvmAddress?: typeof isValidEvmAddress;
  resolveExecutionAuth?: typeof resolveCopytradeExecutionAuth;
  getTokenInfo?: typeof getTokenInfo;
  sendTransaction?: typeof sendTransaction;
  claimFeeExecution?: (params: {
    feeExecutionKey: string;
    userId: string;
    chainId: number;
    sourceTxHash: string;
    mode: string;
    feeToken: string;
    feeRecipient: string;
    feeBps: number;
  }) => Promise<DirectSwapFeeClaimResult>;
  markFeeExecutionSent?: (params: {
    feeExecutionKey: string;
    feeTxHash: string;
    feeAmount: string;
    feeToken: string;
    feeRecipient: string;
  }) => Promise<void>;
  markFeeExecutionFailed?: (params: {
    feeExecutionKey: string;
    error: string;
  }) => Promise<void>;
  waitMs?: number;
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildDirectSwapFeeSettlement(params: {
  request: DirectSwapFeeRequest;
  normalizedTokenIn: string;
  normalizedTokenOut: string;
  amountOutBase?: string;
  feeContext: FeeContext;
  deferred: boolean;
  reasonCode: string;
}): DirectSwapFeeSettlement | null {
  const fee = getPlatformFee(params.feeContext, params.request.feeBpsOverride);
  if (fee.bps <= 0 || !isValidEvmAddress(fee.evmRecipient)) {
    return null;
  }
  return {
    amountIn: params.request.amountIn,
    chainId: params.request.chainId,
    mode: params.request.mode,
    accessToken: params.request.accessToken,
    feeBpsOverride: params.request.feeBpsOverride,
    normalizedTokenIn: params.normalizedTokenIn,
    normalizedTokenOut: params.normalizedTokenOut,
    amountOutBase: params.amountOutBase,
    feeContext: params.feeContext,
    deferred: params.deferred,
    reasonCode: params.reasonCode,
    sourceTxHash: params.request.sourceTxHash
  };
}

export async function collectDirectSwapFee(params: {
  request: DirectSwapFeeRequest;
  normalizedTokenIn: string;
  normalizedTokenOut: string;
  amountOutBase?: string;
  feeContext: FeeContext;
  trace: (msg: string) => string;
  deps?: DirectSwapFeeCollectorDeps;
}): Promise<void> {
  const { request, normalizedTokenIn, normalizedTokenOut, amountOutBase, feeContext, trace, deps } = params;
  const resolvePlatformFee = deps?.resolvePlatformFee || getPlatformFee;
  const validateEvmAddress = deps?.validateEvmAddress || isValidEvmAddress;
  const resolveExecutionAuth = deps?.resolveExecutionAuth || resolveCopytradeExecutionAuth;
  const fetchTokenInfo = deps?.getTokenInfo || getTokenInfo;
  const sendTx = deps?.sendTransaction || sendTransaction;
  const claimFeeExecution = deps?.claimFeeExecution || claimDirectSwapFeeExecution;
  const markFeeExecutionSent = deps?.markFeeExecutionSent || markDirectSwapFeeExecutionSent;
  const markFeeExecutionFailed = deps?.markFeeExecutionFailed || markDirectSwapFeeExecutionFailed;
  const inflightWaitMs = Math.max(0, Math.floor(Number(deps?.waitMs ?? 1200)));

  const fee = resolvePlatformFee(feeContext, request.feeBpsOverride);
  if (fee.bps <= 0 || !validateEvmAddress(fee.evmRecipient)) return;

  const auth = resolveExecutionAuth({
    mode: request.mode,
    accessToken: request.accessToken
  });
  if (!auth.canCollectDirectSwapFee) {
    logger.warn(LogCode.SYS_INFO, trace('Direct swap fee skipped: auth unavailable'), {
      reasonCode: auth.reasonCode
    });
    return;
  }

  let feeToken = normalizedTokenOut;
  let feeBaseAmount = amountOutBase;
  let feeBaseSource: 'amountOut' | 'amountInFallback' = 'amountOut';

  if (!feeBaseAmount) {
    feeBaseSource = 'amountInFallback';
    feeToken = normalizedTokenIn;
    try {
      if (isNativeToken(feeToken, request.chainId)) {
        feeBaseAmount = ethers.parseUnits(request.amountIn, 18).toString();
      } else {
        const tokenInfo = await fetchTokenInfo(feeToken, request.chainId);
        const decimals = tokenInfo?.decimals ?? 18;
        feeBaseAmount = ethers.parseUnits(request.amountIn, decimals).toString();
      }
      logger.warn(LogCode.SYS_INFO, trace('Direct swap fee fallback: amountOut missing, using amountIn'), {
        reasonCode: 'fee_base_amount_in_fallback'
      });
    } catch (fallbackErr: any) {
      logger.warn(LogCode.SYS_INFO, trace('Direct swap fee skipped: missing amountOut and amountIn fallback failed'), {
        error: fallbackErr?.message || String(fallbackErr),
        reasonCode: 'fee_skip_amount_missing'
      });
      return;
    }
  }

  let rawOut: bigint;
  try {
    rawOut = BigInt(feeBaseAmount);
  } catch {
    logger.warn(LogCode.SYS_INFO, trace('Direct swap fee skipped: invalid fee base amount format'), {
      feeBaseAmount,
      reasonCode: 'fee_skip_invalid_base_amount'
    });
    return;
  }

  if (rawOut <= 0n) return;

  const feeAmount = rawOut * BigInt(fee.bps) / 10000n;
  if (feeAmount <= 0n) return;

  const sendFeeTransaction = async (): Promise<{ feeTxHash: string; feeKind: 'native' | 'token' }> => {
    if (isNativeToken(feeToken, request.chainId)) {
      const feeTxHash = await sendTx(request.userId, auth.accessToken, {
        to: fee.evmRecipient!,
        data: '0x',
        value: feeAmount.toString(),
        chainId: request.chainId,
        txPurpose: 'fee'
      });
      return { feeTxHash, feeKind: 'native' };
    }

    const erc20 = new ethers.Interface(['function transfer(address to, uint256 value)']);
    const feeTxHash = await sendTx(request.userId, auth.accessToken, {
      to: feeToken,
      data: erc20.encodeFunctionData('transfer', [fee.evmRecipient!, feeAmount]),
      value: '0',
      chainId: request.chainId,
      txPurpose: 'fee'
    });
    return { feeTxHash, feeKind: 'token' };
  };

  const sourceTxHash = String(request.sourceTxHash || '').trim().toLowerCase();
  const feeExecutionKey = sourceTxHash
    ? buildDirectSwapFeeExecutionKey({
      userId: request.userId,
      chainId: request.chainId,
      sourceTxHash,
      mode: request.mode,
      feeToken,
      feeRecipient: fee.evmRecipient!,
      feeBps: fee.bps
    })
    : '';

  let shouldSend = true;
  let dedupClaimed = false;
  if (feeExecutionKey) {
    try {
      let claimResult = await claimFeeExecution({
        feeExecutionKey,
        userId: request.userId,
        chainId: request.chainId,
        sourceTxHash,
        mode: request.mode,
        feeToken,
        feeRecipient: fee.evmRecipient!,
        feeBps: fee.bps
      });

      if (claimResult.status === 'inflight') {
        await sleep(inflightWaitMs);
        claimResult = await claimFeeExecution({
          feeExecutionKey,
          userId: request.userId,
          chainId: request.chainId,
          sourceTxHash,
          mode: request.mode,
          feeToken,
          feeRecipient: fee.evmRecipient!,
          feeBps: fee.bps
        });
      }

      if (claimResult.status !== 'claimed') {
        logger.info(LogCode.SYS_INFO, trace('Direct swap fee deduplicated; skipping send'), {
          reasonCode: claimResult.reasonCode,
          sourceTxHash,
          priorFeeTxHash: claimResult.status === 'already_sent'
            ? claimResult.feeTxHash
            : undefined
        });
        shouldSend = false;
      } else {
        dedupClaimed = true;
      }
    } catch (claimErr: any) {
      logger.warn(LogCode.SYS_ERROR, trace('Direct swap fee dedup guard unavailable; falling back to non-idempotent send'), {
        reasonCode: 'fee_dedup_guard_unavailable',
        sourceTxHash,
        error: claimErr?.message || String(claimErr)
      });
    }
  } else {
    logger.warn(LogCode.SYS_INFO, trace('Direct swap fee idempotency disabled: source tx hash missing'), {
      reasonCode: 'fee_dedup_source_missing'
    });
  }

  if (!shouldSend) return;

  try {
    const { feeTxHash, feeKind } = await sendFeeTransaction();
    if (feeExecutionKey && dedupClaimed) {
      await markFeeExecutionSent({
        feeExecutionKey,
        feeTxHash,
        feeAmount: feeAmount.toString(),
        feeToken,
        feeRecipient: fee.evmRecipient!
      }).catch((markErr: any) => {
        logger.warn(LogCode.SYS_ERROR, trace('Direct swap fee mark-sent failed; execution already broadcast'), {
          reasonCode: 'fee_mark_sent_failed',
          sourceTxHash: sourceTxHash || undefined,
          feeTxHash,
          error: markErr?.message || String(markErr)
        });
      });
    }
    logger.info(LogCode.EXE_TX_CONFIRMED, trace(`Direct swap ${feeKind} fee sent`), {
      feeTxHash,
      token: feeKind === 'token' ? feeToken : undefined,
      feeBaseSource,
      feeAmount: feeAmount.toString(),
      feeRecipient: fee.evmRecipient,
      authMode: auth.mode,
      sourceTxHash: sourceTxHash || undefined
    });
  } catch (sendErr: any) {
    if (feeExecutionKey && dedupClaimed) {
      await markFeeExecutionFailed({
        feeExecutionKey,
        error: sendErr?.message || String(sendErr)
      }).catch(() => undefined);
    }
    throw sendErr;
  }
}

export async function collectDirectSwapFeeFromSettlement(params: {
  userId: string;
  settlement: DirectSwapFeeSettlement;
  trace: (msg: string) => string;
  deps?: DirectSwapFeeCollectorDeps;
}): Promise<void> {
  const { settlement, trace, deps } = params;
  await collectDirectSwapFee({
    request: {
      userId: params.userId,
      accessToken: settlement.accessToken,
      amountIn: settlement.amountIn,
      chainId: settlement.chainId,
      feeBpsOverride: settlement.feeBpsOverride,
      mode: settlement.mode,
      sourceTxHash: settlement.sourceTxHash
    },
    normalizedTokenIn: settlement.normalizedTokenIn,
    normalizedTokenOut: settlement.normalizedTokenOut,
    amountOutBase: settlement.amountOutBase,
    feeContext: settlement.feeContext,
    trace,
    deps
  });
}
