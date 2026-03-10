type TransactionQueuePurpose = 'trade' | 'approval' | 'preheat' | 'speedup' | 'fee' | 'other';

export interface TransactionQueueMetadata {
  txPurpose?: TransactionQueuePurpose;
  txPriority?: number;
}

type UserTransactionQueueTask<T = any> = {
  priority: number;
  sequence: number;
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type UserTransactionQueueState = {
  running: boolean;
  sequence: number;
  queue: Array<UserTransactionQueueTask>;
};

const userTransactionQueues = new Map<string, UserTransactionQueueState>();
const userChainInflightTx = new Map<string, number>();

function buildUserChainKey(userId: string, chainId: number): string {
  return `${userId}:${chainId}`;
}

export function markUserChainInflight(userId: string, chainId: number, delta: 1 | -1): void {
  const key = buildUserChainKey(userId, chainId);
  const current = userChainInflightTx.get(key) || 0;
  const next = current + delta;
  if (next <= 0) {
    userChainInflightTx.delete(key);
    return;
  }
  userChainInflightTx.set(key, next);
}

export function isTransactionQueueBusy(userId: string, chainId: number): boolean {
  const queueKey = buildUserChainKey(userId, chainId);
  const queueState = userTransactionQueues.get(queueKey);
  return (userChainInflightTx.get(queueKey) || 0) > 0 || Boolean(queueState?.running) || Boolean(queueState?.queue.length);
}

export function resolveTransactionQueuePriority(tx?: TransactionQueueMetadata): number {
  if (Number.isFinite(Number(tx?.txPriority))) {
    return Number(tx?.txPriority);
  }
  switch (tx?.txPurpose || 'other') {
    case 'trade':
    case 'speedup':
      return 400;
    case 'approval':
      return 300;
    case 'fee':
      return 100;
    case 'preheat':
      return 50;
    default:
      return 0;
  }
}

function getUserTransactionQueueState(lockKey: string): UserTransactionQueueState {
  let state = userTransactionQueues.get(lockKey);
  if (!state) {
    state = {
      running: false,
      sequence: 0,
      queue: [],
    };
    userTransactionQueues.set(lockKey, state);
  }
  return state;
}

function drainUserTransactionQueue(lockKey: string): void {
  const state = userTransactionQueues.get(lockKey);
  if (!state || state.running) return;
  const next = state.queue.shift();
  if (!next) {
    userTransactionQueues.delete(lockKey);
    return;
  }
  state.running = true;
  void Promise.resolve()
    .then(() => next.fn())
    .then((value) => {
      next.resolve(value);
    })
    .catch((error) => {
      next.reject(error);
    })
    .finally(() => {
      const current = userTransactionQueues.get(lockKey);
      if (!current) return;
      current.running = false;
      if (current.queue.length === 0) {
        userTransactionQueues.delete(lockKey);
        return;
      }
      drainUserTransactionQueue(lockKey);
    });
}

export async function withUserTransactionLock<T>(params: {
  userId: string;
  chainId: number;
  tx?: TransactionQueueMetadata;
  fn: () => Promise<T>;
}): Promise<T> {
  const lockKey = buildUserChainKey(params.userId, params.chainId);
  const priority = resolveTransactionQueuePriority(params.tx);
  const state = getUserTransactionQueueState(lockKey);
  return await new Promise<T>((resolve, reject) => {
    state.queue.push({
      priority,
      sequence: state.sequence++,
      fn: params.fn,
      resolve,
      reject,
    });
    state.queue.sort((left, right) => {
      if (right.priority !== left.priority) return right.priority - left.priority;
      return left.sequence - right.sequence;
    });
    drainUserTransactionQueue(lockKey);
  });
}

export function __resetUserTransactionSchedulerForTests(): void {
  userTransactionQueues.clear();
  userChainInflightTx.clear();
}

export async function __runUserTransactionTaskForTests<T>(params: {
  userId: string;
  chainId: number;
  txPurpose?: TransactionQueuePurpose;
  txPriority?: number;
  fn: () => Promise<T>;
}): Promise<T> {
  return await withUserTransactionLock({
    userId: params.userId,
    chainId: params.chainId,
    tx: {
      txPurpose: params.txPurpose,
      txPriority: params.txPriority,
    },
    fn: params.fn,
  });
}
