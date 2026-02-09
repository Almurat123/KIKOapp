import { ethers } from 'ethers';
import { getTokenPairsByAddress, getCandlestickData as getDexCandlestickData } from '../services/dexscreener.js';
import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';

const token = '0x22aF33FE49fD1Fa80c7149773dDe5890D3c76F3b'.toLowerCase();
const chain = 'base';

const PAIR_IFACE = new ethers.Interface([
  'function token0() view returns (address)',
  'function token1() view returns (address)',
]);
const V2_SWAP_TOPIC = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
const V3_SWAP_TOPIC = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');

async function readAddr(provider: ethers.JsonRpcProvider, to: string, fn: string): Promise<string | null> {
  try {
    const data = PAIR_IFACE.encodeFunctionData(fn);
    const raw = await provider.call({ to, data });
    const decoded = PAIR_IFACE.decodeFunctionResult(fn, raw);
    return String(decoded?.[0] || '').toLowerCase();
  } catch { return null; }
}

async function main() {
  const endpoints = getRpcEndpointsWithStrategy(chain, 'cheap');
  const rpc = endpoints.find((e) => e.type === 'public' && !!e.url)?.url;
  if (!rpc) throw new Error('No public RPC');
  const provider = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });

  const pairs = await getTokenPairsByAddress(chain, token);
  const ranked = pairs.sort((a, b) => ((a.pairCreatedAt || 0) - (b.pairCreatedAt || 0)) || ((Number(b.liquidityUsd || 0) - Number(a.liquidityUsd || 0))));
  console.log('pairs=', ranked.length);

  for (const p of ranked.slice(0, 6)) {
    const addr = p.pairAddress;
    console.log('\nPAIR', addr, 'createdAt=', p.pairCreatedAt, 'liq=', p.liquidityUsd, 'dex=', p.dexId, 'quote=', p.quoteTokenAddress);

    const dex = await getDexCandlestickData(chain, addr, 'd1', 180);
    console.log('dexCandles=', Array.isArray(dex) ? dex.length : -1, 'first=', Array.isArray(dex) && dex[0] ? dex[0] : null);

    if (!ethers.isAddress(addr)) {
      console.log('evmPairCall=skip(not address)');
      continue;
    }

    const [t0, t1] = await Promise.all([
      readAddr(provider, addr, 'token0'),
      readAddr(provider, addr, 'token1'),
    ]);
    console.log('token0/token1=', t0, t1);

    if (!t0 || !t1 || (t0 !== token && t1 !== token)) {
      console.log('targetNotInPoolOrReadFail');
      continue;
    }

    const latest = await provider.getBlock('latest');
    const from = Math.max(1, Number(latest?.number || 0) - 120000);
    const to = Number(latest?.number || 0);
    const [v2, v3] = await Promise.all([
      provider.getLogs({ address: addr, topics: [V2_SWAP_TOPIC], fromBlock: from, toBlock: to }).catch((e) => { console.log('v2Err=', e?.message || String(e)); return []; }),
      provider.getLogs({ address: addr, topics: [V3_SWAP_TOPIC], fromBlock: from, toBlock: to }).catch((e) => { console.log('v3Err=', e?.message || String(e)); return []; }),
    ]);
    console.log('swapLogsRecent=', v2.length, v3.length);
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
