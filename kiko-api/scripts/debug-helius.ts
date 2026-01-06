import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const key = process.env.HELIUS_API_KEY;
const addresses = [
    'vines1vzrYbzduYv9bP5M5C9gGmgM9X8w1f4G5X', // MrBeast (High volume)
    'HwK9W...'.replace('...', 'p7Y7r8o8o8o8o8o8o8o8o8o8o8o8o8o'), // Dummy
    'JUP6LkbZbjS1jKKppis96mteunV5AEMc4m18XasS54N', // Jupiter
    'Gv5Cyk3tL1f8DkR6bMxE8u9E7U5f8u8u8u8u8u8u8u8' // Another
];

async function testHelius() {
    console.log(`Testing Helius Key: ${key?.slice(0, 10)}...`);

    for (const address of addresses) {
        console.log(`\n\n>>> TESTING ADDRESS: ${address} <<<`);

        // Test 1: JSON-RPC (New preferred way)
        console.log(`\n--- Testing JSON-RPC (getTransactionsForAddress) ---`);
        try {
            const url = `https://mainnet.helius-rpc.com/?api-key=${key}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTransactionsForAddress',
                    params: [address, { limit: 5 }]
                })
            });
            console.log(`Status: ${res.status}`);
            const data = await res.json();
            console.log('Response:', JSON.stringify(data).slice(0, 200));
        } catch (e: any) { console.error('Error:', e.message); }

        // Test 2: REST (Old way)
        const v = 'v0';
        const url = `https://api.helius.xyz/${v}/addresses/${address}/transactions?api-key=${key}`;
        console.log(`\n--- Testing REST ${v} URL ---`);
        try {
            const res = await fetch(url);
            console.log(`Status: ${res.status}`);
            const data = await res.json();
            console.log('Response:', JSON.stringify(data).slice(0, 200));
        } catch (e: any) { console.error('Error:', e.message); }
    }
}

testHelius();
