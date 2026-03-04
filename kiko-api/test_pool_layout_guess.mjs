import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b', 'confirmed');
const pool = new PublicKey('4jdgtsLXNaDpThBAgLFDXAwdvzNxUhHMjGnsxTpoya7e');
const info = await conn.getAccountInfo(pool, 'confirmed');
if (!info) throw new Error('pool not found');
const d = info.data;

function readPk(off) {
  try { return new PublicKey(d.slice(off, off + 32)).toBase58(); } catch { return null; }
}

const offsets = [11, 43, 75, 107, 139, 171, 203, 235];
for (const off of offsets) {
  const pk = readPk(off);
  if (!pk) continue;
  const ai = await conn.getAccountInfo(new PublicKey(pk), 'confirmed').catch(() => null);
  console.log(off, pk, 'owner=', ai?.owner?.toBase58?.() || 'none', 'len=', ai?.data?.length || 0);
}
