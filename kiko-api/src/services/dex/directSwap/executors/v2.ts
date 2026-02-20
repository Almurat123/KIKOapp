import { ethers } from 'ethers';
import type { DirectSwapResult } from '../types.js';

interface ExecuteSwapParams {
  userId: string;
  accessToken: string;
  walletAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountInWei: bigint;
  chainId: number;
  slippageBps: number;
}

interface V2ExecutorDeps {
  v2Routers: Record<number, string>;
  wethAddresses: Record<number, string>;
  v2RouterInterface: ethers.Interface;
  callRpc: <T>(chainId: number, method: string, params: any[]) => Promise<T>;
  sendTransaction: (userId: string, accessToken: string, tx: any) => Promise<string>;
  getTxExecutionProfile: (chainId: number) => 'default' | 'base-sniper' | 'bsc-sniper';
}

export async function executeV2Swap(
  params: ExecuteSwapParams,
  expectedOut: bigint,
  deps: V2ExecutorDeps
): Promise<DirectSwapResult> {
  const router = deps.v2Routers[params.chainId];
  if (!router) return { success: false, error: 'V2 router not available', provider: 'failed' };

  const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const weth = deps.wethAddresses[params.chainId];
  if (!weth) return { success: false, error: 'WETH not configured', provider: 'failed' };

  const amountInWei = params.amountInWei;
  const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS;
  const isNativeOut = params.tokenOut.toLowerCase() === ETH_ADDRESS;

  const normalizedIn = isNativeIn ? weth : params.tokenIn;
  const normalizedOut = isNativeOut ? weth : params.tokenOut;

  const minAmountOut = expectedOut > 0n
    ? expectedOut * BigInt(10000 - params.slippageBps) / BigInt(10000)
    : 0n;

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const data = isNativeIn
    ? deps.v2RouterInterface.encodeFunctionData('swapExactETHForTokens', [
      minAmountOut,
      [normalizedIn, normalizedOut],
      params.walletAddress,
      deadline
    ])
    : isNativeOut
      ? deps.v2RouterInterface.encodeFunctionData('swapExactTokensForETH', [
        amountInWei,
        minAmountOut,
        [normalizedIn, normalizedOut],
        params.walletAddress,
        deadline
      ])
      : deps.v2RouterInterface.encodeFunctionData('swapExactTokensForTokens', [
        amountInWei,
        minAmountOut,
        [normalizedIn, normalizedOut],
        params.walletAddress,
        deadline
      ]);

  let gasLimit: string;
  try {
    const estimate = await deps.callRpc<string>(params.chainId, 'eth_estimateGas', [{
      from: params.walletAddress,
      to: router,
      data,
      value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
    }]);
    gasLimit = (BigInt(estimate) * 2n).toString();
  } catch {
    gasLimit = '350000';
  }

  const txHash = await deps.sendTransaction(params.userId, params.accessToken, {
    to: router,
    data,
    value: isNativeIn ? amountInWei.toString() : '0',
    chainId: params.chainId,
    txPurpose: 'trade',
    executionProfile: deps.getTxExecutionProfile(params.chainId),
    gas: gasLimit
  });

  return {
    success: true,
    txHash,
    provider: params.chainId === 56 ? 'pancake-v2' : 'uniswap-v2',
    poolInfo: {
      version: 'v2',
      fee: 0,
      liquidity: '0'
    }
  };
}
