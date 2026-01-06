/**
 * Test L2 auth using the official CLOB client SDK
 */

import 'dotenv/config';
import { ClobClient } from '@polymarket/clob-client';

async function testWithSdk() {
    console.log('=== Test L2 Auth with Official SDK ===\n');

    const apiKey = process.env.POLYMARKET_API_KEY;
    const apiSecret = process.env.POLYMARKET_API_SECRET;
    const passphrase = process.env.POLYMARKET_PASSPHRASE;
    const funderAddress = process.env.POLYMARKET_FUNDER_ADDRESS;

    if (!apiKey || !apiSecret || !passphrase) {
        console.log('❌ Missing credentials');
        return;
    }

    console.log('API Key:', apiKey);
    console.log('Funder:', funderAddress);

    // Create L2 client with credentials (no signer)
    const creds = {
        key: apiKey,
        secret: apiSecret,
        passphrase: passphrase
    };

    try {
        // Try creating client with just creds (L2 only)
        const client = new ClobClient(
            'https://clob.polymarket.com',
            137,
            undefined, // No signer
            creds
        );

        console.log('\nClient created successfully');
        console.log('Testing GET /auth/api-keys...');

        // Try to get API keys (L2 method)
        const keys = await (client as any).getApiKeys();
        console.log('✅ API Keys retrieved:', keys);

    } catch (error: any) {
        if (error.response) {
            console.error('❌ Request failed:', {
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.error) {
            console.error('❌ Error:', error.error);
        } else {
            console.error('❌ Error:', error.message || error);
        }
    }

    // Also test with signer + creds (L1+L2)
    console.log('\n--- Test with Signer + Creds (L1+L2) ---');

    try {
        const { Wallet: EthersV5Wallet } = await import('@ethersproject/wallet');
        const signer = new EthersV5Wallet(process.env.PRIVATE_KEY!);

        console.log('Signer address:', signer.address);

        const client2 = new ClobClient(
            'https://clob.polymarket.com',
            137,
            signer,
            creds,
            1, // POLY_PROXY signature type
            funderAddress // Funder address
        );

        console.log('Full client created');

        // Try getApiKeys
        const keys = await (client2 as any).getApiKeys();
        console.log('✅ API Keys:', keys);

    } catch (error: any) {
        if (error.response?.data) {
            console.error('❌ Error:', error.response.data);
        } else if (error.error) {
            console.error('❌ Error:', error.error);
        } else {
            console.error('❌ Error:', error.message || error);
        }
    }
}

testWithSdk().catch(console.error);
