import { ethers } from 'ethers';

import { NATIVE_TOKEN_ADDRESS } from '../../../config/tokenRegistry.js';
import { getGasPrice } from '../../rpcManager.js';
import { getBestQuote } from '../../quoteService.js';

const DEFAULT_EXIT_GAS_FLOOR_MULTIPLIER_BPS = Math.max(
  10_000,
  Number(process.env.COPYTRADE_EXIT_GAS_FLOOR_MULTIPLIER_BPS || '12000'),
);

export interface ExitEconomicsEvaluation {
  executable: boolean;
  reasonCode: string;
  expectedOutBase: bigint;
  gasFloorBase: bigint;
  gasEstimate: number;
  gasPriceWei: bigint;
}

export async function evaluateEvmExitEconomics(params: {
  chainId: number;
  walletAddress: string;
  tokenAddress: string;
  amountInBase: bigint;
  tokenDecimals: number;
  slippageBps?: number;
}): Promise<ExitEconomicsEvaluation> {
  if (params.amountInBase <= 0n) {
    return {
      executable: false,
      reasonCode: 'exit_economics_amount_zero',
      expectedOutBase: 0n,
      gasFloorBase: 0n,
      gasEstimate: 0,
      gasPriceWei: 0n,
    };
  }

  const amountInHuman = Number(ethers.formatUnits(params.amountInBase, params.tokenDecimals));
  if (!Number.isFinite(amountInHuman) || amountInHuman <= 0) {
    return {
      executable: false,
      reasonCode: 'exit_economics_amount_invalid',
      expectedOutBase: 0n,
      gasFloorBase: 0n,
      gasEstimate: 0,
      gasPriceWei: 0n,
    };
  }

  const quoteBundle = await getBestQuote({
    tokenIn: params.tokenAddress,
    tokenOut: NATIVE_TOKEN_ADDRESS,
    actualTokenIn: params.tokenAddress,
    actualTokenOut: NATIVE_TOKEN_ADDRESS,
    amountInBase: params.amountInBase.toString(),
    amountInHuman,
    tokenInDecimals: params.tokenDecimals,
    tokenOutDecimals: 18,
    chainId: params.chainId,
    slippageBps: params.slippageBps ?? 2000,
    userAddress: params.walletAddress,
    feeContext: 'copyTrade',
    isSell: true,
    executionMode: 'turbo',
    sellQuotePolicy: 'first_executable',
    preferPermit2: false,
  });

  const gasPriceWei = BigInt(await getGasPrice(params.chainId));
  const gasEstimate = Math.max(0, Math.ceil(Number(quoteBundle.best?.gasEstimate || 0)));
  const expectedOutBase = BigInt(String(quoteBundle.best?.amountOutBase || '0'));
  const gasFloorBase = gasEstimate > 0
    ? (BigInt(gasEstimate) * gasPriceWei * BigInt(DEFAULT_EXIT_GAS_FLOOR_MULTIPLIER_BPS)) / 10_000n
    : 0n;

  return {
    executable: expectedOutBase > gasFloorBase,
    reasonCode: expectedOutBase > gasFloorBase
      ? 'exit_economics_ok'
      : 'exit_blocked_uneconomic',
    expectedOutBase,
    gasFloorBase,
    gasEstimate,
    gasPriceWei,
  };
}
