import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import { getZeroExPrice } from '../../../zeroEx.js';
import { DIRECT_SWAP_SUPPORTED_CHAINS } from '../constants.js';
import type { DirectSwapResult } from '../types.js';
import type { OrderRuntimeContext } from '../../../order-runtime/types.js';
import { markOrderPrepared, recordOrderRoute } from '../../../order-runtime/context.js';

export function isZoraTransientError(error: any): boolean {
  const msg = String(error?.message || error || '').toLowerCase();
  return msg.includes('http 500')
    || msg.includes('"success":"false"')
    || msg.includes('fetch failed')
    || msg.includes('timeout');
}

export async function createZoraQuoteWithRetry(
  payload: any,
  deps: {
    zoraService: { createTradeCallWithReferrer: (payload: any) => Promise<any> };
    retryCount: number;
  }
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= deps.retryCount; attempt++) {
    try {
      return await deps.zoraService.createTradeCallWithReferrer(payload);
    } catch (err: any) {
      lastErr = err;
      if (!isZoraTransientError(err) || attempt >= deps.retryCount) break;
    }
  }
  throw lastErr;
}

export async function executeZoraSdkSwap(
  params: {
    userId: string;
    accessToken: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountInWei: bigint;
    chainId: number;
    slippageBps: number;
    runtimeContext?: OrderRuntimeContext;
  },
  deps: {
    createZoraQuoteWithRetry: (payload: any) => Promise<any>;
    sendTransaction: (userId: string, accessToken: string, tx: any) => Promise<string>;
    getTxExecutionProfile: (chainId: number) => 'default' | 'base-sniper' | 'bsc-sniper';
  }
): Promise<DirectSwapResult> {
  if (params.chainId !== 8453) {
    return { success: false, error: 'Zora SDK route only supported on Base', provider: 'failed' };
  }

  const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const tokenInLower = params.tokenIn.toLowerCase();
  const tokenOutLower = params.tokenOut.toLowerCase();
  const isEthIn = tokenInLower === ETH_ADDRESS;
  const isEthOut = tokenOutLower === ETH_ADDRESS;

  try {
    const quote = await deps.createZoraQuoteWithRetry({
      sell: isEthIn ? { type: 'eth' } : { type: 'erc20', address: params.tokenIn as `0x${string}` },
      buy: isEthOut ? { type: 'eth' } : { type: 'erc20', address: params.tokenOut as `0x${string}` },
      amountIn: params.amountInWei,
      sender: params.walletAddress as `0x${string}`,
      recipient: params.walletAddress as `0x${string}`,
      slippage: Math.min(Math.max(params.slippageBps / 10000, 0.001), 0.99),
      feeContext: 'copyTrade'
    } as any);

    const target = (quote as any)?.call?.target;
    const data = (quote as any)?.call?.data;
    const value = (quote as any)?.call?.value;
    if (!target || !data) {
      return { success: false, error: 'Zora SDK quote missing call payload', provider: 'failed' };
    }

    if (params.runtimeContext) {
      recordOrderRoute(params.runtimeContext, {
        provider: 'zora-sdk',
        poolKind: 'external',
        poolAddress: target
      });
      markOrderPrepared(params.runtimeContext);
    }

    const txHash = await deps.sendTransaction(params.userId, params.accessToken, {
      to: target,
      data,
      value: value ? BigInt(value).toString() : '0',
      chainId: params.chainId,
      txPurpose: 'trade',
      executionProfile: deps.getTxExecutionProfile(params.chainId),
      runtimeContext: params.runtimeContext
    });

    return {
      success: true,
      txHash,
      runtimeContext: params.runtimeContext,
      provider: 'zora-sdk',
      poolInfo: {
        version: 'v4',
        fee: 0,
        liquidity: '0'
      }
    };
  } catch (error: any) {
    logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Zora SDK swap failed', {
      error: error?.message?.slice(0, 120)
    });
    const zoraError = isZoraTransientError(error)
      ? 'HTTP 500: {"success":"false"}'
      : String(error?.message || error || 'zora_swap_failed');
    return { success: false, error: zoraError, provider: 'failed' };
  }
}

