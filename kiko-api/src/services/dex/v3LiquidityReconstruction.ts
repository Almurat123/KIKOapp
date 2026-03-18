import { ethers } from 'ethers';
import { callRpc as callRpcRaw } from '../rpcManager.js';
import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import { TRADE_QUOTE_PROFILE } from '../rpc/profile.js';

const MIN_TICK = -887272;
const MAX_TICK = 887272;
const Q96 = 1n << 96n;
const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

const multicall3Interface = new ethers.Interface([
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])'
]);

const v3PoolLiquidityInterface = new ethers.Interface([
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)',
  'function liquidity() view returns (uint128)',
  'function tickSpacing() view returns (int24)',
  'function ticks(int24 tick) view returns (uint128 liquidityGross, int128 liquidityNet, uint256, uint256, int56, uint160, uint32, bool)'
]);

const v3BitmapInterface = new ethers.Interface([
  'function tickBitmap(int16 wordPosition) view returns (uint256)'
]);

type TickLiquidity = {
  tick: number;
  liquidityNet: bigint;
};

export interface V3ReconstructedLiquidity {
  totalValueLockedUsd: number;
  amount0: number;
  amount1: number;
  initializedTickCount: number;
  intervalCount: number;
  tickSpacing: number;
  currentTick: number;
  reconstructed: boolean;
}

function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

function getSqrtRatioAtTick(tick: number): bigint {
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error(`Tick out of range: ${tick}`);
  }

  let absTick = tick < 0 ? BigInt(-tick) : BigInt(tick);
  let ratio = (absTick & 0x1n) !== 0n
    ? 0xfffcb933bd6fad37aa2d162d1a594001n
    : 0x100000000000000000000000000000000n;

  const multipliers: bigint[] = [
    0xfff97272373d413259a46990580e213an,
    0xfff2e50f5f656932ef12357cf3c7fdccn,
    0xffe5caca7e10e4e61c3624eaa0941cd0n,
    0xffcb9843d60f6159c9db58835c926644n,
    0xff973b41fa98c081472e6896dfb254c0n,
    0xff2ea16466c96a3843ec78b326b52861n,
    0xfe5dee046a99a2a811c461f1969c3053n,
    0xfcbe86c7900a88aedcffc83b479aa3a4n,
    0xf987a7253ac413176f2b074cf7815e54n,
    0xf3392b0822b70005940c7a398e4b70f3n,
    0xe7159475a2c29b7443b29c7fa6e889d9n,
    0xd097f3bdfd2022b8845ad8f792aa5825n,
    0xa9f746462d870fdf8a65dc1f90e061e5n,
    0x70d869a156d2a1b890bb3df62baf32f7n,
    0x31be135f97d08fd981231505542fcfa6n,
    0x09aa508b5b7a84e1c677de54f3e99bc9n,
    0x005d6af8dedb81196699c329225ee604n,
    0x0002216e584f5fa1ea926041bedfe98n,
    0x000048a170391f7dc42444e8fa2n
  ];

  for (let i = 0; i < multipliers.length; i += 1) {
    if ((absTick & (1n << BigInt(i + 1))) !== 0n) {
      ratio = (ratio * multipliers[i]) >> 128n;
    }
  }

  if (tick > 0) {
    ratio = ((1n << 256n) - 1n) / ratio;
  }

  const sqrtPriceX96 = ratio >> 32n;
  return (ratio & ((1n << 32n) - 1n)) === 0n ? sqrtPriceX96 : sqrtPriceX96 + 1n;
}

function amount0Delta(liquidity: bigint, sqrtRatioAX96: bigint, sqrtRatioBX96: bigint): number {
  if (liquidity <= 0n || sqrtRatioAX96 === sqrtRatioBX96) return 0;
  let sqrtA = sqrtRatioAX96;
  let sqrtB = sqrtRatioBX96;
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];

  const numerator = liquidity * (sqrtB - sqrtA) * Q96;
  const denominator = sqrtB * sqrtA;
  return Number(numerator) / Number(denominator);
}

