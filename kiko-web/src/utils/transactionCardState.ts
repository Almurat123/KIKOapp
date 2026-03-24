type TransactionCardStatus =
  | 'building'
  | 'approving'
  | 'sending'
  | 'pending'
  | 'retrying'
  | 'pending_verification'
  | 'success'
  | 'failed'
  | 'cancelled';

type TransactionCardData = Record<string, any> & {
  status?: TransactionCardStatus | string;
  txHash?: string;
  error?: string;
  errorMessage?: string;
  isLoading?: boolean;
  message?: string;
};

const STATUS_PRIORITY: Record<string, number> = {
  building: 10,
  approving: 20,
  sending: 30,
  pending: 40,
  retrying: 45,
  pending_verification: 50,
  failed: 60,
  cancelled: 65,
  success: 100,
};

function normalizeStatus(status: unknown): string {
  return String(status || '').trim().toLowerCase();
}

export function pickPreferredTransactionStatus(currentStatus: unknown, nextStatus: unknown): string {
  const current = normalizeStatus(currentStatus);
  const next = normalizeStatus(nextStatus);
  if (!next) return current;
  if (!current) return next;
  const currentPriority = STATUS_PRIORITY[current] ?? 0;
  const nextPriority = STATUS_PRIORITY[next] ?? 0;
  return nextPriority >= currentPriority ? next : current;
}

export function mergeTransactionCardData(currentData: TransactionCardData | null | undefined, patch: TransactionCardData | null | undefined): TransactionCardData {
  const current = currentData || {};
  const incoming = patch || {};
  const preferredStatus = pickPreferredTransactionStatus(current.status, incoming.status);
  const keepCurrentStatus = Boolean(current.status) && preferredStatus !== normalizeStatus(incoming.status);

  const merged: TransactionCardData = {
    ...current,
    ...incoming,
    status: preferredStatus || incoming.status || current.status,
  };

  if (keepCurrentStatus) {
    merged.status = current.status;
    merged.isLoading = current.isLoading;
    if (current.txHash || !incoming.txHash) merged.txHash = current.txHash;
    if ('error' in current || 'error' in incoming) merged.error = current.error;
    if ('errorMessage' in current || 'errorMessage' in incoming) merged.errorMessage = current.errorMessage;
    if ('message' in current || 'message' in incoming) merged.message = current.message ?? incoming.message;
  }

  if (normalizeStatus(merged.status) === 'success') {
    merged.isLoading = false;
    delete merged.error;
    delete merged.errorMessage;
  }

  if (normalizeStatus(merged.status) === 'failed' || normalizeStatus(merged.status) === 'cancelled') {
    merged.isLoading = false;
  }

  return merged;
}

export const __transactionCardStateTest = {
  pickPreferredTransactionStatus,
  mergeTransactionCardData,
};
