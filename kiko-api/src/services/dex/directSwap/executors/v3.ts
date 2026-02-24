import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import type { PoolInfo } from '../../poolInfo.js';
import type { DirectSwapExecutionMode, DirectSwapResult } from '../types.js';
import type { TxLifecycleResult } from '../../../txLifecycle.js';
import { isTxLifecycleSendAccepted } from '../../../txLifecycle.js';

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
  callRpc: <T>(
    chainId: number,
    method: string,
    params: any[],
    options?: { strategy?: 'fast' | 'cheap'; importance?: 'normal' | 'critical' }
  ) => Promise<T>;
  sendTransaction: (userId: string, accessToken: string, tx: any) => Promise<TxLifecycleResult>;
  getTxExecutionProfile: (chainId: number) => 'default' | 'base-sniper' | 'bsc-sniper';
  get0xExpectedOutput: (tokenIn: string, tokenOut: string, amountInWei: bigint, chainId: number) => Promise<bigint>;
}

const SWAP_ROUTER_02: Record<number, string> = {
  8453: '0x2626664c2603336E57B271c5C0b26F421741e481',
  1: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
  56: '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2'
};
const v3PoolFeeInterface = new ethers.Interface([
  'function fee() view returns (uint24)'
]);

function isTransientRpcFailure(message: string): boolean {
  const msg = String(message || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('all rpc endpoints failed')
    || msg.includes('capacity_limited')
    || msg.includes('circuit_open')
    || msg.includes('aborterror')
    || msg.includes('timeout')
    || msg.includes('fetch failed')
    || msg.includes('http 429')
    || msg.includes('rate limit')
  );
}

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
  const executionMode: DirectSwapExecutionMode = options?.executionMode || 'normal';
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
  if ((!pool.fee || pool.fee <= 0) && pool.poolAddress && /^0x[a-fA-F0-9]{40}$/.test(pool.poolAddress)) {
    try {
      const feeCallData = v3PoolFeeInterface.encodeFunctionData('fee', []);
      const feeResult = await deps.callRpc<string>(chainId, 'eth_call', [{
        to: pool.poolAddress,
        data: feeCallData
      }, 'latest'], {
        strategy: 'fast',
        importance: 'critical'
      });
      if (feeResult && feeResult !== '0x') {
        const decodedFee = Number(v3PoolFeeInterface.decodeFunctionResult('fee', feeResult)[0]);
        if (decodedFee > 0 && decodedFee <= 1_000_000) {
          bestFee = decodedFee;
          logger.info(LogCode.SYS_INFO, '[DirectSwap] V3 fee resolved from pool contract', {
            pool: pool.poolAddress.slice(0, 20),
            resolvedFee: decodedFee
          });
        }
      }
    } catch {
      // keep default fallback fee
    }
  }
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

  const buildSwapData = (fee: number): string => {
    const swapParams = dex === 'pancake'
      ? {
        tokenIn: normalizedIn,
        tokenOut: normalizedOut,
        fee,
        recipient: walletAddress,
        deadline,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0
      }
      : {
        tokenIn: normalizedIn,
        tokenOut: normalizedOut,
        fee,
        recipient: walletAddress,
        amountIn: amountInWei,
        amountOutMinimum: minAmountOut,
        sqrtPriceLimitX96: 0
      };
    return routerInterface.encodeFunctionData('exactInputSingle', [swapParams]);
  };

  let data = buildSwapData(bestFee);
  const isNativeIn = tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();

  let gasLimit = '450000';
  if (options?.fastMode) {
    try {
      const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
        from: walletAddress,
        to: routerAddress,
        data,
        value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
      }], {
        strategy: 'fast',
        importance: 'critical'
      });
      gasLimit = (BigInt(estimate) * 2n).toString();
    } catch (simErr: any) {
      const simErrMsg = simErr?.message || String(simErr);
      const transientRpcFailure = isTransientRpcFailure(simErrMsg);
      if (transientRpcFailure) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V3 pre-sim unavailable (RPC), aborting send', {
          pool: pool.poolAddress?.slice(0, 20),
          fee: bestFee,
          router: routerAddress?.slice(0, 12),
          executionMode,
          error: simErrMsg.slice(0, 150)
        });
        return {
          success: false,
          error: `v3_pre_sim_rpc_failed:${simErrMsg.slice(0, 100) || 'unknown'}`,
          provider: 'failed'
        };
      } else {
        // If hint fee is wrong/missing, probe a small fee set before giving up.
        const seenFees = new Set<number>();
        const fallbackFees = [
          bestFee,
          ...(pool.fee ? [pool.fee] : []),
          ...feeTiers
        ]
          .filter((fee) => Number.isFinite(Number(fee)) && Number(fee) > 0)
          .map((fee) => Number(fee))
          .filter((fee) => {
            if (seenFees.has(fee)) return false;
            seenFees.add(fee);
            return true;
          })
          .slice(0, 5);

        let recovered = false;
        for (const fee of fallbackFees) {
          if (fee === bestFee) continue;
          try {
            const candidateData = buildSwapData(fee);
            const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
              from: walletAddress,
              to: routerAddress,
              data: candidateData,
              value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
            }], {
              strategy: 'fast',
              importance: 'critical'
            });
            data = candidateData;
            bestFee = fee;
            gasLimit = (BigInt(estimate) * 2n).toString();
            recovered = true;
            logger.info(LogCode.SYS_INFO, '[DirectSwap] V3 fastMode recovered by fee fallback', {
              pool: pool.poolAddress?.slice(0, 20),
              recoveredFee: fee,
              gasLimit
            });
            break;
          } catch {
            // try next fee
          }
        }
        if (recovered) {
          // continue execution with recovered data/gas
        } else {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V3 fastMode pre-sim REVERTED - aborting send', {
          pool: pool.poolAddress?.slice(0, 20),
          fee: bestFee,
          router: routerAddress?.slice(0, 12),
          transientRpcFailure,
          error: simErrMsg.slice(0, 150)
        });
        return {
          success: false,
          error: `v3_pre_sim_revert:${simErrMsg.slice(0, 100) || 'unknown'}`,
          provider: 'failed'
        };
        }
      }
    }
  } else {
    try {
      const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
        from: walletAddress,
        to: routerAddress,
        data,
        value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
      }], {
        strategy: 'fast',
        importance: 'critical'
      });
      gasLimit = (BigInt(estimate) * 2n).toString();
    } catch (simErr: any) {
      if (executionMode === 'safe') {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V3 safe pre-sim failed', {
          pool: pool.poolAddress?.slice(0, 20),
          fee: bestFee,
          router: routerAddress?.slice(0, 12),
          error: simErr?.message?.slice(0, 150)
        });
        return {
          success: false,
          error: `V3 safe pre-sim failed: ${simErr?.message?.slice(0, 100) || 'unknown'}`,
          provider: 'failed'
        };
      }
      gasLimit = '450000';
    }
  }

  const txLifecycle = await deps.sendTransaction(userId, accessToken, {
    to: routerAddress,
    data,
    value: isNativeIn ? amountInWei.toString() : '0',
    chainId,
    txPurpose: 'trade',
    executionProfile: deps.getTxExecutionProfile(chainId),
    gas: gasLimit
  });
  const txHash = txLifecycle.txHash;
  if (!txHash || !isTxLifecycleSendAccepted(txLifecycle)) {
    return {
      success: false,
      error: `failed_to_send_transaction:${txLifecycle.lastRpcError || txLifecycle.status}`,
      provider: 'failed',
      txLifecycle
    };
  }

  logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] V3 swap executed', {
    txHash,
    pool: pool.poolAddress.slice(0, 20)
  });

  return {
    success: true,
    txHash,
    txLifecycle,
    provider: dex === 'pancake' ? 'pancake-v3' : 'uniswap-v3',
    poolInfo: {
      version: 'v3',
      fee: pool.fee || 3000,
      liquidity: pool.liquidity || '0'
    }
  };
}