export async function executeV3VirtualBridgeSwap(
  params: {
    userId: string;
    accessToken: string;
    walletAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountInWei: bigint;
    chainId: number;
    slippageBps: number;
    runtimeContext?: OrderRuntimeContext;
  },
  bridgeToken: string,
  quote: {
    amountOut: bigint;
    feeInToBridge: number;
    feeBridgeToOut: number;
  },
  deps: {
    callRpc: <T = any>(chainIdOrName: number | string, method: string, params?: any, options?: any) => Promise<T>;
    sendTransaction: (userId: string, accessToken: string, tx: any) => Promise<string>;
    getTxExecutionProfile: (chainId: number) => 'default' | 'base-sniper' | 'bsc-sniper';
    wethAddresses: Record<number, string>;
  }
): Promise<DirectSwapResult> {
  const { userId, accessToken, walletAddress, tokenIn, tokenOut, chainId, slippageBps } = params;
  const routerAddress = chainId === 8453 ? '0x2626664c2603336E57B271c5C0b26F421741e481' : '';
  if (!routerAddress) {
    return { success: false, error: 'V3 router not available for virtual bridge', provider: 'failed' };
  }

  const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const weth = deps.wethAddresses[chainId];
  if (!weth) {
    return { success: false, error: 'WETH not configured', provider: 'failed' };
  }

  const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
  const normalizedIn = isNativeIn ? weth : tokenIn;
  const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase() ? weth : tokenOut;
  const minAmountOut = quote.amountOut * BigInt(10000 - slippageBps) / 10000n;

  const path = ethers.solidityPacked(
    ['address', 'uint24', 'address', 'uint24', 'address'],
    [normalizedIn, quote.feeInToBridge, bridgeToken, quote.feeBridgeToOut, normalizedOut]
  );

  const ifaceNoDeadline = new ethers.Interface([
    'function exactInput((bytes path,address recipient,uint256 amountIn,uint256 amountOutMinimum)) external payable returns (uint256 amountOut)'
  ]);
  const ifaceWithDeadline = new ethers.Interface([
    'function exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum)) external payable returns (uint256 amountOut)'
  ]);

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const paramsNoDeadline = {
    path,
    recipient: walletAddress,
    amountIn: params.amountInWei,
    amountOutMinimum: minAmountOut
  };
  const paramsWithDeadline = {
    path,
    recipient: walletAddress,
    deadline,
    amountIn: params.amountInWei,
    amountOutMinimum: minAmountOut
  };

  let data = ifaceNoDeadline.encodeFunctionData('exactInput', [paramsNoDeadline]);
  try {
    await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
      from: walletAddress,
      to: routerAddress,
      data,
      value: isNativeIn ? ethers.toQuantity(params.amountInWei) : '0x0'
    }]);
  } catch {
    data = ifaceWithDeadline.encodeFunctionData('exactInput', [paramsWithDeadline]);
  }

  let gasLimit = '550000';
  try {
    const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
      from: walletAddress,
      to: routerAddress,
      data,
      value: isNativeIn ? ethers.toQuantity(params.amountInWei) : '0x0'
    }]);
    gasLimit = (BigInt(estimate) * 2n).toString();
  } catch {
    gasLimit = '550000';
  }
  if (params.runtimeContext) {
    recordOrderRoute(params.runtimeContext, {
      provider: 'uniswap-v3',
      poolKind: 'v3',
      poolAddress: routerAddress
    });
    markOrderPrepared(params.runtimeContext);
  }

  const txHash = await deps.sendTransaction(userId, accessToken, {
    to: routerAddress,
    data,
    value: isNativeIn ? params.amountInWei.toString() : '0',
    chainId,
    txPurpose: 'trade',
    executionProfile: deps.getTxExecutionProfile(chainId),
    gas: gasLimit,
    runtimeContext: params.runtimeContext
  });

  logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] Virtual bridge swap executed', {
    txHash,
    bridgeToken,
    feeInToVirtual: quote.feeInToBridge,
    feeVirtualToOut: quote.feeBridgeToOut
  });

  return {
    success: true,
    txHash,
    runtimeContext: params.runtimeContext,
    provider: 'uniswap-v3',
    poolInfo: {
      version: 'v3-virtual-bridge',
      fee: quote.feeInToBridge,
      liquidity: '0'
    }
  };
}

export function isDirectSwapSupported(chainId: number): boolean {
  return DIRECT_SWAP_SUPPORTED_CHAINS.includes(chainId as (typeof DIRECT_SWAP_SUPPORTED_CHAINS)[number]);
}

