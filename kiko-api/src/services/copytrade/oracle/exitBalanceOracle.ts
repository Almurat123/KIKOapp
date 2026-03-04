import { getErc20Balance } from '../../rpcManager.js';
import {
  createRpcFactFailure,
  createRpcFactSuccess,
  createRpcFactUncertain,
  type RpcFactResult,
} from '../../oracle/rpcFactResult.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type ExitBalanceOracleReasonCode =
  | 'EXIT_BALANCE_CONFIRMED_POSITIVE'
  | 'EXIT_BALANCE_CONFIRMED_ZERO'
  | 'EXIT_BALANCE_RPC_UNCERTAIN'
  | 'EXIT_BALANCE_RPC_FAILED';

export async function readExitBalanceOracle(params: {
  tokenAddress: string;
  walletAddress: string;
  chainId: number;
  isMirrorSell: boolean;
  attempts?: number;
  retryDelayMs?: number;
  balanceReader?: (tokenAddress: string, walletAddress: string, chainId: number) => Promise<bigint>;
}): Promise<RpcFactResult<bigint>> {
  const attempts = Math.max(1, Number(params.attempts ?? (params.isMirrorSell ? 6 : 2)));
  const retryDelayMs = Math.max(150, Number(params.retryDelayMs ?? (params.isMirrorSell ? 450 : 250)));
  const balanceReader = params.balanceReader ?? getErc20Balance;

  let sawFailure = false;
  let lastError: string | null = null;
  let successfulZeroReads = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const balance = await balanceReader(params.tokenAddress, params.walletAddress, params.chainId);
      if (balance > 0n) {
        return createRpcFactSuccess(balance, 'EXIT_BALANCE_CONFIRMED_POSITIVE', attempt, 'rpcManager:getErc20Balance');
      }
      successfulZeroReads += 1;
    } catch (error: any) {
      sawFailure = true;
      lastError = error?.message || String(error);
    }

    if (attempt < attempts) {
      await sleep(retryDelayMs);
    }
  }

  if (!sawFailure && successfulZeroReads === attempts) {
    return createRpcFactSuccess(0n, 'EXIT_BALANCE_CONFIRMED_ZERO', attempts, 'rpcManager:getErc20Balance');
  }

  if (successfulZeroReads > 0) {
    return createRpcFactUncertain(0n, 'EXIT_BALANCE_RPC_UNCERTAIN', attempts, lastError, 'rpcManager:getErc20Balance');
  }

  return createRpcFactFailure('EXIT_BALANCE_RPC_FAILED', attempts, lastError, 'rpcManager:getErc20Balance');
}
