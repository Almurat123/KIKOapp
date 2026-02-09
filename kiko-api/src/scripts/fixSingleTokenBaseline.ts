import { ethers } from 'ethers';
import { getTokenPairsByAddress } from '../services/dexscreener.js';
import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';
import { connectRedis, set as setRedis, get as getRedis } from '../cache/redis.js';
import { getChainConfig } from '../config/chainConfig.js';
import { fetchJson } from '../config/unifiedApiService.js';

const chain = 'base';
const chainId = 8453;
const tokenAddress = '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b'.toLowerCase();
const RPC_LOG_MAX_BLOCK_RANGE = 500;

const PAIR_IFACE = new ethers.Interface([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
]);
const ERC20_IFACE = new ethers.Interface(['function decimals() view returns (uint8)']);
const V2_SWAP_TOPIC = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
const V3_SWAP_TOPIC = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');
const V2_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)',
]);
const V3_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)',
]);

function absBig(v: bigint): bigint { return v < 0n ? -v : v; }
function toUtcDate(tsSec: number): string {
  const d = new Date(Math.max(0, tsSec) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function readAddr(provider: ethers.JsonRpcProvider, to: string, fn: 'token0'|'token1'): Promise<string | null> {
  try {
    const data = PAIR_IFACE.encodeFunctionData(fn);
    const raw = await provider.call({ to, data });
    const decoded = PAIR_IFACE.decodeFunctionResult(fn, raw);
    const v = String(decoded?.[0] || '').toLowerCase();
    return ethers.isAddress(v) ? v : null;
  } catch { return null; }
}

async function readDecimals(provider: ethers.JsonRpcProvider, token: string): Promise<number | null> {
  try {
    const data = ERC20_IFACE.encodeFunctionData('decimals');
    const raw = await provider.call({ to: token, data });
    const decoded = ERC20_IFACE.decodeFunctionResult('decimals', raw);
    const n = Number(decoded?.[0]);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

function parseSwap(log: ethers.Log, target: string, token0: string, token1: string): { targetRaw: bigint; quoteRaw: bigint } | null {
  if (log.topics[0] === V2_SWAP_TOPIC) {
    const p = V2_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!p) return null;
    const amount0In = BigInt(p.args.amount0In.toString());
    const amount1In = BigInt(p.args.amount1In.toString());
    const amount0Out = BigInt(p.args.amount0Out.toString());
    const amount1Out = BigInt(p.args.amount1Out.toString());
    if (target === token0) {
      if (amount0In > 0n && amount1Out > 0n) return { targetRaw: amount0In, quoteRaw: amount1Out };
      if (amount0Out > 0n && amount1In > 0n) return { targetRaw: amount0Out, quoteRaw: amount1In };
      return null;
    }
    if (amount1In > 0n && amount0Out > 0n) return { targetRaw: amount1In, quoteRaw: amount0Out };
    if (amount1Out > 0n && amount0In > 0n) return { targetRaw: amount1Out, quoteRaw: amount0In };
    return null;
  }

  if (log.topics[0] === V3_SWAP_TOPIC) {
    const p = V3_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!p) return null;
    const amount0 = absBig(BigInt(p.args.amount0.toString()));
    const amount1 = absBig(BigInt(p.args.amount1.toString()));
    if (target === token0) return amount0 > 0n && amount1 > 0n ? { targetRaw: amount0, quoteRaw: amount1 } : null;
    return amount1 > 0n && amount0 > 0n ? { targetRaw: amount1, quoteRaw: amount0 } : null;
  }

  return null;
}

function quotePerToken(targetRaw: bigint, quoteRaw: bigint, targetDecimals: number, quoteDecimals: number): number | null {
  if (targetRaw <= 0n || quoteRaw <= 0n) return null;
  const target = Number(ethers.formatUnits(targetRaw, targetDecimals));
  const quote = Number(ethers.formatUnits(quoteRaw, quoteDecimals));
  if (!Number.isFinite(target) || !Number.isFinite(quote) || target <= 0 || quote <= 0) return null;
  const p = quote / target;
  return Number.isFinite(p) && p > 0 ? p : null;
}

async function getEthUsdAtDate(tsSec: number): Promise<number | null> {
  const date = toUtcDate(tsSec);
  try {
    const data = await fetchJson<any>({
      url: `https://api.coinbase.com/v2/prices/ETH-USD/spot?date=${date}`,
      headers: { Accept: 'application/json', 'User-Agent': 'KiKo/1.0' },
    });
    const px = Number(data?.data?.amount || 0);
    return Number.isFinite(px) && px > 0 ? px : null;
  } catch {
    return null;
  }
}

async function main() {
  await connectRedis();
  const endpoints = getRpcEndpointsWithStrategy(chain, 'cheap');
  const rpc = endpoints.find((e) => e.type === 'public' && !!e.url)?.url;
  if (!rpc) throw new Error('No public RPC url');
  const provider = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });

  const pairs = await getTokenPairsByAddress(chain, tokenAddress);
  const ranked = pairs
    .filter((p) => ethers.isAddress(p.pairAddress))
    .sort((a, b) => ((a.pairCreatedAt || 0) - (b.pairCreatedAt || 0)) || ((Number(b.liquidityUsd || 0) - Number(a.liquidityUsd || 0))));

  const stablecoins = new Set((getChainConfig(chainId).stablecoins || []).map((x) => x.toLowerCase()));
  const wrapped = getChainConfig(chainId).wrappedNativeAddress.toLowerCase();
  const latest = await provider.getBlock('latest');
  const latestBlock = Number(latest?.number || 0);
  const latestTs = Number(latest?.timestamp || 0);

  for (const pair of ranked.slice(0, 8)) {
    const pool = pair.pairAddress;
    const [token0, token1] = await Promise.all([
      readAddr(provider, pool, 'token0'),
      readAddr(provider, pool, 'token1'),
    ]);
    if (!token0 || !token1) continue;
    if (token0 !== tokenAddress && token1 !== tokenAddress) continue;

    const createdSec = pair.pairCreatedAt ? Math.floor(Number(pair.pairCreatedAt) / 1000) : 0;
    const estimatedStart = createdSec > 0
      ? Math.max(1, latestBlock - Math.floor(Math.max(0, latestTs - createdSec) / 2))
      : Math.max(1, latestBlock - 20000);

    const ranges = [
      { from: Math.max(1, estimatedStart - 600), to: estimatedStart + 1200 },
      { from: Math.max(1, estimatedStart - 4000), to: estimatedStart + 9000 },
      { from: Math.max(1, estimatedStart - 15000), to: estimatedStart + 30000 },
    ];

    let found: { targetRaw: bigint; quoteRaw: bigint; blockNumber: number } | null = null;

    for (const r of ranges) {
      for (let from = r.from; from <= r.to; from += RPC_LOG_MAX_BLOCK_RANGE) {
        const to = Math.min(r.to, from + RPC_LOG_MAX_BLOCK_RANGE - 1);
        const [v2, v3] = await Promise.all([
          provider.getLogs({ address: pool, topics: [V2_SWAP_TOPIC], fromBlock: from, toBlock: to }).catch(() => [] as ethers.Log[]),
          provider.getLogs({ address: pool, topics: [V3_SWAP_TOPIC], fromBlock: from, toBlock: to }).catch(() => [] as ethers.Log[]),
        ]);
        const logs = [...v2, ...v3].sort((a, b) => a.blockNumber - b.blockNumber || Number(a.index) - Number(b.index));
        for (const log of logs) {
          const parsed = parseSwap(log, tokenAddress, token0, token1);
          if (!parsed) continue;
          found = { ...parsed, blockNumber: Number(log.blockNumber) };
          break;
        }
        if (found) break;
      }
      if (found) break;
    }

    if (!found) {
      console.log('no first swap in pool', pool);
      continue;
    }

    const quoteToken = token0 === tokenAddress ? token1 : token0;
    const [targetDecimals, quoteDecimals] = await Promise.all([
      readDecimals(provider, tokenAddress),
      readDecimals(provider, quoteToken),
    ]);
    if (!Number.isFinite(targetDecimals) || !Number.isFinite(quoteDecimals)) continue;

    const quotePerTarget = quotePerToken(found.targetRaw, found.quoteRaw, Number(targetDecimals), Number(quoteDecimals));
    if (!quotePerTarget) continue;

    let baseline = 0;
    let source = 'rpc_stable_first_swap';
    if (stablecoins.has(quoteToken)) {
      baseline = quotePerTarget;
    } else if (quoteToken === wrapped) {
      const b = await provider.getBlock(found.blockNumber).catch(() => null);
      const ts = Number(b?.timestamp || 0);
      const ethUsd = await getEthUsdAtDate(ts);
      if (!ethUsd) continue;
      baseline = quotePerTarget * ethUsd;
      source = 'rpc_native_first_swap';
    } else {
      continue;
    }

    if (!Number.isFinite(baseline) || baseline <= 0) continue;

    const baselineKey = `token:baseline:v1:${chain}:${tokenAddress}`;
    const metaKey = `token:meta:v1:${chain}:${tokenAddress}`;
    const metaRaw = await getRedis(metaKey);
    const current = Number(JSON.parse(metaRaw || '{}')?.launchMultiple || 1);

    await setRedis(baselineKey, JSON.stringify({ baselinePrice: baseline, firstSeenAt: Date.now(), baselineSource: source }), 7 * 24 * 3600);

    console.log('updated baseline', { pool, foundBlock: found.blockNumber, quoteToken, baseline, source, prevLaunchMultiple: current });
    return;
  }

  console.log('no baseline found');
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
