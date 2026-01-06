
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // or built-in if node 18+

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
        console.log('Expected: COINBASE_CDP_API_KEY_NAME and COINBASE_CDP_API_KEY_PRIVATE_KEY');
        process.exit(1);
    }

    // Handle potentially escaped newlines in private key
    const normalizedSecret = apiKeySecret; // .replace(/\\n/g, '\n');

    console.log(`✅ Found API Key ID: ${apiKeyId.substring(0, 5)}...`);
    console.log(`✅ Found Secret Key (length: ${normalizedSecret.length})`);

    try {
        console.log('📦 Importing @coinbase/cdp-sdk/auth...');
        const { generateJwt } = await import('@coinbase/cdp-sdk/auth');

        // Test Parameters
        const address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik
        const network = 'ethereum';
        const requestHost = 'api.cdp.coinbase.com';
        const requestPath = `/platform/v2/evm/token-balances/${network}/${address}`;
        const url = `https://${requestHost}${requestPath}`;
        const requestMethod = 'GET';

        console.log(`🔑 Generating JWT for ${requestMethod} ${url}...`);

        const jwt = await generateJwt({
            apiKeyId,
            apiKeySecret: normalizedSecret,
            requestMethod,
            requestHost,
            requestPath,
            expiresIn: 120,
        });

        console.log('✅ JWT Generated successfully.');
        console.log(`🌐 Making API Request to ${url}...`);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${jwt}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
        });

        console.log(`📡 Response Status: ${response.status} ${response.statusText}`);

        const text = await response.text();

        if (!response.ok) {
            console.error('❌ API Warning/Error Response:', text);
            console.log('\n--- Troubleshooting Tips ---');
            console.log('1. Check if the API Key has the "VIEW" permission.');
            console.log('2. Verify the project in Coinbase CDP has "Wallet API" enabled.');
            console.log('3. If 403/401, the key might be invalid or revoked.');
        } else {
            console.log('✅ API Request Successful!');
            console.log('Response Snippet:', text.substring(0, 200) + '...');
            try {
                const json = JSON.parse(text);
                console.log(`💰 Found ${json.balances?.length || 0} token balances.`);
            } catch (e) {
                console.log('Could not parse JSON body.');
            }
        }

    } catch (error) {
        console.error('❌ Unexpected Error:', error);
    }
}

main();
