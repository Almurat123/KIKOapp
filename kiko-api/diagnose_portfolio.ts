import { getPortfolio } from './src/services/alchemy.ts';
import dotenv from 'dotenv';
dotenv.config();

const address = '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E';
const solanaAddress = 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg';
const chains = ['eth', 'base', 'arbitrum', 'optimism', 'polygon', 'bsc', 'solana'];

async function test() {
    console.log('--- STARTING DIAGNOSTIC (Target: ' + address + ') ---');
    try {
        const results = await getPortfolio(address, chains, solanaAddress);
        for (const [chain, data] of Object.entries(results)) {
            console.log(`\n[${chain.toUpperCase()}]`);
            console.log(`  Native Balance: ${data.ethBalanceFormatted} (${data.ethBalance})`);
            console.log(`  Native Price: $${(data as any).ethPrice}`);
            console.log(`  Tokens: ${data.tokens.length}`);
            data.tokens.forEach((t: any) => {
                if (parseFloat(t.balance || t.tokenBalance) > 0) {
                    console.log(`    - ${t.symbol}: ${t.balance || t.tokenBalance} (Price: $${t.price})`);
                }
            });
        }
    } catch (e) {
        console.error('Test failed:', e);
    }
    console.log('\n--- END DIAGNOSTIC ---');
}

test();
