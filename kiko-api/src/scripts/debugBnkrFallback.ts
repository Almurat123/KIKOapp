import { ethers } from 'ethers';
import { getChainConfig } from '../config/chainConfig.js';
import { fetchJson } from '../config/unifiedApiService.js';

const tokenAddress = '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b';
const chainId = 8453;
const V2_SWAP_TOPIC = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
const V3_SWAP_TOPIC = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');
const V2_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,uint256 amount0In,uint256 amount1In,uint256 amount0Out,uint256 amount1Out,address indexed to)',
]);
const V3_SWAP_IFACE = new ethers.Interface([
  'event Swap(address indexed sender,address indexed recipient,int256 amount0,int256 amount1,uint160 sqrtPriceX96,uint128 liquidity,int24 tick)',
]);
const PAIR_IFACE = new ethers.Interface(['function token0() view returns (address)','function token1() view returns (address)']);
const ERC20_IFACE = new ethers.Interface(['function decimals() view returns (uint8)']);

function absBig(v: bigint){ return v < 0n ? -v : v; }
function toUtcDate(tsSec: number){
  const d = new Date(Math.max(0, tsSec) * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}
function estimateBlocksForSeconds(windowSec: number){ return Math.max(100, Math.floor(windowSec / 2)); }

async function getEthUsdOnDate(tsSec: number): Promise<number | null> {
  const date = toUtcDate(tsSec);
  try {
    const r = await fetchJson<any>({
      url: `https://api.coinbase.com/v2/prices/ETH-USD/spot?date=${date}`,
      headers: { Accept: 'application/json', 'User-Agent': 'KiKo/1.0' }
    });
    const px = Number(r?.data?.amount || 0);
    return Number.isFinite(px) && px > 0 ? px : null;
  } catch {
    return null;
  }
}

function parseFirstSwapLog(log: ethers.Log, target: string, token0: string, token1: string){
  if (log.topics[0] === V2_SWAP_TOPIC) {
    const p = V2_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!p) return null;
    const a0i = BigInt(p.args.amount0In.toString());
    const a1i = BigInt(p.args.amount1In.toString());
    const a0o = BigInt(p.args.amount0Out.toString());
    const a1o = BigInt(p.args.amount1Out.toString());
    if (target === token0) return (a0o>0n && a1i>0n) ? { targetRaw:a0o, quoteRaw:a1i } : null;
    return (a1o>0n && a0i>0n) ? { targetRaw:a1o, quoteRaw:a0i } : null;
  }
  if (log.topics[0] === V3_SWAP_TOPIC) {
    const p = V3_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!p) return null;
    const a0 = BigInt(p.args.amount0.toString());
    const a1 = BigInt(p.args.amount1.toString());
    if (target === token0) return (a0<0n && a1>0n) ? { targetRaw:absBig(a0), quoteRaw:a1 } : null;
    return (a1<0n && a0>0n) ? { targetRaw:absBig(a1), quoteRaw:a0 } : null;
  }
  return null;
}

