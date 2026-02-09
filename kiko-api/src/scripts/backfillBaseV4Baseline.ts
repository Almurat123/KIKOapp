import { ethers } from 'ethers';
import pLimit from 'p-limit';
import prisma from '../db/prisma.js';
import { connectRedis, set as setRedis } from '../cache/redis.js';
import { getTokenDetails as getDexTokenDetails } from '../services/dexscreener.js';
import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';
import { getChainConfig } from '../config/chainConfig.js';
import { getNativeTokenPriceUsd } from '../services/onChainPriceService.js';
import { fetchJson } from '../config/unifiedApiService.js';

const CHAIN = 'base';
const CHAIN_ID = 8453;
const BASELINE_TTL_SECONDS = Math.max(24 * 60 * 60, Number(process.env.TOKEN_BASELINE_CACHE_TTL_SECONDS || `${7 * 24 * 60 * 60}`));
const META_TTL_SECONDS = Math.max(60 * 60, Number(process.env.TOKEN_META_CACHE_TTL_SECONDS || `${6 * 60 * 60}`));
const CONCURRENCY = 4;

const V4_POOL_MANAGER = '0x498581ff718922c3f8e6a244956af099b2652b2b';
const V4_INIT_FROM_BLOCK = 41642655;
const V4_INIT_TOPIC = ethers.id('Initialize(bytes32,address,address,uint24,int24,address,uint160,int24)');
const V4_INIT_IFACE = new ethers.Interface([
  'event Initialize(bytes32 indexed id,address indexed currency0,address indexed currency1,uint24 fee,int24 tickSpacing,address hooks,uint160 sqrtPriceX96,int24 tick)',
]);
const ERC20_IFACE = new ethers.Interface(['function decimals() view returns (uint8)']);

function isPoolId(v?: string): boolean { return typeof v === 'string' && /^0x[a-fA-F0-9]{64}$/.test(v); }
function baselineKey(address: string): string { return `token:baseline:v1:${CHAIN}:${address.toLowerCase()}`; }
function metaKey(address: string): string { return `token:meta:v1:${CHAIN}:${address.toLowerCase()}`; }
function pow10BigInt(exp: number): bigint { let out = 1n; for (let i = 0; i < Math.max(0, exp); i++) out *= 10n; return out; }
const nativeUsdByDate = new Map<string, number>();

