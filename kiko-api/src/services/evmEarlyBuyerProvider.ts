import * as alchemy from './alchemy.js';
import * as rpcManager from './rpcManager.js';
import * as scanApi from './scanApi.js';

type EarlyBuyerProviderName = 'alchemy' | 'blockscout';

type ProviderOutcome = {
  provider: EarlyBuyerProviderName;
  transfers: alchemy.AssetTransfer[];
  durationMs: number;
  timedOut: boolean;
  error?: string;
};

type BlockRange = {
  fromBlock?: string;
  toBlock?: string;
};

type CacheEntry = {
  expiresAt: number;
  transfers: alchemy.AssetTransfer[];
  provider: EarlyBuyerProviderName | 'merged';
};

type ProviderDeps = {
  getAssetTransfers: typeof alchemy.getAssetTransfers;
  getEvmTokenTransfersByContract: typeof scanApi.getEvmTokenTransfersByContract;
  callRpc: typeof rpcManager.callRpc;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

const AVG_BLOCK_TIME_MS: Record<string, number> = {
  eth: 12_000,
  base: 2_000,
  bsc: 3_000,
  polygon: 2_000,
  arbitrum: 1_000,
  optimism: 2_000,
};

const QUERY_CACHE_TTL_MS = 30_000;
const ALCHEMY_HEADSTART_MS = 450;
const ALCHEMY_TIMEOUT_MS = 2_500;
const BLOCKSCOUT_TIMEOUT_MS = 3_500;
const RANGE_MARGIN_BLOCKS = 64;

const queryCache = new Map<string, CacheEntry>();
const defaultDeps: ProviderDeps = {
  getAssetTransfers: alchemy.getAssetTransfers,
  getEvmTokenTransfersByContract: scanApi.getEvmTokenTransfersByContract,
  callRpc: rpcManager.callRpc,
  now: () => Date.now(),
  sleep: delay,
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${timeoutMs}`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanupCache(now = Date.now()): void {
  for (const [key, entry] of queryCache.entries()) {
    if (entry.expiresAt <= now) queryCache.delete(key);
  }
}

function buildCacheKey(tokenAddress: string, chain: string, limit: number, startTimeMs?: number, endTimeMs?: number): string {
  return [
    chain.toLowerCase(),
    tokenAddress.toLowerCase(),
    String(limit),
    String(startTimeMs || 0),
    String(endTimeMs || 0),
  ].join(':');
}

function parseBlockNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = String(value);
  const parsed = normalized.startsWith('0x') ? parseInt(normalized, 16) : parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeBlockscoutTransfers(transfers: alchemy.WalletTransaction[]): alchemy.AssetTransfer[] {
  return transfers.map((tx) => ({
    blockNum: `0x${tx.blockNumber.toString(16)}`,
    hash: tx.txHash,
    from: tx.fromAddress,
    to: tx.toAddress,
    value: Number(tx.amount),
    asset: tx.tokenSymbol,
    category: 'erc20',
    rawContract: {
      value: null,
      address: tx.tokenAddress,
      decimal: null,
    },
    metadata: {
      blockTimestamp: tx.blockTimestamp.toISOString(),
    },
  }));
}

function dedupeTransfers(transfers: alchemy.AssetTransfer[]): alchemy.AssetTransfer[] {
  const byKey = new Map<string, alchemy.AssetTransfer>();
  for (const transfer of transfers) {
    const key = [
      String(transfer.hash || '').toLowerCase(),
      String(transfer.from || '').toLowerCase(),
      String(transfer.to || '').toLowerCase(),
      String(transfer.rawContract?.address || '').toLowerCase(),
      String(transfer.blockNum || '').toLowerCase(),
      String(transfer.value ?? ''),
    ].join(':');
    if (!byKey.has(key)) {
      byKey.set(key, transfer);
    }
  }

  return Array.from(byKey.values()).sort((a, b) => {
    const aBlock = parseBlockNumber(a.blockNum) || 0;
    const bBlock = parseBlockNumber(b.blockNum) || 0;
    if (aBlock !== bBlock) return aBlock - bBlock;
    const aTs = a.metadata?.blockTimestamp ? Date.parse(a.metadata.blockTimestamp) || 0 : 0;
    const bTs = b.metadata?.blockTimestamp ? Date.parse(b.metadata.blockTimestamp) || 0 : 0;
    return aTs - bTs;
  });
}

async function resolveApproximateBlockRange(
  chain: string,
  startTimeMs?: number,
  endTimeMs?: number,
  deps: ProviderDeps = defaultDeps
): Promise<BlockRange> {
  if (!startTimeMs && !endTimeMs) return {};

  const avgBlockTimeMs = AVG_BLOCK_TIME_MS[chain.toLowerCase()];
  if (!avgBlockTimeMs) return {};

  try {
    const latestBlock = await deps.callRpc<any>(chain.toLowerCase(), 'eth_getBlockByNumber', ['latest', false], {
      strategy: 'cheap',
    });
    const latestNumber = parseBlockNumber(String(latestBlock?.number || ''));
    const latestTimestampSec = latestBlock?.timestamp ? Number(BigInt(String(latestBlock.timestamp))) : null;
    if (!latestNumber || !latestTimestampSec) return {};

    const latestTimestampMs = latestTimestampSec * 1000;
    const estimateBlock = (targetTimeMs: number, round: 'floor' | 'ceil') => {
      const deltaMs = latestTimestampMs - targetTimeMs;
      const estimatedDeltaBlocks = Math.max(0, deltaMs / avgBlockTimeMs);
      const raw = latestNumber - (round === 'floor' ? Math.floor(estimatedDeltaBlocks) : Math.ceil(estimatedDeltaBlocks));
      return Math.max(0, raw);
    };

    const fromBlock = startTimeMs
      ? Math.max(0, estimateBlock(startTimeMs, 'ceil') - RANGE_MARGIN_BLOCKS)
      : undefined;
    const toBlock = endTimeMs
      ? Math.min(latestNumber, estimateBlock(endTimeMs, 'floor') + RANGE_MARGIN_BLOCKS)
      : latestNumber;

    return {
      fromBlock: typeof fromBlock === 'number' ? `0x${fromBlock.toString(16)}` : undefined,
      toBlock: typeof toBlock === 'number' ? `0x${toBlock.toString(16)}` : undefined,
    };
  } catch {
    return {};
  }
}

async function fetchFromAlchemy(
  tokenAddress: string,
  chain: string,
  limit: number,
  blockRange: BlockRange,
  deps: ProviderDeps = defaultDeps
): Promise<ProviderOutcome> {
  const start = deps.now();
  try {
    const transfers = await withTimeout(
      deps.getAssetTransfers(null, chain, {
        contractAddresses: [tokenAddress],
        category: ['erc20'],
        order: 'asc',
        maxCount: limit,
        source: 'early_buyers',
        fromBlock: blockRange.fromBlock,
        toBlock: blockRange.toBlock,
      }),
      ALCHEMY_TIMEOUT_MS
    );
    return {
      provider: 'alchemy',
      transfers: Array.isArray(transfers) ? transfers : [],
      durationMs: deps.now() - start,
      timedOut: false,
    };
  } catch (error: any) {
    return {
      provider: 'alchemy',
      transfers: [],
      durationMs: deps.now() - start,
      timedOut: String(error?.message || '').startsWith('timeout:'),
      error: error?.message || 'unknown_error',
    };
  }
}

async function fetchFromBlockscout(
  tokenAddress: string,
  chain: string,
  limit: number,
  blockRange: BlockRange,
  deps: ProviderDeps = defaultDeps
): Promise<ProviderOutcome> {
  const start = deps.now();
  try {
    const transfers = await withTimeout(
      deps.getEvmTokenTransfersByContract(tokenAddress, chain, 1, limit, {
        sort: 'asc',
        startblock: blockRange.fromBlock,
        endblock: blockRange.toBlock,
      }),
      BLOCKSCOUT_TIMEOUT_MS
    );
    return {
      provider: 'blockscout',
      transfers: normalizeBlockscoutTransfers(transfers),
      durationMs: deps.now() - start,
      timedOut: false,
    };
  } catch (error: any) {
    return {
      provider: 'blockscout',
      transfers: [],
      durationMs: deps.now() - start,
      timedOut: String(error?.message || '').startsWith('timeout:'),
      error: error?.message || 'unknown_error',
    };
  }
}

async function getEvmEarlyBuyerTransfersInternal(
  tokenAddress: string,
  chain: string,
  options: {
    limit: number;
    startTimeMs?: number;
    endTimeMs?: number;
  },
  deps: ProviderDeps = defaultDeps
): Promise<{
  transfers: alchemy.AssetTransfer[];
  provider: EarlyBuyerProviderName | 'merged';
  blockRange: BlockRange;
  diagnostics: ProviderOutcome[];
}> {
  cleanupCache(deps.now());

  const boundedLimit = Math.max(1, Math.min(options.limit, 500));
  const cacheKey = buildCacheKey(tokenAddress, chain, boundedLimit, options.startTimeMs, options.endTimeMs);
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expiresAt > deps.now()) {
    return {
      transfers: cached.transfers,
      provider: cached.provider,
      blockRange: {},
      diagnostics: [],
    };
  }

  const blockRange = await resolveApproximateBlockRange(chain, options.startTimeMs, options.endTimeMs, deps);
  const alchemyTask = fetchFromAlchemy(tokenAddress, chain, boundedLimit, blockRange, deps);
  const blockscoutTask = deps.sleep(ALCHEMY_HEADSTART_MS).then(() =>
    fetchFromBlockscout(tokenAddress, chain, boundedLimit, blockRange, deps)
  );

  const earlyAlchemy = await Promise.race<ProviderOutcome | null>([
    alchemyTask,
    deps.sleep(ALCHEMY_HEADSTART_MS).then(() => null),
  ]);

  if (earlyAlchemy && earlyAlchemy.transfers.length > 0) {
    queryCache.set(cacheKey, {
      expiresAt: deps.now() + QUERY_CACHE_TTL_MS,
      transfers: dedupeTransfers(earlyAlchemy.transfers),
      provider: 'alchemy',
    });
    return {
      transfers: dedupeTransfers(earlyAlchemy.transfers),
      provider: 'alchemy',
      blockRange,
      diagnostics: [earlyAlchemy],
    };
  }

  const [alchemyOutcome, blockscoutOutcome] = await Promise.all([alchemyTask, blockscoutTask]);
  const diagnostics = [alchemyOutcome, blockscoutOutcome];
  const successful = diagnostics.filter((item) => item.transfers.length > 0);

  if (successful.length === 0) {
    const fallbackProvider = alchemyOutcome.transfers.length >= blockscoutOutcome.transfers.length ? 'alchemy' : 'blockscout';
    const transfers = dedupeTransfers(
      fallbackProvider === 'alchemy' ? alchemyOutcome.transfers : blockscoutOutcome.transfers
    );
    queryCache.set(cacheKey, {
      expiresAt: deps.now() + QUERY_CACHE_TTL_MS,
      transfers,
      provider: fallbackProvider,
    });
    return { transfers, provider: fallbackProvider, blockRange, diagnostics };
  }

  const merged = dedupeTransfers(successful.flatMap((item) => item.transfers)).slice(0, boundedLimit);
  const provider: EarlyBuyerProviderName | 'merged' = successful.length > 1
    ? 'merged'
    : successful[0].provider;

  queryCache.set(cacheKey, {
    expiresAt: deps.now() + QUERY_CACHE_TTL_MS,
    transfers: merged,
    provider,
  });

  return {
    transfers: merged,
    provider,
    blockRange,
    diagnostics,
  };
}

export async function getEvmEarlyBuyerTransfers(
  tokenAddress: string,
  chain: string,
  options: {
    limit: number;
    startTimeMs?: number;
    endTimeMs?: number;
  }
) {
  return getEvmEarlyBuyerTransfersInternal(tokenAddress, chain, options, defaultDeps);
}

export function __clearEvmEarlyBuyerTransferCacheForTests(): void {
  queryCache.clear();
}

export const __testOnly = {
  getEvmEarlyBuyerTransfersInternal,
  resolveApproximateBlockRange,
};
