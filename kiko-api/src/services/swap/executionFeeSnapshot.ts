import { callRpc } from '../rpcManager.js';
import { withScopedCache } from '../rpc/cacheStore.js';
import { EXECUTION_FEE_PROFILE } from '../rpc/profile.js';

const EXECUTION_FEE_SNAPSHOT_TTL_MS = Math.max(
  100,
  Number(process.env.EXECUTION_FEE_SNAPSHOT_TTL_MS || '750')
);

export interface ExecutionFeeSnapshot {
  baseFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
  maxFeePerGas: bigint | null;
}

interface ExecutionFeeSnapshotDeps {
  callRpc: typeof callRpc;
  withScopedCache: typeof withScopedCache;
}

const defaultDeps: ExecutionFeeSnapshotDeps = {
  callRpc,
  withScopedCache,
};

function buildExecutionFeeSnapshotKey(chainId: number): string {
  return `swap-execution-fee:${chainId}`;
}

export async function getExecutionFeeSnapshot(
  chainId: number,
  deps: Partial<ExecutionFeeSnapshotDeps> = {}
): Promise<ExecutionFeeSnapshot> {
  const runtime = { ...defaultDeps, ...deps };
  return await runtime.withScopedCache({
    key: buildExecutionFeeSnapshotKey(chainId),
    ttlMs: EXECUTION_FEE_SNAPSHOT_TTL_MS,
    producer: async () => {
      const [blockResult, priorityResult] = await Promise.allSettled([
        runtime.callRpc<any>(chainId, 'eth_getBlockByNumber', ['latest', false], {
          strategy: EXECUTION_FEE_PROFILE.strategy,
          purpose: EXECUTION_FEE_PROFILE.purpose,
          importance: EXECUTION_FEE_PROFILE.importance,
          path: 'swap_execution_fee',
        }),
        runtime.callRpc<string>(chainId, 'eth_maxPriorityFeePerGas', [], {
          strategy: EXECUTION_FEE_PROFILE.strategy,
          purpose: EXECUTION_FEE_PROFILE.purpose,
          importance: EXECUTION_FEE_PROFILE.importance,
          path: 'swap_execution_fee',
        })
      ]);

      const baseFeePerGas = blockResult.status === 'fulfilled' && blockResult.value?.baseFeePerGas
        ? BigInt(blockResult.value.baseFeePerGas)
        : null;
      const maxPriorityFeePerGas = priorityResult.status === 'fulfilled' && priorityResult.value
        ? BigInt(priorityResult.value)
        : null;

      return {
        baseFeePerGas,
        maxPriorityFeePerGas,
        maxFeePerGas: baseFeePerGas && maxPriorityFeePerGas
          ? (baseFeePerGas * 2n + maxPriorityFeePerGas)
          : null
      };
    }
  });
}

export const __executionFeeSnapshotTest = {
  buildExecutionFeeSnapshotKey
};
