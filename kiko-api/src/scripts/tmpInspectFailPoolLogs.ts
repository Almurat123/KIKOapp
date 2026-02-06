import { fetchTransactionReceipt } from '../services/watcherService.js';

const chainId=8453;
const txs=[
'0x962a05aeb703d528bb6137079b467e6a95b275c9b5a73f24acb49edaa82cc233',
'0x8f448163207c484f27e3bf617449fda6e1dd3558d432069be3adc45a720f0191'
];
for (const tx of txs){
  const r=await fetchTransactionReceipt(tx,chainId);
  console.log('\n====',tx,'====');
  for (const l of (r?.logs||[])){
    if (l.address.toLowerCase()==='0x498581ff718922c3f8e6a244956af099b2652b2b'){
      console.log('addr',l.address,'t0',l.topics?.[0],'topics',l.topics,'data',l.data.slice(0,130));
    }
  }
}
