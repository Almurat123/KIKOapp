
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const key = process.env.SOLSCAN_API_KEY;
const address = 'vines1vzrYbzduYv9bP5M5C9gGmgM9X8w1f4G5X';
const tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

async function testSolscanEndpoints() {
    console.log(`Testing Key: ${key?.slice(0, 10)}...`);

    // Test 1: Pro API v2
    const proUrl = `https://pro-api.solscan.io/v2.0/account/transactions?address=${address}&limit=5`;
    console.log('\n--- Testing Pro API v2 (Account Txs) ---');
    try {
        const res = await fetch(proUrl, { headers: { 'token': key || '' } });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data).slice(0, 200));
    } catch (e: any) { console.error('Error:', e.message); }

    // Test 2: Pro API v2 Metadata
    const metaUrl = `https://pro-api.solscan.io/v2.0/token/meta?address=${tokenAddress}`;
    console.log('\n--- Testing Pro API v2 (Metadata) ---');
    try {
        const res = await fetch(metaUrl, { headers: { 'token': key || '' } });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data).slice(0, 200));
    } catch (e: any) { console.error('Error:', e.message); }

    // Test 3: Legacy Public API v1 (What was in etherscan.ts)
    const legacyUrl = `https://public-api.solscan.io/token/meta?tokenAddress=${tokenAddress}`;
    console.log('\n--- Testing Legacy Public API ---');
    try {
        const res = await fetch(legacyUrl, { headers: { 'token': key || '' } });
        console.log(`Status: ${res.status}`);
        const data = await res.json();
        console.log('Response:', JSON.stringify(data).slice(0, 200));
    } catch (e: any) { console.error('Error:', e.message); }
}

testSolscanEndpoints();
