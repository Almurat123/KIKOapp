import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import { buildV4SwapTransaction } from '../../uniswapV4Swap.js';
import { buildV4ExecutionPlan, type SelectedV4Pool } from '../../v4ExecutionPlan.js';
import type { DirectSwapExecutionMode, DirectSwapResult } from '../types.js';
import type { TxLifecycleResult } from '../../../txLifecycle.js';
import { isTxLifecycleSendAccepted } from '../../../txLifecycle.js';
import type { OrderRuntimeContext } from '../../../order-runtime/types.js';
import { markOrderPrepared, recordOrderRoute, setOrderMetadata } from '../../../order-runtime/context.js';

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
  runtimeContext?: OrderRuntimeContext;
}

interface RpcErrorSummary {
  reason: string | null;
  code?: string;
  shortMessage: string;
  dataPreview?: string;
}

interface V4ExecutorDeps {
  callRpc: <T>(chainId: number, method: string, params: any[], options?: any) => Promise<T>;
  sendTransaction: (userId: string, accessToken: string, tx: any) => Promise<TxLifecycleResult>;
  callV4QuoterExactOut: (
    poolKey: any,
    zeroForOne: boolean,
    amountInWei: bigint,
    chainId: number,
    recipient?: string,
    gasPriceWei?: bigint,
    hookDataCandidates?: string[]
  ) => Promise<bigint>;
  getV4BestPoolQuote: (
    tokenIn: string,
    tokenOut: string,
    amountInWei: bigint,
    chainId: number,
    recipient?: string
  ) => Promise<{ pool: SelectedV4Pool | null; amountOut: bigint }>;
  summarizeRpcError: (err: any) => RpcErrorSummary;
  isTransientRpcFailureForPreSim: (summary: RpcErrorSummary) => boolean;
  getTxExecutionProfile: (chainId: number) => 'default' | 'base-sniper' | 'bsc-sniper';
  v4GasCacheKey: (chainId: number, poolId: string, tokenIn: string, tokenOut: string) => string;
  getCachedV4GasLimit: (key: string) => string | null;
  setCachedV4GasLimit: (key: string, gasLimit: string) => void;
  turboV4GasLimit: string;
}

