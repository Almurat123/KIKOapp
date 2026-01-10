import 'dotenv/config';
import { Connection } from '@solana/web3.js';
import { SOLANA_CONFIG } from '../config/solanaConfig.js';

async function testRpc() {
    const url = 'https://api.mainnet-beta.solana.com';
    console.log(`Testing RPC: ${url}`);

    const connection = new Connection(url, 'confirmed');
    const txHash = 'AZkCJbvpMixJzQKkKx3V3Nd9Jyce35L2px5UrtNSBLysZWuKUcZ5EPm8HSxYdGZ62TwJCAq62Tx7nAYWGgbiLn2';

    try {
        console.log('Fetching transaction...');
        const tx = await connection.getParsedTransaction(txHash, {
            maxSupportedTransactionVersion: 0
        });
        console.log('Successfully fetched transaction!');
        console.log('Keys:', tx?.transaction.message.accountKeys.length);
    } catch (e: any) {
        console.error('--- FETCH ERROR ---');
        console.error(e.message);
        if (e.cause) {
            console.error('Cause:', e.cause);
        }
        console.error('Full Error:', e);
    }
}

testRpc();
