import { ethers } from 'ethers';
import { logger } from '../../../../utils/logger.js';
import { LogCode } from '../../../../config/logRegistry.js';
import type { DirectSwapExecutionMode, DirectSwapResult } from '../types.js';
import type { TxLifecycleResult } from '../../../txLifecycle.js';
import { isTxLifecycleSendAccepted } from '../../../txLifecycle.js';
import type { OrderRuntimeContext } from '../../../order-runtime/types.js';
import { markOrderPrepared, recordOrderRoute } from '../../../order-runtime/context.js';
import { evaluateDirectSwapSendGuard } from '../pipeline/directSwapAttemptGuard.js';

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

type InfinityPoolKind = 'cl' | 'bin';

export interface InfinityPoolKey {
  currency0: string;
  currency1: string;
  hooks: string;
  poolManager: string;
  fee: number;
  parameters: string;
}

export interface InfinityBestQuote {
  amountOut: bigint;
  poolKey: InfinityPoolKey;
  zeroForOne: boolean;
  kind: InfinityPoolKind;
  fee: number;
  tickSpacing?: number;
  binStep?: number;
}

interface InfinityExecutorDeps {
  wethAddresses: Record<number, string>;
  pancakeInfinityRouter: string;
  infinityRouterInterface: ethers.Interface;
  callRpc: <T>(chainId: number, method: string, params: any[]) => Promise<T>;
  sendTransaction: (userId: string, accessToken: string, tx: any) => Promise<TxLifecycleResult>;
  getTxExecutionProfile: (chainId: number) => 'default' | 'base-sniper' | 'bsc-sniper';
}

const INFINITY_COMMANDS = {
  INFI_SWAP: 0x10,
  WRAP_ETH: 0x0b
};

const INFINITY_ACTIONS = {
  CL_SWAP_EXACT_IN_SINGLE: 0x06,
  BIN_SWAP_EXACT_IN_SINGLE: 0x1c,
  SETTLE_ALL: 0x0c,
  TAKE_ALL: 0x0f
};

const INFINITY_ACTION_CONSTANTS = {
  CONTRACT_BALANCE: 1n << 255n
};

const MAX_UINT256 = (1n << 256n) - 1n;

