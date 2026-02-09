import { ethers } from 'ethers';
import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';
import { getEvmLogs } from '../config/unifiedScanService.js';

const pair = '0xAEC085E5A5CE8d96A7bDd3eB3A62445d4f6CE703';
const chain='base';
const chainId=8453;
const V2 = ethers.id('Swap(address,uint256,uint256,uint256,uint256,address)');
const V3 = ethers.id('Swap(address,address,int256,int256,uint160,uint128,int24)');

async function main(){
  const rpc = getRpcEndpointsWithStrategy(chain,'cheap').find(e=>e.type==='public'&&e.url)?.url;
  if(!rpc) throw new Error('no rpc');
  const p = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });
  const latest = await p.getBlock('latest');
  const latestBlock = Number(latest?.number||0);
  const [v2,v3] = await Promise.all([
    getEvmLogs(chainId, chain, { address: pair, topic0: V2, fromBlock: 0, toBlock: latestBlock, page:1, offset:100, sort:'asc' }).catch(()=>[]),
    getEvmLogs(chainId, chain, { address: pair, topic0: V3, fromBlock: 0, toBlock: latestBlock, page:1, offset:100, sort:'asc' }).catch(()=>[]),
  ]);
  const logs = [...v2,...v3].sort((a,b)=>a.blockNumber-b.blockNumber || a.logIndex-b.logIndex);
  console.log('v2',v2.length,'v3',v3.length,'all',logs.length);
  if(logs.length===0){ console.log('no logs'); return; }
  const first = logs[0];
  const blk = await p.getBlock(first.blockNumber);
  console.log('first', { block:first.blockNumber, ts: blk?.timestamp, iso: blk? new Date(Number(blk.timestamp)*1000).toISOString() : null, tx:first.transactionHash });
}

main().catch(e=>{console.error(e); process.exitCode=1;});