function parseAnySwapLog(log: ethers.Log, target: string, token0: string, token1: string){
  if (log.topics[0] === V2_SWAP_TOPIC) {
    const p = V2_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!p) return null;
    const a0i = BigInt(p.args.amount0In.toString());
    const a1i = BigInt(p.args.amount1In.toString());
    const a0o = BigInt(p.args.amount0Out.toString());
    const a1o = BigInt(p.args.amount1Out.toString());
    if (target === token0) {
      const targetAbs = a0o > 0n ? a0o : a0i;
      const quoteAbs = a0o > 0n ? a1i : a1o;
      return targetAbs>0n && quoteAbs>0n ? { targetRaw:targetAbs, quoteRaw:quoteAbs } : null;
    }
    const targetAbs = a1o > 0n ? a1o : a1i;
    const quoteAbs = a1o > 0n ? a0i : a0o;
    return targetAbs>0n && quoteAbs>0n ? { targetRaw:targetAbs, quoteRaw:quoteAbs } : null;
  }
  if (log.topics[0] === V3_SWAP_TOPIC) {
    const p = V3_SWAP_IFACE.parseLog({ topics: log.topics, data: log.data });
    if (!p) return null;
    const a0 = absBig(BigInt(p.args.amount0.toString()));
    const a1 = absBig(BigInt(p.args.amount1.toString()));
    if (a0<=0n || a1<=0n) return null;
    if (target === token0) return { targetRaw:a0, quoteRaw:a1 };
    return { targetRaw:a1, quoteRaw:a0 };
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

async function main(){
  const pairs = await fetchJson<any>({ url: `https://api.dexscreener.com/token-pairs/v1/base/${tokenAddress}` });
  const first = Array.isArray(pairs)
    ? pairs
      .filter((p:any) => p?.pairAddress && Number.isFinite(Number(p?.pairCreatedAt)))
      .sort((a:any,b:any)=> Number(a.pairCreatedAt)-Number(b.pairCreatedAt))[0]
    : null;

  if (!first) throw new Error('dex no earliest pair');
  const pool = String(first.pairAddress).toLowerCase();
  const createdSec = Math.floor(Number(first.pairCreatedAt) / 1000);

  const provider = new ethers.JsonRpcProvider('https://mainnet.base.org', 8453, { staticNetwork: true });
  const [token0Raw, token1Raw] = await Promise.all([
    provider.call({to:pool,data:PAIR_IFACE.encodeFunctionData('token0')}),
    provider.call({to:pool,data:PAIR_IFACE.encodeFunctionData('token1')})
  ]);
  const token0 = String(PAIR_IFACE.decodeFunctionResult('token0', token0Raw)[0]).toLowerCase();
  const token1 = String(PAIR_IFACE.decodeFunctionResult('token1', token1Raw)[0]).toLowerCase();

  const latestBlock = Number((await provider.getBlock('latest'))?.number || 0);
  let lo = 1, hi = latestBlock, best = 1;
  for(let i=0;i<26 && lo<=hi;i++){
    const mid = Math.floor((lo+hi)/2);
    const b = await provider.getBlock(mid);
    const ts = Number(b?.timestamp||0);
    if (ts <= createdSec) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  const startBlock = best;

  const windowBlocks = estimateBlocksForSeconds(1800);
  const fromBlock = Math.max(1, startBlock - 300);
  const toBlock = startBlock + windowBlocks + 500;

  let buyCount = 0;
  let anyCount = 0;
  const anySamples: Array<{block:number; targetRaw: bigint; quoteRaw: bigint}> = [];

  for(let from = fromBlock; from <= toBlock; from += 500){
    const to = Math.min(toBlock, from + 499);
    const [v2, v3] = await Promise.all([
      provider.getLogs({address:pool, topics:[V2_SWAP_TOPIC], fromBlock:from, toBlock:to}).catch(()=>[]),
      provider.getLogs({address:pool, topics:[V3_SWAP_TOPIC], fromBlock:from, toBlock:to}).catch(()=>[]),
    ]);
    const logs = [...v2,...v3].sort((a,b)=> Number(a.blockNumber)-Number(b.blockNumber) || Number(a.index)-Number(b.index));
    for(const log of logs){
      const b = parseFirstSwapLog(log as ethers.Log, tokenAddress, token0, token1);
      if (b) buyCount++;
      const a = parseAnySwapLog(log as ethers.Log, tokenAddress, token0, token1);
      if (a) {
        anyCount++;
        if (anySamples.length < 60) anySamples.push({ block: Number(log.blockNumber), targetRaw: a.targetRaw, quoteRaw: a.quoteRaw });
      }
    }
  }

  const quoteToken = tokenAddress === token0 ? token1 : token0;
  const [targetDecimalsRaw, quoteDecimalsRaw] = await Promise.all([
    provider.call({to:tokenAddress,data:ERC20_IFACE.encodeFunctionData('decimals')}),
    provider.call({to:quoteToken,data:ERC20_IFACE.encodeFunctionData('decimals')})
  ]);
  const targetDecimals = Number(ERC20_IFACE.decodeFunctionResult('decimals', targetDecimalsRaw)[0]);
  const quoteDecimals = Number(ERC20_IFACE.decodeFunctionResult('decimals', quoteDecimalsRaw)[0]);

  const cfg = getChainConfig(chainId);
  const stable = new Set((cfg.stablecoins||[]).map((x:string)=>x.toLowerCase()));
  const wrapped = String(cfg.wrappedNativeAddress||'').toLowerCase();

  const pxCandidates: number[] = [];
  for (const s of anySamples.slice(0,50)) {
    const qpt = quotePerToken(s.targetRaw, s.quoteRaw, targetDecimals, quoteDecimals);
    if (!qpt) continue;
    if (stable.has(quoteToken)) {
      pxCandidates.push(qpt);
      continue;
    }
    if (quoteToken === wrapped) {
      const blk = await provider.getBlock(s.block).catch(()=>null);
      const ts = Number(blk?.timestamp || 0);
      const ethUsd = ts > 0 ? await getEthUsdOnDate(ts) : null;
      if (ethUsd && Number.isFinite(ethUsd)) pxCandidates.push(qpt * ethUsd);
    }
  }

  pxCandidates.sort((a,b)=>a-b);
  const median = pxCandidates.length ? pxCandidates[Math.floor(pxCandidates.length/2)] : null;

  console.log(JSON.stringify({
    pool,
    createdSec,
    startBlock,
    token0,
    token1,
    quoteToken,
    buyCount,
    anyCount,
    anySamples: anySamples.length,
    pxCandidates: pxCandidates.length,
    medianPx: median,
    firstPx: pxCandidates[0] || null,
    lastPx: pxCandidates[pxCandidates.length-1] || null
  }, null, 2));
}

main().catch((e)=>{ console.error(e); process.exit(1); });