export async function get0xExpectedOutput(
  tokenIn: string,
  tokenOut: string,
  amountInWei: bigint,
  chainId: number,
  signal?: AbortSignal,
  deps?: {
    getZeroExPriceFn?: typeof getZeroExPrice;
  }
): Promise<bigint> {
  try {
    const zeroExPrice = deps?.getZeroExPriceFn ?? getZeroExPrice;
    const price = await zeroExPrice(tokenIn, tokenOut, amountInWei.toString(), chainId, signal);
    if (price?.buyAmount) {
      logger.debug(LogCode.API_FETCH_SUCCESS, '[DirectSwap] 0x price fetched', {
        expectedOut: price.buyAmount.slice(0, 15)
      });
      return BigInt(price.buyAmount);
    }
  } catch (e: any) {
    logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x price fetch failed, no slippage protection', {
      error: e.message?.slice(0, 100)
    });
  }

  return 0n;
}

export async function getZoraSdkExpectedOutput(
  params: {
    tokenIn: string;
    tokenOut: string;
    amountInWei: bigint;
    chainId: number;
    recipient: string;
  },
  deps: {
    zoraQuoteTimeoutMs: number;
    createZoraQuoteWithRetry: (payload: any) => Promise<any>;
    withTimeout: <T>(promise: Promise<T>, ms: number) => Promise<T>;
  }
): Promise<bigint> {
  if (params.chainId !== 8453) return 0n;
  if (params.amountInWei <= 0n) return 0n;

  const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const tokenInLower = params.tokenIn.toLowerCase();
  const tokenOutLower = params.tokenOut.toLowerCase();
  const isEthIn = tokenInLower === ETH_ADDRESS;
  const isEthOut = tokenOutLower === ETH_ADDRESS;

  try {
    const quote = await deps.withTimeout(
      deps.createZoraQuoteWithRetry({
        sell: isEthIn ? { type: 'eth' } : { type: 'erc20', address: params.tokenIn as `0x${string}` },
        buy: isEthOut ? { type: 'eth' } : { type: 'erc20', address: params.tokenOut as `0x${string}` },
        amountIn: params.amountInWei,
        sender: params.recipient as `0x${string}`,
        recipient: params.recipient as `0x${string}`,
        slippage: 0.05
      } as any),
      deps.zoraQuoteTimeoutMs
    );

    const outRaw = (quote as any)?.quote?.amountOut ?? (quote as any)?.amountOut;
    if (outRaw === undefined || outRaw === null) return 0n;
    return BigInt(outRaw.toString());
  } catch {
    return 0n;
  }
}

export async function isZoraCoinAddress(
  address: string,
  deps: {
    zoraService: { getCoinByAddress: (address: string) => Promise<any> };
    zoraRoutableTokenCache: Map<string, { value: boolean; timestamp: number }>;
    zoraRoutableCacheTtlMs: number;
  }
): Promise<boolean> {
  const normalized = String(address || '').toLowerCase();
  if (!normalized.startsWith('0x')) return false;

  const cached = deps.zoraRoutableTokenCache.get(normalized);
  if (cached && Date.now() - cached.timestamp < deps.zoraRoutableCacheTtlMs) {
    return cached.value;
  }

  try {
    const coin = await deps.zoraService.getCoinByAddress(normalized);
    const isZoraCoin = Boolean(coin?.address);
    deps.zoraRoutableTokenCache.set(normalized, { value: isZoraCoin, timestamp: Date.now() });
    return isZoraCoin;
  } catch {
    deps.zoraRoutableTokenCache.set(normalized, { value: false, timestamp: Date.now() });
    return false;
  }
}

export async function shouldEnableZoraRoutes(
  tokenIn: string,
  tokenOut: string,
  chainId: number,
  deps: {
    zoraTokenAddresses: Record<number, string>;
    zoraService: { getCoinByAddress: (address: string) => Promise<any> };
    zoraRoutableTokenCache: Map<string, { value: boolean; timestamp: number }>;
    zoraRoutableCacheTtlMs: number;
  }
): Promise<boolean> {
  if (chainId !== 8453) return false;
  const zoraToken = deps.zoraTokenAddresses[chainId]?.toLowerCase();
  if (!zoraToken) return false;

  const inLower = String(tokenIn || '').toLowerCase();
  const outLower = String(tokenOut || '').toLowerCase();
  if (inLower === zoraToken || outLower === zoraToken) return true;

  const [inIsZoraCoin, outIsZoraCoin] = await Promise.all([
    isZoraCoinAddress(inLower, deps),
    isZoraCoinAddress(outLower, deps)
  ]);
  return inIsZoraCoin || outIsZoraCoin;
}
