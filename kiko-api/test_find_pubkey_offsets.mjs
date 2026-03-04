import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b', 'confirmed');
const pool = new PublicKey('4jdgtsLXNaDpThBAgLFDXAwdvzNxUhHMjGnsxTpoya7e');
const info = await conn.getAccountInfo(pool, 'confirmed');
if (!info) throw new Error('pool not found');
const d = info.data;

const targets = [
  'A6Xg3DPFHQMGwMkQE6g7MvWbh9bZXUP6FW3F3NNWpump',
  'So11111111111111111111111111111111111111112',
  'Fz1YwUNutpffQaBrPhjX2bLdHq8fzSbfosT6jkk6u95C',
  '5F6X6bCFUsWPDy4WWzgivhzHKQS8PNqzyvddkrbJMSgp',
  '9rPYyANsfQZw3DnDmKE3YCQF5E8oD89UXoHn9JFEhJUz',
  'Bvtgim23rfocUzxVX9j9QFxTbBnH8JZxnaGLCEkXvjKS',
  'FA2WwLvu6adPnS3gnXKPyHMcU16apjiF5JJ28xkSgS5K',
  'HswiPLzgCMx7cvfwdxFaWy3mUTM1hx1h45CMKZbXCZ59',
  'ADyA8hdefvWN2dbGGWFotbzWxrAvLW83WG6QCVXvJKqw',
  'C2aFPdENg4A2HQsmrd5rTw5TaYBX5Ku887cWjbFKtZpw',
  '5t1Ncf37mV6XSL8GFPa3BbE2UrDLAXpL79w13suJT7ie'
];

for (const t of targets) {
  const b = new PublicKey(t).toBuffer();
  let found = [];
  for (let i = 0; i <= d.length - 32; i++) {
    let ok = true;
    for (let j = 0; j < 32; j++) {
      if (d[i + j] !== b[j]) { ok = false; break; }
    }
    if (ok) found.push(i);
  }
  console.log(t, 'offsets', found);
}
