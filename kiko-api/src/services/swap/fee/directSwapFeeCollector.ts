import { ethers } from 'ethers';
import { LogCode } from '../../../config/logRegistry.js';
import { isNativeToken } from '../../../config/tokenRegistry.js';
import { logger } from '../../../utils/logger.js';
import { resolveCopytradeExecutionAuth } from '../../copytrade/auth/copytradeExecutionAuth.js';
import { getPlatformFee, isValidEvmAddress, type FeeContext } from '../../platformFeeService.js';
import { sendTransaction } from '../../privyWallet.js';
import { getTokenInfo } from '../../tokenService.js';

export interface DirectSwapFeeRequest {
  userId: string;
  accessToken?: string;
  amountIn: string;
  chainId: number;
  feeBpsOverride?: number;
  mode: string;
}

export async function collectDirectSwapFee(params: {
  request: DirectSwapFeeRequest;
  normalizedTokenIn: string;
  normalizedTokenOut: string;
  amountOutBase?: string;
  feeContext: FeeContext;
  trace: (msg: string) => string;
}): Promise<void> {
  const { request, normalizedTokenIn, normalizedTokenOut, amountOutBase, feeContext, trace } = params;
  const fee = getPlatformFee(feeContext, request.feeBpsOverride);
  if (fee.bps <= 0 || !isValidEvmAddress(fee.evmRecipient)) return;

  const auth = resolveCopytradeExecutionAuth({
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
        const tokenInfo = await getTokenInfo(feeToken, request.chainId);
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

  if (isNativeToken(feeToken, request.chainId)) {
    const feeTxHash = await sendTransaction(request.userId, auth.accessToken, {
      to: fee.evmRecipient!,
      data: '0x',
      value: feeAmount.toString(),
      chainId: request.chainId,
      txPurpose: 'fee'
    });
    logger.info(LogCode.EXE_TX_CONFIRMED, trace('Direct swap native fee sent'), {
      feeTxHash,
      feeBaseSource,
      feeAmount: feeAmount.toString(),
      feeRecipient: fee.evmRecipient,
      authMode: auth.mode
    });
    return;
  }

  const erc20 = new ethers.Interface(['function transfer(address to, uint256 value)']);
  const feeTxHash = await sendTransaction(request.userId, auth.accessToken, {
    to: feeToken,
    data: erc20.encodeFunctionData('transfer', [fee.evmRecipient!, feeAmount]),
    value: '0',
    chainId: request.chainId,
    txPurpose: 'fee'
  });
  logger.info(LogCode.EXE_TX_CONFIRMED, trace('Direct swap token fee sent'), {
    feeTxHash,
    token: feeToken,
    feeBaseSource,
    feeAmount: feeAmount.toString(),
    feeRecipient: fee.evmRecipient,
    authMode: auth.mode
  });
}