function amount1Delta(liquidity: bigint, sqrtRatioAX96: bigint, sqrtRatioBX96: bigint): number {
  if (liquidity <= 0n || sqrtRatioAX96 === sqrtRatioBX96) return 0;
  let sqrtA = sqrtRatioAX96;
  let sqrtB = sqrtRatioBX96;
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  return Number(liquidity * (sqrtB - sqrtA)) / Number(Q96);
}

async function multicall3(chainId: number, calls: Array<{ target: string; allowFailure?: boolean; callData: string }>): Promise<Array<{ success: boolean; returnData: string }>> {
  const encoded = multicall3Interface.encodeFunctionData('aggregate3', [calls.map((call) => ({
    target: call.target,
    allowFailure: call.allowFailure ?? true,
    callData: call.callData
  }))]);
  const result = await callRpcRaw<string>(chainId, 'eth_call', [{ to: MULTICALL3_ADDRESS, data: encoded }, 'latest'], {
    strategy: TRADE_QUOTE_PROFILE.strategy,
    importance: TRADE_QUOTE_PROFILE.importance,
    purpose: TRADE_QUOTE_PROFILE.purpose,
    exhaustiveFailover: true
  });
  return multicall3Interface.decodeFunctionResult('aggregate3', result)[0] as Array<{ success: boolean; returnData: string }>;
}

async function readInitializedTicks(poolAddress: string, chainId: number, tickSpacing: number): Promise<TickLiquidity[]> {
  const compressedMin = floorDiv(MIN_TICK, tickSpacing);
  const compressedMax = floorDiv(MAX_TICK, tickSpacing);
  const minWord = floorDiv(compressedMin, 256);
  const maxWord = floorDiv(compressedMax, 256);

  const wordPositions: number[] = [];
  for (let word = minWord; word <= maxWord; word += 1) {
    wordPositions.push(word);
  }

  const bitmapCalls = wordPositions.map((wordPosition) => ({
    target: poolAddress,
    allowFailure: true,
    callData: v3BitmapInterface.encodeFunctionData('tickBitmap', [wordPosition])
  }));

  const initializedTicks: number[] = [];
  const batchSize = 128;
  for (let i = 0; i < bitmapCalls.length; i += batchSize) {
    const batch = bitmapCalls.slice(i, i + batchSize);
    const wordBatch = wordPositions.slice(i, i + batchSize);
    const results = await multicall3(chainId, batch);
    for (let j = 0; j < results.length; j += 1) {
      if (!results[j].success || results[j].returnData === '0x') continue;
      const bitmap = BigInt(results[j].returnData);
      if (bitmap === 0n) continue;
      const wordPosition = wordBatch[j];
      for (let bit = 0; bit < 256; bit += 1) {
        if ((bitmap & (1n << BigInt(bit))) === 0n) continue;
        const compressed = wordPosition * 256 + bit;
        initializedTicks.push(compressed * tickSpacing);
      }
    }
  }

  if (initializedTicks.length === 0) {
    return [];
  }

  const tickCalls = initializedTicks.map((tick) => ({
    target: poolAddress,
    allowFailure: true,
    callData: v3PoolLiquidityInterface.encodeFunctionData('ticks', [tick])
  }));

  const tickResults: TickLiquidity[] = [];
  for (let i = 0; i < tickCalls.length; i += batchSize) {
    const batch = tickCalls.slice(i, i + batchSize);
    const tickBatch = initializedTicks.slice(i, i + batchSize);
    const results = await multicall3(chainId, batch);
    for (let j = 0; j < results.length; j += 1) {
      if (!results[j].success || results[j].returnData === '0x') continue;
      const decoded = v3PoolLiquidityInterface.decodeFunctionResult('ticks', results[j].returnData);
      const liquidityNet = decoded[1] as bigint;
      if (liquidityNet === 0n) continue;
      tickResults.push({
        tick: tickBatch[j],
        liquidityNet
      });
    }
  }

  return tickResults.sort((a, b) => a.tick - b.tick);
}

