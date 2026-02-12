import { ethers } from 'ethers';

const TOKENS = [
  { symbol:'wkeyDAO', address:'0x194B302a4b0a79795Fb68E2ADf1B8c9eC5ff8d1F' },
  { symbol:'WMTX', address:'0xDBB5Cf12408a3Ac17d668037Ce289f9eA75439D7' },
  { symbol:'MYX', address:'0xD82544bf0dfe8385eF8FA34D67e6e4940CC63e16' },
  { symbol:'FourExample', address:'0x762f68A78A03C38f5E242196e8D3D96Fb185fFFf' }
];
const RPC = 'https://bsc-dataseed.binance.org';
const provider = new ethers.JsonRpcProvider(RPC, 56, { staticNetwork: true });

const V2_ADDR = '0x5c952063c7fc8610ffdb798152d69f0b9550762b';
const V1_ADDR = '0xec4549cadce5da21df6e6422d448034b5233bfbc';
const V2_TOPIC = ethers.id('TokenPurchase(address,address,uint256,uint256,uint256,uint256,uint256,uint256)');
const V1_TOPIC = ethers.id('TokenPurchase(address,address,uint256,uint256)');
const V2_IFACE = new ethers.Interface([
  'event TokenPurchase(address token,address account,uint256 price,uint256 amount,uint256 cost,uint256 fee,uint256 offers,uint256 funds)'
]);
const V1_IFACE = new ethers.Interface([
  'event TokenPurchase(address token,address account,uint256 tokenAmount,uint256 etherAmount)'
]);

const hx=(n:number)=>'0x'+n.toString(16);

async function scanManager(address: string, topic: string, kind: 'v1'|'v2') {
  const latest = Number(await provider.getBlockNumber());
  const step = 3000;
  const fromStart = Math.max(1, latest - 2_000_000); // recent ~70 days
  let hits: Array<{block:number;tx?:string;kind:'v1'|'v2';amount:string;cost:string}> = [];
  for (let from = fromStart; from <= latest; from += step) {
    const to = Math.min(latest, from + step - 1);
    let logs: ethers.Log[] = [];
    try {
      logs = await provider.getLogs({ address, topics:[topic], fromBlock: from, toBlock: to });
    } catch {
      continue;
    }
    for (const log of logs) {
      try {
        if (kind === 'v2') {
          const p = V2_IFACE.parseLog({ topics: log.topics, data: log.data });
          if (!p) continue;
          const token = String(p.args.token || '').toLowerCase();
          if (token !== addressTarget.toLowerCase()) continue;
          hits.push({ block: Number(log.blockNumber), tx: (log as any).transactionHash, kind, amount: p.args.amount.toString(), cost: p.args.cost.toString() });
        } else {
          const p = V1_IFACE.parseLog({ topics: log.topics, data: log.data });
          if (!p) continue;
          const token = String(p.args.token || '').toLowerCase();
          if (token !== addressTarget.toLowerCase()) continue;
          hits.push({ block: Number(log.blockNumber), tx: (log as any).transactionHash, kind, amount: p.args.tokenAmount.toString(), cost: p.args.etherAmount.toString() });
        }
      } catch {}
    }
    if (hits.length >= 5) break;
  }
  return hits.sort((a,b)=>a.block-b.block).slice(0,5);
}

let addressTarget = '';

(async()=>{
  const out: any[] = [];
  for (const t of TOKENS) {
    addressTarget = t.address;
    const v2 = await scanManager(V2_ADDR, V2_TOPIC, 'v2');
    const v1 = await scanManager(V1_ADDR, V1_TOPIC, 'v1');
    out.push({ symbol:t.symbol, address:t.address, v2Hits:v2.length, v1Hits:v1.length, v2Sample:v2[0] || null, v1Sample:v1[0] || null });
    console.error('[progress]', t.symbol, 'v2', v2.length, 'v1', v1.length);
  }
  console.log(JSON.stringify({ now: new Date().toISOString(), out }, null, 2));
})();
