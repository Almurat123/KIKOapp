import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b', 'confirmed');
const pool = new PublicKey('4jdgtsLXNaDpThBAgLFDXAwdvzNxUhHMjGnsxTpoya7e');
const targetMint = 'A6Xg3DPFHQMGwMkQE6g7MvWbh9bZXUP6FW3F3NNWpump';
const wsol = 'So11111111111111111111111111111111111111112';

const info = await conn.getAccountInfo(pool, 'confirmed');
if (!info) throw new Error('pool not found');
const d = info.data;

const offsets = [11, 43, 75, 107, 139, 171, 203, 235];

for (const off of offsets) {
  let pk;
  try { pk = new PublicKey(d.slice(off, off + 32)); } catch { continue; }
  const addr = pk.toBase58();
  const ai = await conn.getAccountInfo(pk, 'confirmed').catch(() => null);
  const owner = ai?.owner?.toBase58?.() || 'none';
  const len = ai?.data?.length || 0;

  let tokenMeta = null;
  if (owner === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' || owner === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
    try {
      const parsed = await conn.getParsedAccountInfo(pk, 'confirmed');
      const p = parsed?.value?.data?.parsed?.info;
      if (p?.mint && p?.tokenAmount?.amount != null) {
        tokenMeta = {
          mint: p.mint,
          amount: p.tokenAmount.amount,
          decimals: p.tokenAmount.decimals,
          owner: p.owner,
        };
      }
    } catch {}
  }

  console.log('\nOFFSET', off, addr);
  console.log('owner=', owner, 'len=', len);
  if (tokenMeta) {
    console.log('tokenAccount=', tokenMeta);
    const isTarget = tokenMeta.mint === targetMint;
    const isWsol = tokenMeta.mint === wsol;
    if (isTarget || isWsol) console.log('>>> candidate vault for', isTarget ? 'TARGET' : 'WSOL');
  }
}
