export type RpcFactStatus = 'success' | 'uncertain' | 'failed';

export interface RpcFactResult<T> {
  status: RpcFactStatus;
  value: T | null;
  reasonCode: string;
  attemptCount: number;
  lastError?: string | null;
  providerSource?: string | null;
}

export function createRpcFactSuccess<T>(
  value: T,
  reasonCode: string,
  attemptCount: number,
  providerSource?: string | null,
): RpcFactResult<T> {
  return {
    status: 'success',
    value,
    reasonCode,
    attemptCount,
    lastError: null,
    providerSource: providerSource || null,
  };
}

export function createRpcFactUncertain<T>(
  value: T | null,
  reasonCode: string,
  attemptCount: number,
  lastError?: string | null,
  providerSource?: string | null,
): RpcFactResult<T> {
  return {
    status: 'uncertain',
    value,
    reasonCode,
    attemptCount,
    lastError: lastError || null,
    providerSource: providerSource || null,
  };
}

export function createRpcFactFailure<T>(
  reasonCode: string,
  attemptCount: number,
  lastError?: string | null,
  providerSource?: string | null,
): RpcFactResult<T> {
  return {
    status: 'failed',
    value: null,
    reasonCode,
    attemptCount,
    lastError: lastError || null,
    providerSource: providerSource || null,
  };
}

export function isRpcFactSuccess<T>(result: RpcFactResult<T>): boolean {
  return result.status === 'success';
}
