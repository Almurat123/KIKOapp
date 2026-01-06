/**
 * Test if we can use the CLOB Client SDK to generate fresh API credentials
 */

import 'dotenv/config';
import { ClobClient } from '@polymarket/clob-client';
import { ethers } from 'ethers';

async function regenerateApiKeys() {
    console.log('=== Test API Key Generation with CLOB Client ===\n');

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.log('❌ PRIVATE_KEY not set');
        return;
    }

    // Create ethers wallet
    const wallet = new ethers.Wallet(privateKey);
    console.log('Signer Address:', wallet.address);

    // Create CLOB client with L1 auth (signer only, no creds)
    try {
        // Note: The SDK might need ethers v5 Wallet
        const { Wallet: EthersV5Wallet } = await import('@ethersproject/wallet');
        const signerV5 = new EthersV5Wallet(privateKey);

        console.log('Creating L1-authenticated client...');

        const client = new ClobClient(
            'https://clob.polymarket.com',
            137, // Polygon
            signerV5
        );

        console.log('Attempting to create API key...');

        // Try to create or derive API key
        const creds = await (client as any).createApiKey();
        console.log('✅ New API credentials created!');
        console.log('API Key:', creds.key?.slice(0, 20) + '...');
        console.log('Secret:', creds.secret ? 'present' : 'missing');
        console.log('Passphrase:', creds.passphrase?.slice(0, 20) + '...');

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        console.log('\nThis might be expected if the SDK requires a specific setup.');
        console.log('Please regenerate API keys manually from polymarket.com/settings');
    }
}

regenerateApiKeys().catch(console.error);
