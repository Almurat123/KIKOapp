import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b', 'confirmed');
const pool = new PublicKey('4jdgtsLXNaDpThBAgLFDXAwdvzNxUhHMjGnsxTpoya7e');
const target = new PublicKey('A6Xg3DPFHQMGwMkQE6g7MvWbh9bZXUP6FW3F3NNWpump');
const wsol = new PublicKey('So11111111111111111111111111111111111111112');

const info = await conn.getAccountInfo(pool, 'confirmed');
if (!info) throw new Error('pool not found');
const d = info.data;
console.log('len', d.length, 'owner', info.owner.toBase58());

function find(buf, sub) {
  const out = [];
  for (let i = 0; i <= buf.length - sub.length; i++) {
    let ok = true;
    for (let j = 0; j < sub.length; j++) {
      if (buf[i + j] !== sub[j]) { ok = false; break; }
    }
    if (ok) out.push(i);
  }
  return out;
}

const tOff = find(d, target.toBytes());
const sOff = find(d, wsol.toBytes());
console.log('target offsets', tOff);
console.log('wsol offsets', sOff);

for (const off of [...tOff, ...sOff].sort((a, b) => a - b)) {
  const start = Math.max(0, off - 8);
  const end = Math.min(d.length, off + 40);
  console.log('off', off, 'slice', Buffer.from(d.slice(start, end)).toString('hex'));
}
