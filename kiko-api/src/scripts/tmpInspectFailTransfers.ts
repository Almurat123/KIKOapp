import { fetchTransactionReceipt } from '../services/watcherService.js';
import { ethers } from 'ethers';

const chainId=8453;
const txs=[
'0x962a05aeb703d528bb6137079b467e6a95b275c9b5a73f24acb49edaa82cc233',
'0x8f448163207c484f27e3bf617449fda6e1dd3558d432069be3adc45a720f0191'
];
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
for (const tx of txs){
  const r=await fetchTransactionReceipt(tx,chainId);
  console.log('\nTX',tx,'logs',r?.logs?.length||0);
  for (const l of (r?.logs||[])){
    const t0=l.topics?.[0]?.toLowerCase();
    if (t0===TRANSFER){
      const from='0x'+l.topics[1].slice(26);
      const to='0x'+l.topics[2].slice(26);
      const amt=BigInt(l.data||'0x0').toString();
      console.log('transfer token',l.address,'from',from,'to',to,'amt',amt.slice(0,30));
    }
  }
}