function toUtcDate(tsSec: number): string {
  const d = new Date(Math.max(0, tsSec) * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getNativeUsdOnDate(tsSec: number): Promise<number | null> {
  if (!Number.isFinite(tsSec) || tsSec <= 0) {
    const spot = await getNativeTokenPriceUsd(CHAIN_ID);
    return Number.isFinite(spot) && spot > 0 ? spot : null;
  }
  const date = toUtcDate(tsSec);
  const cached = nativeUsdByDate.get(date);
  if (Number.isFinite(cached || NaN) && (cached || 0) > 0) return Number(cached);
  try {
    const data = await fetchJson<any>({
      url: `https://api.coinbase.com/v2/prices/ETH-USD/spot?date=${date}`,
      headers: { Accept: 'application/json', 'User-Agent': 'KiKo/1.0' },
    });
    const px = Number(data?.data?.amount || 0);
    if (Number.isFinite(px) && px > 0) {
      nativeUsdByDate.set(date, px);
      return px;
    }
  } catch {
    // fallback below
  }
  const spot = await getNativeTokenPriceUsd(CHAIN_ID);
  if (Number.isFinite(spot) && spot > 0) {
    nativeUsdByDate.set(date, spot);
    return spot;
  }
  return null;
}

function priceToken1PerToken0FromSqrt(sqrtPriceX96: bigint, dec0: number, dec1: number): number | null {
  if (sqrtPriceX96 <= 0n) return null;
  const q192 = 1n << 192n;
  const scale = 18;
  const numerator = sqrtPriceX96 * sqrtPriceX96 * pow10BigInt(dec0 + scale);
  const denominator = q192 * pow10BigInt(dec1);
  if (denominator <= 0n) return null;
  const scaled = numerator / denominator;
  const value = Number(ethers.formatUnits(scaled, scale));
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function readDecimals(provider: ethers.JsonRpcProvider, token: string): Promise<number | null> {
  if (token.toLowerCase() === ethers.ZeroAddress.toLowerCase()) return 18;
  try {
    const data = ERC20_IFACE.encodeFunctionData('decimals');
    const raw = await provider.call({ to: token, data });
    const decoded = ERC20_IFACE.decodeFunctionResult('decimals', raw);
    const v = Number(decoded?.[0]);
    return Number.isFinite(v) && v >= 0 && v <= 30 ? v : null;
  } catch { return null; }
}

async function main() {
  await connectRedis();
  const endpoints = getRpcEndpointsWithStrategy(CHAIN, 'cheap');
  const rpc = endpoints.find((e) => e.type === 'public' && !!e.url)?.url;
  if (!rpc) throw new Error('No public RPC for base');
  const provider = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });

  const rows = await prisma.trendingToken.findMany({
    where: { chain: CHAIN },
    select: { address: true, price: true, poolCreatedAt: true },
  });
  const stablecoins = new Set((getChainConfig(CHAIN_ID).stablecoins || []).map((x) => x.toLowerCase()));
  const wrapped = getChainConfig(CHAIN_ID).wrappedNativeAddress.toLowerCase();
  const latest = await provider.getBlock('latest');
  const latestBlock = Number(latest?.number || 0);
  const latestTs = Number(latest?.timestamp || 0);

  let scanned = 0;
  let poolIdRows = 0;
  let updated = 0;
  let failed = 0;
  let sampleError: string | null = null;

  const limiter = pLimit(CONCURRENCY);
  await Promise.all(rows.map((row) => limiter(async () => {
    scanned++;
    const current = Number(row.price || 0);
    if (!Number.isFinite(current) || current <= 0) return;

    try {
      const details = await getDexTokenDetails(CHAIN, row.address);
      const poolAddress = String(details?.poolAddress || '').trim();
      if (!isPoolId(poolAddress)) return;
      poolIdRows++;

      const topicPoolId = ethers.zeroPadValue(poolAddress.toLowerCase() as `0x${string}`, 32);
      const createdMs = row.poolCreatedAt ? new Date(row.poolCreatedAt).getTime() : 0;
      const createdSec = Math.floor(createdMs / 1000);
      const avgBlockSec = 2;
      const estimatedStart = createdSec > 0 && latestBlock > 0 && latestTs > createdSec
        ? Math.max(V4_INIT_FROM_BLOCK, latestBlock - Math.floor((latestTs - createdSec) / avgBlockSec))
        : Math.max(V4_INIT_FROM_BLOCK, latestBlock - 10000);

      const ranges: Array<{ fromBlock: number; toBlock: number }> = [
        { fromBlock: Math.max(V4_INIT_FROM_BLOCK, estimatedStart - 250), toBlock: estimatedStart + 250 },
        { fromBlock: Math.max(V4_INIT_FROM_BLOCK, estimatedStart - 750), toBlock: estimatedStart - 251 },
        { fromBlock: estimatedStart + 251, toBlock: estimatedStart + 750 },
      ];

      let logs: ethers.Log[] = [];
      for (const r of ranges) {
        if (r.toBlock <= r.fromBlock) continue;
        const chunk = await provider.getLogs({
          address: V4_POOL_MANAGER,
          topics: [V4_INIT_TOPIC, topicPoolId],
          fromBlock: r.fromBlock,
          toBlock: r.toBlock,
        });
        if (Array.isArray(chunk) && chunk.length > 0) {
          logs = chunk;
          break;
        }
      }
      if (!Array.isArray(logs) || logs.length === 0) return;

      const parsed = V4_INIT_IFACE.parseLog({ topics: logs[0].topics, data: logs[0].data });
      if (!parsed) return;
      const raw0 = String(parsed.args.currency0 || '').toLowerCase();
      const raw1 = String(parsed.args.currency1 || '').toLowerCase();
      const currency0 = raw0 === ethers.ZeroAddress.toLowerCase() ? wrapped : raw0;
      const currency1 = raw1 === ethers.ZeroAddress.toLowerCase() ? wrapped : raw1;
      const target = row.address.toLowerCase();
      if (target !== currency0 && target !== currency1) return;

      const sqrtPriceX96 = BigInt(parsed.args.sqrtPriceX96?.toString?.() || '0');
      if (sqrtPriceX96 <= 0n) return;

      const [dec0, dec1] = await Promise.all([
        readDecimals(provider, currency0),
        readDecimals(provider, currency1),
      ]);
      if (!Number.isFinite(dec0) || !Number.isFinite(dec1)) return;

      const price1Per0 = priceToken1PerToken0FromSqrt(sqrtPriceX96, Number(dec0), Number(dec1));
      if (!price1Per0) return;

      const quoteToken = target === currency0 ? currency1 : currency0;
      let quoteUsd = 0;
      if (stablecoins.has(quoteToken)) quoteUsd = 1;
      else if (quoteToken === wrapped) {
        const initBlock = await provider.getBlock(Number(logs[0].blockNumber)).catch(() => null);
        const initTs = Number(initBlock?.timestamp || 0);
        quoteUsd = Number(await getNativeUsdOnDate(initTs) || 0);
      }
      else return;
      if (!Number.isFinite(quoteUsd) || quoteUsd <= 0) return;

      const quotePerTarget = target === currency0 ? price1Per0 : 1 / price1Per0;
      if (!Number.isFinite(quotePerTarget) || quotePerTarget <= 0) return;
      const baseline = quotePerTarget * quoteUsd;
      if (!Number.isFinite(baseline) || baseline <= 0) return;

      const multipleRaw = current / baseline;
      const multiple = Number.isFinite(multipleRaw) && multipleRaw > 0 ? Math.max(1, multipleRaw) : 1;

      await setRedis(
        baselineKey(row.address),
        JSON.stringify({ baselinePrice: baseline, firstSeenAt: Date.now(), baselineSource: 'rpc_v4_initialize' }),
        BASELINE_TTL_SECONDS,
      );
      await setRedis(
        metaKey(row.address),
        JSON.stringify({ launchMultiple: multiple, updatedAt: Date.now() }),
        META_TTL_SECONDS,
      );
      updated++;
    } catch (error: any) {
      failed++;
      if (!sampleError) sampleError = String(error?.message || error || 'unknown');
    }
  })));

  console.log({ scanned, poolIdRows, updated, failed, sampleError });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
