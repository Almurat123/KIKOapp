import { Connection, PublicKey } from '@solana/web3.js';

const conn = new Connection('https://mainnet.helius-rpc.com/?api-key=2dff82b2-9157-4896-9438-646ab1b0c89b', 'confirmed');
const txHash = 'FUJzh8BSKeWbPzDE6PzSGeiEmxmRuRQuEY6KBs2Gj3Px6KpRfCqshCpLwutP8hd6PpX815DSEh4UaLoo6SU443W';
const pamm = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

const tx = await conn.getTransaction(txHash, { maxSupportedTransactionVersion: 0 });
if (!tx) throw new Error('tx not found');
const keys = tx.transaction.message.getAccountKeys().staticAccountKeys.map((k) => k.toBase58());

let first = null;
for (const inner of tx.meta?.innerInstructions || []) {
  for (const ix of inner.instructions || []) {
    const pid = keys[ix.programIdIndex];
    if (pid === pamm) { first = ix; break; }
  }
  if (first) break;
}
if (!first) throw new Error('no pAMM inner ix');

for (const ai of first.accounts || []) {
  const addr = keys[ai];
  const pk = new PublicKey(addr);
  const info = await conn.getAccountInfo(pk, 'confirmed').catch(() => null);
  const owner = info?.owner?.toBase58?.() || 'none';
  const len = info?.data?.length || 0;
  let parsed = null;
  try {
    const pi = await conn.getParsedAccountInfo(pk, 'confirmed');
    const p = pi?.value?.data?.parsed?.info;
    if (p?.mint || p?.owner || p?.tokenAmount?.amount != null) {
      parsed = {
        mint: p?.mint,
        owner: p?.owner,
        amount: p?.tokenAmount?.amount,
        decimals: p?.tokenAmount?.decimals,
      };
    }
  } catch {}
  console.log({ addr, owner, len, parsed });
}
