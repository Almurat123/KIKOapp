import fs from 'node:fs';
import path from 'node:path';
import { getTrendingTokens } from '../services/geckoTerminal.js';
import { getTrendingTokensByChain } from '../services/dexscreener.js';
import { callGeckoTerminal } from '../config/unifiedApiService.js';
import { callRpcCustom } from '../services/rpcManager.js';
import { getVerifiedFreeEndpoints, RpcEndpointConfig } from '../config/apiEndpoints.js';

interface PoolCandidate {
  tokenAddress: string;
  poolAddress: string;
  poolCreatedAt: string;
  discoverySource: Set<'gecko' | 'dexscreener'>;
}

type Bucket = 'new' | 'old';

interface SampleRow {
  chainId: 8453 | 56;
  network: 'base' | 'bsc';
  bucket: Bucket;
  txHash: string;
  tokenAddress: string;
  poolAddress: string;
  poolCreatedAt: string;
  discoverySource: string[];
  txSource: 'gecko_trades' | 'free_rpc' | 'etherscan_v2' | 'mixed';
  collectedAt: string;
  fallbackUsed: boolean;
  tradeKind?: string;
  blockTimestamp?: string | null;
}

const CHAINS = [
  { chainId: 8453 as const, network: 'base' as const, etherscanChainId: '8453' },
  { chainId: 56 as const, network: 'bsc' as const, etherscanChainId: '56' }
];

const TARGET_TOTAL = Number(process.env.TARGET_TOTAL || '10000');
const TARGET_PER_CHAIN = Math.floor(TARGET_TOTAL / 2);
const TARGET_PER_BUCKET = Math.floor(TARGET_PER_CHAIN / 2);
const TOKEN_LIMIT_PER_FEED = Number(process.env.TOKEN_LIMIT_PER_FEED || '450');
const MAX_PAGES = Number(process.env.MAX_PAGES || '12');
const MIN_LIQUIDITY_USD = Number(process.env.MIN_LIQUIDITY_USD || '1200');
const RPC_LOOKBACK_BLOCKS = Number(process.env.RPC_LOOKBACK_BLOCKS || '1500');
const EXPLORER_LIMIT = Number(process.env.EXPLORER_LIMIT || '80');
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.resolve(process.cwd(), '../test/samples-10k-base-bsc.json');
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const RPC_MAX_LOG_RANGE = Number(process.env.RPC_MAX_LOG_RANGE || '500');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function asIso(v: any): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normAddr(v: string | undefined): string {
  return String(v || '').toLowerCase();
}

async function geckoTrades(network: 'base' | 'bsc', poolAddress: string) {
  const out: Array<{ txHash: string; kind: string; blockTimestamp?: string }> = [];
  try {
    const data = await callGeckoTerminal(`/networks/${network}/pools/${poolAddress}/trades`);
    const rows = Array.isArray((data as any)?.data) ? (data as any).data : [];
    for (const r of rows) {
      const txHash = String(r?.attributes?.tx_hash || '').toLowerCase();
      if (!txHash.startsWith('0x')) continue;
      out.push({
        txHash,
        kind: String(r?.attributes?.kind || '').toLowerCase(),
        blockTimestamp: r?.attributes?.block_timestamp
      });
    }
  } catch {}
  return out;
}

async function rpcTransferTxs(network: 'base' | 'bsc', tokenAddress: string, maxNeeded: number): Promise<string[]> {
  const providers = getVerifiedFreeEndpoints(network);
  if (!providers.length) return [];
  const endpoints: RpcEndpointConfig[] = providers.map((p, i) => ({
    name: p.name,
    url: p.url,
    priority: i + 1,
    requiresAuth: false,
    type: 'public'
  }));

  try {
    const latestHex = await callRpcCustom<string>(endpoints, 'eth_blockNumber', [], { importance: 'normal' });
    const latest = parseInt(String(latestHex || '0x0'), 16);
    if (!Number.isFinite(latest) || latest <= 0) return [];

    const from = Math.max(0, latest - RPC_LOOKBACK_BLOCKS);
    const set = new Set<string>();
    let cursor = from;
    while (cursor <= latest && set.size < maxNeeded) {
      const end = Math.min(latest, cursor + RPC_MAX_LOG_RANGE - 1);
      const logs = await callRpcCustom<any[]>(endpoints, 'eth_getLogs', [{
        address: tokenAddress,
        fromBlock: `0x${cursor.toString(16)}`,
        toBlock: `0x${end.toString(16)}`,
        topics: [TRANSFER_TOPIC]
      }], { importance: 'normal' }).catch(() => []);

      for (const l of Array.isArray(logs) ? logs : []) {
        const h = String(l?.transactionHash || '').toLowerCase();
        if (h.startsWith('0x')) set.add(h);
        if (set.size >= maxNeeded) break;
      }
      cursor = end + 1;
    }
    return [...set];
  } catch {
    return [];
  }
}

