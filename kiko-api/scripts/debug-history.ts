
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });

// Helper to dynamic import services
const importServices = async () => {
    const alchemy = await import('../src/services/alchemy.js');
    const scanApi = await import('../src/services/scanApi.js');
    return { alchemy, scanApi };
};

async function main() {
    const { alchemy, scanApi } = await importServices();

    console.log('--- Debugging Transaction History ---');

    // 1. Test Solana History
    const solanaAddress = 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg';
    console.log(`\nTesting Solana Address: ${solanaAddress}`);
    try {
        const solTxs = await alchemy.getWalletTransactions(solanaAddress, { chain: 'solana' });
        console.log(`Solana Transactions Found: ${solTxs.length}`);
        if (solTxs.length > 0) {
            console.log('Sample Solana Tx:', JSON.stringify(solTxs[0], null, 2));
        } else {
            console.log('No Solana transactions found. Logic might use fallback?');
        }
    } catch (error: any) {
        console.error('Solana Fetch Error:', error.message);
    }

    // 2. Test Base History via Alchemy Wrapper (to test fallback)
    const baseAddress = '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E';
    console.log(`\nTesting Base Address: ${baseAddress}`);
    try {
        // Use alchemy.getWalletTransactions to test the ScanAPI -> Fallback flow
        const baseTxs = await alchemy.getWalletTransactions(baseAddress, { chain: 'base' });
        console.log(`Base Transactions Found: ${baseTxs.length}`);
        if (baseTxs.length > 0) {
            console.log('Sample Base Tx:', JSON.stringify(baseTxs[0], null, 2));
        } else {
            console.log('Base transactions empty even after fallback.');
        }
    } catch (error: any) {
        console.error('Base Fetch Error:', error.message);
    }
}

main().catch(console.error);
