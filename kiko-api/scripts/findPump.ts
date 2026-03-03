import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

async function findLivePump() {
    const conn = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    // Grab the latest signatures from pump.fun fee account or something
    const feeAcc = new PublicKey('CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbicfhtW4xC9iM');
    const sigs = await conn.getSignaturesForAddress(feeAcc, {limit: 50});
    for(const sig of sigs) {
        const tx = await conn.getTransaction(sig.signature, {maxSupportedTransactionVersion: 0});
        if(tx && tx.meta) {
            for(const k of tx.transaction.message.staticAccountKeys) {
                if(k.toBase58().endsWith('pump')) {
                    console.log('Found:', k.toBase58());
                    return;
                }
            }
        }
    }
}
findLivePump();