async function explorerPoolTxs(etherscanChainId: string, poolAddress: string, maxNeeded: number): Promise<string[]> {
  if (!ETHERSCAN_API_KEY || !poolAddress.startsWith('0x') || poolAddress.length !== 42) return [];
  try {
    const q = new URLSearchParams({
      chainid: etherscanChainId,
      module: 'account',
      action: 'txlist',
      address: poolAddress,
      startblock: '0',
      endblock: '99999999',
      page: '1',
      offset: String(Math.max(maxNeeded, EXPLORER_LIMIT)),
      sort: 'desc',
      apikey: ETHERSCAN_API_KEY
    });
    const url = `https://api.etherscan.io/v2/api?${q.toString()}`;
    const res = await fetch(url);
    const json: any = await res.json();
    const rows = Array.isArray(json?.result) ? json.result : [];
    const set = new Set<string>();
    for (const r of rows) {
      const h = String(r?.hash || '').toLowerCase();
      if (h.startsWith('0x')) set.add(h);
      if (set.size >= maxNeeded) break;
    }
    return [...set];
  } catch {
    return [];
  }
}

async function poolUniverse(network: 'base' | 'bsc') {
  const gecko = [
    ...await getTrendingTokens(network, TOKEN_LIMIT_PER_FEED, '5m', MIN_LIQUIDITY_USD, MAX_PAGES),
    ...await getTrendingTokens(network, TOKEN_LIMIT_PER_FEED, '1h', MIN_LIQUIDITY_USD, Math.max(4, Math.floor(MAX_PAGES / 2))),
    ...await getTrendingTokens(network, Math.floor(TOKEN_LIMIT_PER_FEED / 2), '24h', MIN_LIQUIDITY_USD, Math.max(4, Math.floor(MAX_PAGES / 2)))
  ];
  const dex = [
    ...await getTrendingTokensByChain(network, TOKEN_LIMIT_PER_FEED, '5m'),
    ...await getTrendingTokensByChain(network, TOKEN_LIMIT_PER_FEED, '1h'),
    ...await getTrendingTokensByChain(network, Math.floor(TOKEN_LIMIT_PER_FEED / 2), '24h')
  ];

  const map = new Map<string, PoolCandidate>();
  const add = (tokenAddress?: string, poolAddress?: string, poolCreatedAt?: string, source?: 'gecko' | 'dexscreener') => {
    const token = normAddr(tokenAddress);
    const pool = String(poolAddress || '').toLowerCase();
    const created = asIso(poolCreatedAt);
    if (!token || !pool || !created) return;
    const key = `${pool}`;
    const hit = map.get(key);
    if (!hit) {
      map.set(key, { tokenAddress: token, poolAddress: pool, poolCreatedAt: created, discoverySource: new Set(source ? [source] : []) });
      return;
    }
    if (source) hit.discoverySource.add(source);
    if (new Date(created).getTime() > new Date(hit.poolCreatedAt).getTime()) hit.poolCreatedAt = created;
  };

  for (const t of gecko as any[]) add(t.address, t.poolAddress, t.poolCreatedAt, 'gecko');
  for (const t of dex as any[]) add(t.address, t.poolAddress, t.poolCreatedAt, 'dexscreener');

  return [...map.values()];
}

