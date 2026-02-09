import { ethers } from 'ethers';
import { getRpcEndpointsWithStrategy } from '../config/apiEndpoints.js';

async function main() {
  const rpc = getRpcEndpointsWithStrategy('base','cheap').find(e=>e.type==='public'&&e.url)?.url;
  if(!rpc) throw new Error('no rpc');
  const p = new ethers.JsonRpcProvider(rpc, undefined, { staticNetwork: true });
  const blocks = [41904299,41905071,41905310];
  for (const b of blocks) {
    const blk = await p.getBlock(b);
    console.log(b, blk?.timestamp, blk ? new Date(Number(blk.timestamp)*1000).toISOString() : null);
  }
}

main().catch(e=>{console.error(e);process.exitCode=1;});
