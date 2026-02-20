import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { DirectSwapExecutionMode, DirectSwapResult } from '../types.js';

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

interface V3ExecutorDeps {
  wethAddresses: Record<number, string>;
  pancakeV3Router: string;
  pancakeV3Quoter: string;
  pancakeV3FeeTiers: readonly number[];
  v3QuoterByChain: Record<number, string>;
  v3FeeTiers: readonly number[];
  v3QuoterInterface: ethers.Interface;
  turboV3GasLimit: string;
  callRpc: <T>(chainId: number, method: string, params: any[]) => Promise<T>;
  sendTransaction: (userId: string, accessToken: string, tx: any) => Promise<string>;
  getTxExecutionProfile: (chainId: number) => 'default' | 'base-sniper' | 'bsc-sniper';
  get0xExpectedOutput: (tokenIn: string, tokenOut: string, amountInWei: bigint, chainId: number) => Promise<bigint>;
}

const SWAP_ROUTER_02: Record<number, string> = {
  8453: '0x2626664c2603336E57B271c5C0b26F421741e481',
  1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  56: '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2'
};

export async function executeV3Swap(
  params: ExecuteSwapParams,
  pool: PoolInfo,
  dex: 'uniswap' | 'pancake',
  deps: V3ExecutorDeps,
  options?: { fastMode?: boolean; executionMode?: DirectSwapExecutionMode }
): Promise<DirectSwapResult> {
  const { userId, accessToken, walletAddress, tokenIn, tokenOut, chainId, slippageBps } = params;
  const routerAddress = dex === 'pancake' ? deps.pancakeV3Router : SWAP_ROUTER_02[chainId];
  if (!routerAddress) {
    return { success: false, error: 'V3 router not available', provider: 'failed' };
  }

  const amountInWei = params.amountInWei;
  const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const normalizedIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase()
    ? deps.wethAddresses[chainId]
    : tokenIn;
  const normalizedOut = tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase()
    ? deps.wethAddresses[chainId]
    : tokenOut;

  let quoterOut = 0n;
  let bestFee = pool.fee || 3000;
  const quoterAddress = dex === 'pancake' ? deps.pancakeV3Quoter : deps.v3QuoterByChain[chainId];
  const feeTiers = dex === 'pancake' ? deps.pancakeV3FeeTiers : deps.v3FeeTiers;
  if (quoterAddress && !options?.fastMode) {
    try {
      for (const fee of feeTiers) {
        try {
          const quoteParams = {
            tokenIn: normalizedIn,
            tokenOut: normalizedOut,
            amountIn: amountInWei,
            fee,
            sqrtPriceLimitX96: 0
          };
          const callData = deps.v3QuoterInterface.encodeFunctionData('quoteExactInputSingle', [quoteParams]);
          const result = await deps.callRpc<string>(chainId, 'eth_call', [{
            to: quoterAddress,
            data: callData
          }, 'latest']);
          if (!result || result === '0x') continue;
          const decoded = deps.v3QuoterInterface.decodeFunctionResult('quoteExactInputSingle', result);
          const amountOut = decoded[0] as bigint;
          if (amountOut > quoterOut) {
            quoterOut = amountOut;
            bestFee = fee;
          }
        } catch {
          continue;
        }
      }
    } catch (err: any) {
      logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] V3 quoter failed', {
        error: err?.message?.slice(0, 120)
      });
    }
  }

  const expectedOut0x = options?.fastMode
    ? 0n
    : await deps.get0xExpectedOutput(normalizedIn!, normalizedOut!, amountInWei, chainId);

  const MAX_V3_QUOTE_DEVIATION_BPS = 2000;
  if (quoterOut > 0n && expectedOut0x > 0n) {
    const maxAllowed = quoterOut * BigInt(10000 + MAX_V3_QUOTE_DEVIATION_BPS) / BigInt(10000);
    if (expectedOut0x > maxAllowed) {
      logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] 0x quote deviates from quoter; using quoter', {
        quoterOut: quoterOut.toString().slice(0, 15),
        expectedOut0x: expectedOut0x.toString().slice(0, 15)
      });
    }
  }

  let baseOut = 0n;
  if (quoterOut > 0n && expectedOut0x > 0n) {
    baseOut = quoterOut < expectedOut0x ? quoterOut : expectedOut0x;
  } else {
    baseOut = quoterOut > 0n ? quoterOut : expectedOut0x;
  }

  const minAmountOut = baseOut > 0n
    ? baseOut * BigInt(10000 - slippageBps) / BigInt(10000)
    : 0n;

  logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V3 minAmountOut calculated', {
    expectedOut: expectedOut0x.toString().slice(0, 15),
    quoterOut: quoterOut.toString().slice(0, 15),
    bestFee,
    minAmountOut: minAmountOut.toString().slice(0, 15),
    slippageBps
  });

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const routerInterface = new ethers.Interface(
    dex === 'pancake'
      ? [
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
      ]
      : [
        'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)'
      ]
  );

  const swapParams = dex === 'pancake'
    ? {
      tokenIn: normalizedIn,
      tokenOut: normalizedOut,
      fee: bestFee,
      recipient: walletAddress,
      deadline,
      amountIn: amountInWei,
      amountOutMinimum: minAmountOut,
      sqrtPriceLimitX96: 0
    }
    : {
      tokenIn: normalizedIn,
      tokenOut: normalizedOut,
      fee: bestFee,
      recipient: walletAddress,
      amountIn: amountInWei,
      amountOutMinimum: minAmountOut,
      sqrtPriceLimitX96: 0
    };

  const data = routerInterface.encodeFunctionData('exactInputSingle', [swapParams]);
  const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();

  let gasLimit = '450000';
  if (options?.fastMode) {
    try {
      const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
        from: walletAddress,
        to: routerAddress,
        data,
        value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
      }]);
      gasLimit = (BigInt(estimate) * 2n).toString();
    } catch (simErr: any) {
      logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V3 fastMode pre-sim REVERTED — aborting send', {
        pool: pool.poolAddress?.slice(0, 20),
        fee: bestFee,
        router: routerAddress?.slice(0, 12),
        error: simErr?.message?.slice(0, 150)
      });
      return {
        success: false,
        error: `V3 pre-sim reverted: ${simErr?.message?.slice(0, 100) || 'unknown'}`,
        provider: 'failed'
      };
    }
  } else {
    try {
      const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
        from: walletAddress,
        to: routerAddress,
        data,
        value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
      }]);
      gasLimit = (BigInt(estimate) * 2n).toString();
    } catch {
      gasLimit = '450000';
    }
  }

  const txHash = await deps.sendTransaction(userId, accessToken, {
    to: routerAddress,
    data,
    value: isNativeIn ? amountInWei.toString() : '0',
    chainId,
    txPurpose: 'trade',
    executionProfile: deps.getTxExecutionProfile(chainId),
    gas: gasLimit
  });

  logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] V3 swap executed', {
    txHash,
    pool: pool.poolAddress.slice(0, 20)
  });

  return {
    success: true,
    txHash,
    provider: dex === 'pancake' ? 'pancake-v3' : 'uniswap-v3',
    poolInfo: {
      version: 'v3',
      fee: pool.fee || 3000,
      liquidity: pool.liquidity || '0'
    }
  };
}