async function collectForBucket(chain: typeof CHAINS[number], bucket: Bucket, pools: PoolCandidate[], target: number, usedTx: Set<string>) {
  const rows: SampleRow[] = [];

  for (const p of pools) {
    if (rows.length >= target) break;

    const pick = new Map<string, { source: SampleRow['txSource']; kind?: string; blockTimestamp?: string | null; fallback: boolean }>();

    const fromGecko = await geckoTrades(chain.network, p.poolAddress);
    for (const t of fromGecko) {
      if (!pick.has(t.txHash)) pick.set(t.txHash, { source: 'gecko_trades', kind: t.kind, blockTimestamp: t.blockTimestamp || null, fallback: false });
    }

    if (pick.size < 25) {
      const fromRpc = await rpcTransferTxs(chain.network, p.tokenAddress, 120);
      for (const tx of fromRpc) if (!pick.has(tx)) pick.set(tx, { source: 'free_rpc', fallback: true });
    }

    if (pick.size < 40) {
      const fromExplorer = await explorerPoolTxs(chain.etherscanChainId, p.poolAddress, 120);
      for (const tx of fromExplorer) if (!pick.has(tx)) pick.set(tx, { source: 'etherscan_v2', fallback: true });
    }

    for (const [txHash, meta] of pick) {
      if (rows.length >= target) break;
      if (usedTx.has(txHash)) continue;
      usedTx.add(txHash);
      rows.push({
        chainId: chain.chainId,
        network: chain.network,
        bucket,
        txHash,
        tokenAddress: p.tokenAddress,
        poolAddress: p.poolAddress,
        poolCreatedAt: p.poolCreatedAt,
        discoverySource: [...p.discoverySource],
        txSource: meta.source,
        collectedAt: new Date().toISOString(),
        fallbackUsed: meta.fallback,
        tradeKind: meta.kind,
        blockTimestamp: meta.blockTimestamp
      });
    }

    await sleep(80);
  }

  return rows;
}

async function main() {
  const started = Date.now();
  const allRows: SampleRow[] = [];
  const chainSummary: any[] = [];

  for (const chain of CHAINS) {
    console.log(`[samples10k] build universe: ${chain.network}`);
    const universe = await poolUniverse(chain.network);
    const sortedNew = [...universe].sort((a, b) => new Date(b.poolCreatedAt).getTime() - new Date(a.poolCreatedAt).getTime());
    const sortedOld = [...universe].sort((a, b) => new Date(a.poolCreatedAt).getTime() - new Date(b.poolCreatedAt).getTime());

    const newPools = sortedNew.slice(0, Math.min(sortedNew.length, 1800));
    const oldPools = sortedOld.slice(0, Math.min(sortedOld.length, 1800));
    const usedTx = new Set<string>();

    const newRows = await collectForBucket(chain, 'new', newPools, TARGET_PER_BUCKET, usedTx);
    const oldRows = await collectForBucket(chain, 'old', oldPools, TARGET_PER_BUCKET, usedTx);

    allRows.push(...newRows, ...oldRows);
    chainSummary.push({
      chainId: chain.chainId,
      network: chain.network,
      universe: universe.length,
      newRows: newRows.length,
      oldRows: oldRows.length,
      totalRows: newRows.length + oldRows.length,
      targetRows: TARGET_PER_CHAIN
    });
  }

  const out = {
    summary: {
      startedAt: new Date(started).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      targetTotal: TARGET_TOTAL,
      collectedTotal: allRows.length,
      chainSummary,
      sourceBreakdown: {
        gecko_trades: allRows.filter((r) => r.txSource === 'gecko_trades').length,
        free_rpc: allRows.filter((r) => r.txSource === 'free_rpc').length,
        etherscan_v2: allRows.filter((r) => r.txSource === 'etherscan_v2').length,
        mixed: allRows.filter((r) => r.txSource === 'mixed').length
      }
    },
    samples: allRows
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`[samples10k] wrote ${OUTPUT_PATH} rows=${allRows.length}`);
}

main().catch((err) => {
  console.error('[samples10k] failed', err?.message || err);
  process.exit(1);
});
