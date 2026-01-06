
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Load .env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
    console.log('🔍 Verifying Coinbase CDP API Keys...');

    const apiKeyId = process.env.COINBASE_CDP_API_KEY_NAME || process.env.COINBASE_CDP_API_KEY_ID;
    const apiKeySecret = process.env.COINBASE_CDP_API_KEY_PRIVATE_KEY || process.env.COINBASE_CDP_API_KEY_SECRET;

    if (!apiKeyId || !apiKeySecret) {
        console.error('❌ ERROR: API Keys not found in .env');
        process.exit(1);
    }

    // Handle potentially escaped newlines
    const normalizedSecret = apiKeySecret.replace(/\\n/g, '\n');

    console.log(`✅ Found API Key ID: ${apiKeyId.substring(0, 5)}...`);
    console.log(`✅ Found Secret Key (length: ${normalizedSecret.length})`);

    try {
        const { generateJwt } = await import('@coinbase/cdp-sdk/auth');

        // --- EVM TEST ---
        {
            console.log('\n--- EVM TEST ---');
            const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik
            const network = 'ethereum';
            const requestPath = `/platform/v2/evm/token-balances/${network}/${address}`;
            const url = `https://api.cdp.coinbase.com${requestPath}`;

            console.log(`🔑 Generating JWT for ${url}...`);
            const jwt = await generateJwt({
                apiKeyId,
                apiKeySecret: normalizedSecret,
                requestMethod: 'GET',
                requestHost: 'api.cdp.coinbase.com',
                requestPath,
                expiresIn: 120,
            });

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${jwt}` },
            });

            if (!response.ok) {
                console.error(`❌ EVM API Error: ${response.status} ${response.statusText}`);
                console.error(await response.text());
            } else {
                console.log('✅ EVM Request Successful!');
                const json = await response.json();
                console.log(`💰 EVM Token Count: ${json.balances?.length}`);
            }
        }

        // --- SOLANA TEST (network='solana') ---
        {
            console.log('\n--- SOLANA TEST (network="solana") ---');
            // Random active Solana address (Binance hot wallet or similar)
            const solAddress = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
            const network = 'solana';
            const requestPath = `/platform/v2/solana/token-balances/${network}/${solAddress}`;
            const url = `https://api.cdp.coinbase.com${requestPath}`;

            const jwt = await generateJwt({
                apiKeyId,
                apiKeySecret: normalizedSecret,
                requestMethod: 'GET',
                requestHost: 'api.cdp.coinbase.com',
                requestPath,
                expiresIn: 120,
            });

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${jwt}` },
            });

            if (!response.ok) {
                console.error(`❌ Solana ("solana") Error: ${response.status} ${response.statusText}`);
                console.error(await response.text());
            } else {
                console.log('✅ Solana ("solana") Request Successful!');
            }
        }

        // --- SOLANA TEST (network='solana-mainnet') ---
        {
            console.log('\n--- SOLANA TEST (network="solana-mainnet") ---');
            const solAddress = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1';
            const network = 'solana-mainnet';
            const requestPath = `/platform/v2/solana/token-balances/${network}/${solAddress}`;
            const url = `https://api.cdp.coinbase.com${requestPath}`;

            const jwt = await generateJwt({
                apiKeyId,
                apiKeySecret: normalizedSecret,
                requestMethod: 'GET',
                requestHost: 'api.cdp.coinbase.com',
                requestPath,
                expiresIn: 120,
            });

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${jwt}` },
            });

            if (!response.ok) {
                console.error(`❌ Solana ("solana-mainnet") Error: ${response.status} ${response.statusText}`);
                console.error(await response.text());
            } else {
                console.log('✅ Solana ("solana-mainnet") Request Successful!');
            }
        }

        // --- ALCHEMY TEST ---
        {
            console.log('\n--- ALCHEMY TEST ---');
            const alchemyKey = process.env.ALCHEMY_API_KEY;
            const alchemyUrl = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;
            const alchemyRes = await fetch(alchemyUrl, {
                method: 'POST',
                body: JSON.stringify({
                    id: 1, method: "eth_getBalance", params: ["0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "latest"]
                })
            });
            if (alchemyRes.ok) console.log('✅ Alchemy EVM Request Successful!');
            else console.error('❌ Alchemy EVM Failed');

            // Test Alchemy Solana (for fallback)
            const alcSolUrl = `https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`;
            console.log(`\n🌐 Making Alchemy Solana Request to ${alcSolUrl}...`);
            try {
                const alcSolRes = await fetch(alcSolUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: 1, jsonrpc: "2.0", method: "getBalance", params: ["5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1"]
                    })
                });
                const alcSolJson = await alcSolRes.json();
                if (alcSolJson.result) {
                    console.log(`✅ Alchemy Solana Request Successful! Balance: ${alcSolJson.result.value} lamports`);
                } else {
                    console.error('❌ Alchemy Solana Failed:', alcSolJson);
                }
            } catch (e) { console.error(e); }
        }

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
    }
}

main();
```
