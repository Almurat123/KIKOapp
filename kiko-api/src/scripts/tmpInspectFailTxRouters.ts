import { callRpc } from '../services/rpcManager.js';
import { fetchTransaction, fetchTransactionReceipt } from '../services/watcherService.js';

const chainId = 8453;
const txs = [
  '0x962a05aeb703d528bb6137079b467e6a95b275c9b5a73f24acb49edaa82cc233',
  '0x8f448163207c484f27e3bf617449fda6e1dd3558d432069be3adc45a720f0191'
];

(async()=>{
  for (const txHash of txs) {
    const tx = await fetchTransaction(txHash, chainId);
    const receipt = await fetchTransactionReceipt(txHash, chainId);
    const to = tx?.to;
    const code = to ? await callRpc<string>(chainId, 'eth_getCode', [to, 'latest']).catch(()=>null) : null;
    console.log('\nTX', txHash);
    console.log('to', to);
    console.log('selector', String(tx?.input || '').slice(0,10));
    console.log('code_size_bytes', code && code !== '0x' ? (code.length - 2) / 2 : 0);
    console.log('log_count', receipt?.logs?.length || 0);
    if (receipt?.logs?.length) {
      console.log('top_topics', receipt.logs.slice(0, 8).map((l:any)=>({addr:l.address, t0:l.topics?.[0]})));
    }
  }
})();
