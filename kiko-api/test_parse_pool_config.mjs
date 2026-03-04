import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b', 'confirmed');
const cfg = new PublicKey('ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw');
const info = await conn.getAccountInfo(cfg, 'confirmed');
if (!info) throw new Error('cfg not found');
const d = info.data;

const targets = [
  'FA2WwLvu6adPnS3gnXKPyHMcU16apjiF5JJ28xkSgS5K',
  'HswiPLzgCMx7cvfwdxFaWy3mUTM1hx1h45CMKZbXCZ59',
  '9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz',
  'Bvtgim23rfocUzxVX9j9QFxTbBnH8JZxnaGLCEkXvjKS',
  '4jdgtsLXNaDpThBAgLFDXAwdvzNxUhHMjGnsxTpoya7e',
  'A6Xg3DPFHQMGwMkQE6g7MvWbh9bZXUP6FW3F3NNWpump',
  'So11111111111111111111111111111111111111112',
  '5PHirr8joyTMp9JMm6nW7hNDVyEYdkzDqazxPD7RaTjx'
];

function find(buf, sub) {
  const out = [];
  for (let i=0;i<=buf.length-sub.length;i++) {
    let ok=true;
    for (let j=0;j<sub.length;j++) if (buf[i+j]!==sub[j]) { ok=false; break; }
    if (ok) out.push(i);
  }
  return out;
}

console.log('cfg len', d.length);
for (const t of targets) {
  const offs = find(d, new PublicKey(t).toBuffer());
  console.log(t, offs);
}

// also print all pubkeys aligned by 32-byte windows every 1 byte that look like existing accounts
for (let off=0; off<=d.length-32; off++) {
  try {
    const pk = new PublicKey(d.slice(off, off+32));
    const ai = await conn.getAccountInfo(pk, 'confirmed').catch(()=>null);
    if (ai) {
      console.log('off', off, pk.toBase58(), 'owner', ai.owner.toBase58(), 'len', ai.data.length);
    }
  } catch {}
}
