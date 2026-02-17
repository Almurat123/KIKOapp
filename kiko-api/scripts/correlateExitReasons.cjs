#!/usr/bin/env node
const fs = require('fs');
const p = process.argv[2] || '/Users/almurat/KiKo/test/backend.txt';
const lines = fs.readFileSync(p,'utf8').split(/\r?\n/);
const ts=(l)=>{const m=l.match(/^(\d{4}-\d{2}-\d{2}T[^ ]+) \[/); return m?Date.parse(m[1]):null};
let lastTargetSell=null, lastTxHash=null, lastConfirm=null;
const rows=[];
for (const line of lines){
  const t=ts(line); if(!t) continue;
  if(line.includes('Target is selling - triggering mirror sell')) lastTargetSell={t,line};
  const m1=line.match(/\[ConfirmWait\] Transaction confirmed: (0x[0-9a-fA-F]+)/);
  if(m1) lastConfirm={t,tx:m1[1],line};
  if(line.includes('Swap Broadcast')){ lastTxHash=null; }
  if(line.includes('Position exit executed successfully')){
    rows.push({
      exitAt:new Date(t).toISOString(),
      likelyReason:lastTargetSell && (t-lastTargetSell.t<120000)?'mirror_sell_likely':'unknown',
      prevTargetSellMs:lastTargetSell?(t-lastTargetSell.t):null,
      confirmTx:lastConfirm && (t-lastConfirm.t<120000)?lastConfirm.tx:null,
      confirmDeltaMs:lastConfirm?(t-lastConfirm.t):null,
    });
  }
}
console.log(JSON.stringify(rows,null,2));