export async function executeV4Swap(
  params: ExecuteSwapParams,
  pool: SelectedV4Pool,
  deps: V4ExecutorDeps,
  options?: {
    allowZeroQuoteMinOut?: boolean;
    fastMode?: boolean;
    executionMode?: DirectSwapExecutionMode;
    trustedHint?: boolean;
  }
): Promise<DirectSwapResult> {
  const { userId, accessToken, tokenIn, tokenOut, chainId, slippageBps } = params;
  const trustedHint = options?.trustedHint === true;
  const extraNativeAliases = chainId === 8453
    ? new Set(['0x000000000d564d5be76f7f0d28fe52605afc7cf8'])
    : new Set<string>();
  const normalizePairToken = (token: string): string => {
    const value = String(token || '').toLowerCase();
    if (
      value === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      || value === '0x0000000000000000000000000000000000000000'
      || extraNativeAliases.has(value)
    ) {
      if (chainId === 8453) return '0x4200000000000000000000000000000000000006';
      if (chainId === 1) return '0xc02aa39b223fe8d0a0e5c4f27ead9083c756cc2';
      if (chainId === 56) return '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c';
    }
    return value;
  };
  const plan = buildV4ExecutionPlan({
    tokenIn,
    tokenOut,
    chainId,
    walletAddress: params.walletAddress,
    pool
  });
  const { isNativeIn, isNativeOut, normalizedIn, normalizedOut, zeroForOne, hookDataCandidates, hookFamily, poolKey, poolId } = plan;
  const poolToken0 = normalizePairToken(poolKey.currency0);
  const poolToken1 = normalizePairToken(poolKey.currency1);
  const inToken = normalizePairToken(normalizedIn);
  const outToken = normalizePairToken(normalizedOut);
  const pairMatches =
    (poolToken0 === inToken && poolToken1 === outToken)
    || (poolToken0 === outToken && poolToken1 === inToken);
  if (!pairMatches) {
    if (!trustedHint) {
      logger.warn(LogCode.SYS_INFO, '[DirectSwap] Reject V4 pool: swap pair mismatch', {
        chainId,
        poolId,
        tokenIn: normalizedIn,
        tokenOut: normalizedOut,
        poolToken0: poolKey.currency0,
        poolToken1: poolKey.currency1
      });
      return { success: false, error: 'hint_pool_pair_mismatch:execution_plan', provider: 'failed' };
    }
    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Pair mismatch bypassed for trusted hint; will rely on pre-sim', {
      chainId,
      poolId,
      tokenIn: normalizedIn,
      tokenOut: normalizedOut,
      poolToken0: poolKey.currency0,
      poolToken1: poolKey.currency1
    });
  }

  logger.info(LogCode.SYS_INFO, '[DirectSwap] Using V4 pool', {
    chainId,
    poolId,
    hook: poolKey.hooks,
    hookFamily,
    hookCandidates: hookDataCandidates.length,
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    currency0: poolKey.currency0,
    currency1: poolKey.currency1
  });

  const amountInWei = params.amountInWei;
  const fastMode = options?.fastMode === true;
  const executionMode: DirectSwapExecutionMode = options?.executionMode || 'normal';
  let quoterOutWei = 0n;
  let selectedHookData = hookDataCandidates[0] || '0x';

  let gasPriceWei: bigint | undefined;
  if (!fastMode) {
    try {
      const gasPriceHex = await deps.callRpc<string>(chainId, 'eth_gasPrice', [], {
        strategy: 'fast',
        importance: 'critical'
      });
      gasPriceWei = gasPriceHex ? BigInt(gasPriceHex) : undefined;
    } catch {
      gasPriceWei = undefined;
    }
  }

  if (!fastMode) {
    let bestOut = 0n;
    let bestHookData = selectedHookData;
    for (const hookData of hookDataCandidates) {
      const quote = await deps.callV4QuoterExactOut(
        poolKey,
        zeroForOne,
        amountInWei,
        chainId,
        params.walletAddress,
        gasPriceWei,
        [hookData]
      );
      if (quote > bestOut) {
        bestOut = quote;
        bestHookData = hookData;
      }
    }
    quoterOutWei = bestOut;
    selectedHookData = bestHookData;
  }

  let baseOutWei = quoterOutWei;
  if (!fastMode && baseOutWei <= 0n) {
    const fallbackBest = await deps.getV4BestPoolQuote(normalizedIn!, normalizedOut!, amountInWei, chainId, params.walletAddress);
    baseOutWei = fallbackBest.amountOut;
  }

  const allowZeroQuoteMinOut = options?.allowZeroQuoteMinOut === true || fastMode;
  if (baseOutWei <= 0n && !allowZeroQuoteMinOut) {
    return { success: false, error: 'V4 spot price unavailable', provider: 'failed' };
  }

  const minAmountOut = baseOutWei > 0n
    ? baseOutWei * BigInt(10000 - slippageBps) / BigInt(10000)
    : 0n;

  logger.info(LogCode.EXE_QUOTE_FETCHED, '[DirectSwap] V4 minAmountOut calculated', {
    quoterOut: quoterOutWei.toString().slice(0, 15),
    minAmountOut: minAmountOut.toString().slice(0, 15),
    selectedHookData: selectedHookData.slice(0, 10),
    slippageBps,
    allowZeroQuoteMinOut
  });

  const deadline = Math.floor(Date.now() / 1000) + 300;
  const buildTx = (hookData: string) => buildV4SwapTransaction(
    chainId,
    poolKey,
    zeroForOne,
    amountInWei,
    minAmountOut,
    params.walletAddress,
    deadline,
    isNativeIn,
    isNativeOut,
    hookData,
    {
      usePathSwap: hookFamily === 'flaunch',
      appendSweepOut: hookFamily === 'flaunch'
    }
  );
  let tx = buildTx(selectedHookData);

  const turboTrustedFastPath = executionMode === 'turbo' && trustedHint;
  // Always run pre-simulation — even in fastMode. One eth_call (~50ms) prevents
  // sending transactions that WILL revert (burning gas + wasting retry attempts).
  {
    try {
      await deps.callRpc<string>(chainId, 'eth_call', [{
        from: params.walletAddress,
        to: tx.to,
        data: tx.data,
        value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
      }, 'latest'], {
        strategy: 'fast',
        importance: 'critical'
      });
    } catch (err: any) {
      const errSummary = deps.summarizeRpcError(err);
      const reason = errSummary.reason;
      let recoveredByCandidate = false;
      if (hookDataCandidates.length > 1) {
        for (const candidate of hookDataCandidates) {
          if (candidate === selectedHookData) continue;
          try {
            const candidateTx = buildTx(candidate);
            await deps.callRpc<string>(chainId, 'eth_call', [{
              from: params.walletAddress,
              to: candidateTx.to,
              data: candidateTx.data,
              value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
            }, 'latest'], {
              strategy: 'fast',
              importance: 'critical'
            });
            selectedHookData = candidate;
            tx = candidateTx;
            recoveredByCandidate = true;
            logger.info(LogCode.SYS_INFO, '[DirectSwap] V4 hook candidate fallback accepted', {
              chainId,
              poolId,
              hook: poolKey.hooks,
              hookFamily,
              selectedHookData: selectedHookData.slice(0, 10)
            });
            break;
          } catch {
            // try next hookData candidate
          }
        }
      }
      if (recoveredByCandidate) {
        // continue execution
      } else if (reason && (reason.toLowerCase().includes('not open') || reason.toLowerCase().includes('chill bro'))) {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 clanker gate', {
          reason,
          wallet: params.walletAddress,
          hook: poolKey.hooks,
          poolId,
          tokenIn: normalizedIn,
          tokenOut: normalizedOut
        });
        return { success: false, error: `clanker_gate:${reason}`, provider: 'uniswap-v4' };
      } else {
        logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 pre-simulation failed', {
          error: errSummary.shortMessage,
          errorCode: errSummary.code,
          revertReason: reason,
          errorData: errSummary.dataPreview,
          transientRpcFailure: deps.isTransientRpcFailureForPreSim(errSummary),
          turboTrustedHint: turboTrustedFastPath,
          hookFamily,
          poolId,
          hook: poolKey.hooks,
          minAmountOut: minAmountOut.toString(),
          amountInWei: amountInWei.toString(),
          isNativeIn,
          isNativeOut
        });
        if (deps.isTransientRpcFailureForPreSim(errSummary)) {
          logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] V4 pre-simulation transient RPC failure - aborting send', {
            poolId,
            hook: poolKey.hooks,
            tokenIn: normalizedIn,
            tokenOut: normalizedOut,
            error: errSummary.shortMessage,
            errorCode: errSummary.code
          });
          return { success: false, error: `v4_pre_sim_rpc_failed:${reason || errSummary.shortMessage}`, provider: 'failed' };
        } else {
          const reasonLower = (reason || '').toLowerCase();
          if (
            reasonLower.includes('transfer_failed')
            || reasonLower.includes('insufficient amountout')
            || reasonLower.includes('safe transfer')
          ) {
            return { success: false, error: `v4_pre_sim_revert:${reason || errSummary.shortMessage}`, provider: 'uniswap-v4' };
          }
          const hookFailurePrefix = hookFamily === 'unknown' ? 'unsupported_hook' : 'hook_candidate_failed';
          return { success: false, error: `${hookFailurePrefix}:${reason || 'pre_sim_failed'}`, provider: 'failed' };
        }
      }
    }
  }

  let gasLimit: string;
  const gasCacheKey = deps.v4GasCacheKey(chainId, poolId, normalizedIn!, normalizedOut!);
  const cachedGasLimit = deps.getCachedV4GasLimit(gasCacheKey);
  if (fastMode) {
    try {
      const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
        from: params.walletAddress,
        to: tx.to,
        data: tx.data,
        value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
      }]);
      gasLimit = (BigInt(estimate) * 2n).toString();
    } catch {
      gasLimit = cachedGasLimit || deps.turboV4GasLimit;
    }
  } else {
    if (turboTrustedFastPath && cachedGasLimit) {
      gasLimit = cachedGasLimit;
      logger.info(LogCode.SYS_INFO, '[DirectSwap] Using cached V4 gas limit (turbo trusted hint)', {
        chainId,
        poolId,
        gasLimit
      });
    } else if (turboTrustedFastPath) {
      gasLimit = deps.turboV4GasLimit;
    } else {
      try {
        const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
          from: params.walletAddress,
          to: tx.to,
          data: tx.data,
          value: isNativeIn ? ethers.toQuantity(amountInWei) : '0x0'
        }]);

        const estimatedGas = BigInt(estimate);
        const buffered = estimatedGas * 2n;
        gasLimit = buffered.toString();
        deps.setCachedV4GasLimit(gasCacheKey, gasLimit);

        logger.info(LogCode.API_FETCH_SUCCESS, '[DirectSwap] V4 gas estimated', {
          estimatedGas: estimatedGas.toString(),
          gasLimit
        });
      } catch (err: any) {
        const V4_GAS_FALLBACK = 900000;
        gasLimit = V4_GAS_FALLBACK.toString();
        logger.warn(LogCode.API_FETCH_FAILED, '[DirectSwap] V4 gas estimate failed, using fallback', {
          error: err?.message?.slice(0, 120),
          gasLimit
        });
      }
    }
  }

  if (params.runtimeContext) {
    recordOrderRoute(params.runtimeContext, {
      provider: 'uniswap-v4',
      poolKind: 'v4',
      poolAddress: pool.poolAddress
    });
    markOrderPrepared(params.runtimeContext);
    setOrderMetadata(params.runtimeContext, {
      selectedHookFamily: hookFamily,
      selectedHookData: selectedHookData.slice(0, 18)
    });
  }

  const txLifecycle = await deps.sendTransaction(userId, accessToken, {
    to: tx.to,
    data: tx.data,
    value: isNativeIn ? amountInWei.toString() : '0',
    chainId,
    txPurpose: 'trade',
    executionProfile: deps.getTxExecutionProfile(chainId),
    gas: gasLimit,
    runtimeContext: params.runtimeContext
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

  logger.info(LogCode.EXE_TX_CONFIRMED, '[DirectSwap] V4 swap executed', {
    txHash,
    poolId: poolId.slice(0, 20),
    hookFamily,
    selectedHookData: selectedHookData.slice(0, 10)
  });

  return {
    success: true,
    txHash,
    amountOut: baseOutWei.toString(),
    txLifecycle,
    runtimeContext: params.runtimeContext,
    provider: 'uniswap-v4',
    poolInfo: {
      version: 'v4',
      fee: pool.fee || 0,
      liquidity: pool.liquidity
    }
  };
}
