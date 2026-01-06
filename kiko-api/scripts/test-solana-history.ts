import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Mock Solscan key if missing just for logic test
if (!process.env.SOLSCAN_API_KEY) {
    process.env.SOLSCAN_API_KEY = 'mock_key_for_test';
}

// Load services after dotenv
async function testSolanaHistory() {
    const { getWalletTransactions } = await import('../src/services/alchemy.js');
    const helius = await import('../src/services/helius.js');
    const solscan = await import('../src/services/solscan.js');

    const address = 'vines1vzrYbzduYv9bP5M5C9gGmgM9X8w1f4G5X';

    console.log('Provider Status:');
    console.log(`- Helius Configured: ${helius.isHeliusConfigured()}`);
    console.log(`- Solscan Configured: ${solscan.isConfigured()}`);

    console.log(`\nTesting Solana History for ${address}...`);
    try {
        const txs = await getWalletTransactions(address, 'solana', 5);
        console.log(`Success! Fetched ${txs.length} transactions.`);
        txs.forEach((tx, i) => {
            console.log(`${i + 1}. ${tx.txHash.slice(0, 8)}... Type: ${tx.txType}, Block: ${tx.blockNumber}`);
        });
    } catch (e) {
        console.error('Test failed:', e);
    }
}

testSolanaHistory();