export async function executeInfinitySwap(
  params: ExecuteSwapParams,
  quote: InfinityBestQuote,
  deps: InfinityExecutorDeps,
  options?: { executionMode?: DirectSwapExecutionMode }
): Promise<DirectSwapResult> {
  const { userId, accessToken, walletAddress, chainId, slippageBps } = params;
  if (chainId !== 56) {
    return { success: false, error: 'Infinity only supported on BSC', provider: 'failed' };
  }

  const ETH_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  const weth = deps.wethAddresses[chainId];
  if (!weth) {
    return { success: false, error: 'WBNB not configured', provider: 'failed' };
  }

  const amountInWei = params.amountInWei;
  const isNativeIn = params.tokenIn.toLowerCase() === ETH_ADDRESS.toLowerCase();
  const isNativeOut = params.tokenOut.toLowerCase() === ETH_ADDRESS.toLowerCase();

  const normalizedIn = isNativeIn ? weth : params.tokenIn;
  const normalizedOut = isNativeOut ? weth : params.tokenOut;

  if (isNativeOut) {
    logger.warn(LogCode.SYS_INFO, '[DirectSwap] Infinity native-out not supported, using WBNB output', {
      tokenOut: params.tokenOut.slice(0, 10)
    });
  }

  const minAmountOut = quote.amountOut * BigInt(10000 - slippageBps) / 10000n;
  const deadline = Math.floor(Date.now() / 1000) + 300;

  const swapParams = quote.kind === 'cl'
    ? ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(tuple(address,address,address,address,uint24,bytes32),bool,uint128,uint128,bytes)'],
      [[
        [
          quote.poolKey.currency0,
          quote.poolKey.currency1,
          quote.poolKey.hooks,
          quote.poolKey.poolManager,
          quote.poolKey.fee,
          quote.poolKey.parameters
        ],
        quote.zeroForOne,
        amountInWei,
        minAmountOut,
        '0x'
      ]]
    )
    : ethers.AbiCoder.defaultAbiCoder().encode(
      ['tuple(tuple(address,address,address,address,uint24,bytes32),bool,uint128,uint128,bytes)'],
      [[
        [
          quote.poolKey.currency0,
          quote.poolKey.currency1,
          quote.poolKey.hooks,
          quote.poolKey.poolManager,
          quote.poolKey.fee,
          quote.poolKey.parameters
        ],
        quote.zeroForOne,
        amountInWei,
        minAmountOut,
        '0x'
      ]]
    );

  const actions: number[] = [];
  const paramsArray: string[] = [];

  actions.push(
    quote.kind === 'cl'
      ? INFINITY_ACTIONS.CL_SWAP_EXACT_IN_SINGLE
      : INFINITY_ACTIONS.BIN_SWAP_EXACT_IN_SINGLE
  );
  paramsArray.push(swapParams);

  actions.push(INFINITY_ACTIONS.SETTLE_ALL);
  paramsArray.push(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [normalizedIn, MAX_UINT256]
    )
  );
  actions.push(INFINITY_ACTIONS.TAKE_ALL);
  paramsArray.push(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [normalizedOut, 0]
    )
  );

  const actionsBytes = ethers.hexlify(Uint8Array.from(actions));
  const payload = ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes[]'], [actionsBytes, paramsArray]);

  let commands = ethers.solidityPacked(['uint8'], [INFINITY_COMMANDS.INFI_SWAP]);
  let inputs = [payload];

  if (isNativeIn) {
    const wrapParams = ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'uint256'],
      [deps.pancakeInfinityRouter, INFINITY_ACTION_CONSTANTS.CONTRACT_BALANCE]
    );
    commands = ethers.solidityPacked(['uint8', 'bytes'], [INFINITY_COMMANDS.WRAP_ETH, commands]);
    inputs = [wrapParams, ...inputs];
  }

  const data = deps.infinityRouterInterface.encodeFunctionData('execute', [commands, inputs, deadline]);
  const executionMode: DirectSwapExecutionMode = options?.executionMode || 'normal';

  try {
    await deps.callRpc<string>(chainId, 'eth_call', [{
      from: walletAddress,
      to: deps.pancakeInfinityRouter,
      data,
      value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
    }, 'latest']);
  } catch (err: any) {
    logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Infinity pre-simulation failed', {
      error: err?.message?.slice(0, 160)
    });
    if (executionMode !== 'turbo') {
      return { success: false, error: 'Infinity pre-simulation failed', provider: 'failed' };
    }
    logger.warn(LogCode.EXE_TX_REVERTED, '[DirectSwap] Infinity pre-simulation soft-fail in turbo mode', {
      error: err?.message?.slice(0, 160)
    });
  }

  let gasLimit: string;
  try {
    const estimate = await deps.callRpc<string>(chainId, 'eth_estimateGas', [{
      from: walletAddress,
      to: deps.pancakeInfinityRouter,
      data,
      value: isNativeIn ? ethers.toBeHex(amountInWei) : '0x0'
    }]);
    gasLimit = (BigInt(estimate) * 2n).toString();
  } catch {
    gasLimit = '900000';
  }

  if (params.runtimeContext) {
    recordOrderRoute(params.runtimeContext, {
      provider: 'pancake-infinity',
      poolKind: 'infinity',
      poolAddress: deps.pancakeInfinityRouter
    });
    markOrderPrepared(params.runtimeContext);
  }

  const sendGuard = evaluateDirectSwapSendGuard({
    runtimeContext: params.runtimeContext,
  });
  if (sendGuard.blocked) {
    return {
      success: false,
      error: `direct_swap_send_inflight:${sendGuard.reasonCode}`,
      provider: 'failed',
      runtimeContext: params.runtimeContext,
      txLifecycle: params.runtimeContext?.lastLifecycle,
    };
  }

  const txLifecycle = await deps.sendTransaction(userId, accessToken, {
    to: deps.pancakeInfinityRouter,
    data,
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

  return {
    success: true,
    txHash,
    amountOut: quote.amountOut.toString(),
    txLifecycle,
    runtimeContext: params.runtimeContext,
    provider: 'pancake-infinity',
    poolInfo: {
      version: quote.kind === 'cl' ? 'infinity-cl' : 'infinity-bin',
      fee: quote.fee,
      liquidity: '0'
    }
  };
}
