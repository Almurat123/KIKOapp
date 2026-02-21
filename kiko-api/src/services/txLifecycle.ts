export type TxLifecycleStatus =
  | 'pending_broadcast'
  | 'broadcasted_unseen'
  | 'visible_pending'
  | 'confirmed_success'
  | 'confirmed_failed'
  | 'dropped_timeout';

export interface TxLifecycleResult {
  status: TxLifecycleStatus;
  txHash?: string;
  firstSeenAt?: number;
  confirmedAt?: number;
  lastRpcError?: string;
  attempts: number;
  chainId: number;
}

export function isTxLifecycleTerminal(status: TxLifecycleStatus): boolean {
  return status === 'confirmed_success'
    || status === 'confirmed_failed'
    || status === 'dropped_timeout';
}

export function isTxLifecycleSendAccepted(result: TxLifecycleResult): boolean {
  return Boolean(result.txHash)
    && (
      result.status === 'broadcasted_unseen'
      || result.status === 'visible_pending'
      || result.status === 'confirmed_success'
    );
}

export function toTxLifecycleFailureMessage(result: TxLifecycleResult): string {
  const base = `tx_lifecycle_${result.status}`;
  if (!result.lastRpcError) return base;
  return `${base}:${result.lastRpcError}`;
}
