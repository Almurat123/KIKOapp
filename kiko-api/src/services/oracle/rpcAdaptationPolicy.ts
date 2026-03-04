import type { RpcFactResult } from './rpcFactResult.js';

export type RpcAdaptationDecision = 'accept' | 'retry_later' | 'quarantine';

export function resolveExitBalanceAdaptation(result: RpcFactResult<bigint>): RpcAdaptationDecision {
  if (result.status === 'success') return 'accept';
  if (result.status === 'uncertain') return 'retry_later';
  return 'quarantine';
}
