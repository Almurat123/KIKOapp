type ChainLimiterState = {
  inFlight: number;
  queue: Array<() => void>;
};

const CHAIN_SEND_CONCURRENCY_LIMIT = Math.max(1, Number(process.env.PRIVY_CHAIN_SEND_CONCURRENCY || '8'));
const chainSendLimiter = new Map<number, ChainLimiterState>();

function getChainLimiter(chainId: number): ChainLimiterState {
  let state = chainSendLimiter.get(chainId);
  if (!state) {
    state = { inFlight: 0, queue: [] };
    chainSendLimiter.set(chainId, state);
  }
  return state;
}

export async function withChainSendLimiter<T>(chainId: number, fn: () => Promise<T>): Promise<T> {
  const state = getChainLimiter(chainId);
  if (state.inFlight >= CHAIN_SEND_CONCURRENCY_LIMIT) {
    await new Promise<void>((resolve) => state.queue.push(resolve));
  }
  state.inFlight += 1;
  try {
    return await fn();
  } finally {
    state.inFlight = Math.max(0, state.inFlight - 1);
    const next = state.queue.shift();
    if (next) next();
  }
}

export function getChainSendLimiterSnapshot(chainId: number): {
  chainId: number;
  inFlight: number;
  queued: number;
  limit: number;
} {
  const state = getChainLimiter(chainId);
  return {
    chainId,
    inFlight: state.inFlight,
    queued: state.queue.length,
    limit: CHAIN_SEND_CONCURRENCY_LIMIT,
  };
}

export function __resetChainSendLimiterForTests(): void {
  chainSendLimiter.clear();
}

export async function __runChainSendLimitedTaskForTests<T>(chainId: number, fn: () => Promise<T>): Promise<T> {
  return await withChainSendLimiter(chainId, fn);
}