export async function reconstructV3PoolLiquidityUsd(params: {
  poolAddress: string;
  chainId: number;
  decimals0: number;
  decimals1: number;
  price0Usd: number;
  price1Usd: number;
}): Promise<V3ReconstructedLiquidity | null> {
  try {
    const headerCalls = [
      { target: params.poolAddress, allowFailure: false, callData: v3PoolLiquidityInterface.encodeFunctionData('slot0', []) },
      { target: params.poolAddress, allowFailure: false, callData: v3PoolLiquidityInterface.encodeFunctionData('liquidity', []) },
      { target: params.poolAddress, allowFailure: false, callData: v3PoolLiquidityInterface.encodeFunctionData('tickSpacing', []) }
    ];
    const [slot0Call, liquidityCall, spacingCall] = await multicall3(params.chainId, headerCalls);
    if (!slot0Call?.success || !liquidityCall?.success || !spacingCall?.success) {
      return null;
    }

    const slot0 = v3PoolLiquidityInterface.decodeFunctionResult('slot0', slot0Call.returnData);
    const currentSqrtPriceX96 = slot0[0] as bigint;
    const currentTick = Number(slot0[1]);
    const currentLiquidity = v3PoolLiquidityInterface.decodeFunctionResult('liquidity', liquidityCall.returnData)[0] as bigint;
    const tickSpacing = Number(v3PoolLiquidityInterface.decodeFunctionResult('tickSpacing', spacingCall.returnData)[0]);
    if (currentSqrtPriceX96 <= 0n || currentLiquidity <= 0n || tickSpacing <= 0) {
      return null;
    }

    const initializedTicks = await readInitializedTicks(params.poolAddress, params.chainId, tickSpacing);
    if (initializedTicks.length === 0) {
      return null;
    }

    let amount0Raw = 0;
    let amount1Raw = 0;
    let intervalCount = 0;

    let upwardLiquidity = currentLiquidity;
    let previousSqrt = currentSqrtPriceX96;
    const aboveTicks = initializedTicks.filter((tick) => tick.tick > currentTick);
    for (const tick of aboveTicks) {
      const sqrtUpper = getSqrtRatioAtTick(tick.tick);
      if (sqrtUpper > previousSqrt && upwardLiquidity > 0n) {
        amount0Raw += amount0Delta(upwardLiquidity, previousSqrt, sqrtUpper);
        intervalCount += 1;
      }
      upwardLiquidity += tick.liquidityNet;
      previousSqrt = sqrtUpper;
    }

    let downwardLiquidity = currentLiquidity;
    let nextSqrt = currentSqrtPriceX96;
    const belowTicks = initializedTicks.filter((tick) => tick.tick <= currentTick).sort((a, b) => b.tick - a.tick);
    for (const tick of belowTicks) {
      const sqrtLower = getSqrtRatioAtTick(tick.tick);
      if (nextSqrt > sqrtLower && downwardLiquidity > 0n) {
        amount1Raw += amount1Delta(downwardLiquidity, sqrtLower, nextSqrt);
        intervalCount += 1;
      }
      downwardLiquidity -= tick.liquidityNet;
      nextSqrt = sqrtLower;
    }

    const amount0 = amount0Raw / Math.pow(10, params.decimals0);
    const amount1 = amount1Raw / Math.pow(10, params.decimals1);
    const totalValueLockedUsd = (amount0 * params.price0Usd) + (amount1 * params.price1Usd);

    return {
      totalValueLockedUsd,
      amount0,
      amount1,
      initializedTickCount: initializedTicks.length,
      intervalCount,
      tickSpacing,
      currentTick,
      reconstructed: totalValueLockedUsd > 0
    };
  } catch (error: any) {
    logger.warn(LogCode.API_FETCH_FAILED, 'Failed to reconstruct V3 pool liquidity from ticks', {
      pool: params.poolAddress,
      chainId: params.chainId,
      error: error?.message || String(error)
    });
    return null;
  }
}
