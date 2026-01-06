/**
 * Generate fresh API credentials using the official SDK method
 * Based on Polymarket docs: https://docs.polymarket.com/developers/CLOB/quickstart
 */

import 'dotenv/config';
import { ClobClient } from '@polymarket/clob-client';

async function generateApiCredentials() {
    console.log('=== Generate Polymarket API Credentials ===\n');

    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.log('❌ PRIVATE_KEY not set in .env');
        return;
    }

    // Use ethers v5 Wallet as required by the SDK
    const { Wallet } = await import('@ethersproject/wallet');
    const signer = new Wallet(privateKey);

    console.log('Signer Address:', signer.address);
    console.log('Funder Address:', process.env.POLYMARKET_FUNDER_ADDRESS || 'Not set');
    console.log('');

    try {
        console.log('Creating L1-authenticated client...');

        // Create client with just signer (L1 auth)
        const tempClient = new ClobClient(
            'https://clob.polymarket.com',
            137, // Polygon
            signer
        );

        console.log('Calling createOrDeriveApiKey()...');
        console.log('(This uses L1 auth to create or retrieve existing API credentials)\n');

        // This method:
        // 1. Signs an EIP-712 message with your private key
        // 2. Creates new API credentials OR retrieves existing ones
        const apiCreds = await tempClient.createOrDeriveApiKey();

        console.log('✅ SUCCESS! API Credentials obtained:\n');
        console.log('POLYMARKET_API_KEY=' + (apiCreds.key || apiCreds.apiKey));
        console.log('POLYMARKET_API_SECRET=' + (apiCreds.secret));
        console.log('POLYMARKET_PASSPHRASE=' + (apiCreds.passphrase));

        console.log('\n📋 Copy these to your .env file!');
        console.log('(Remember to add double quotes if the secret contains special characters)');

    } catch (error: any) {
        console.error('❌ Error generating API credentials:');
        if (error.response?.data) {
            console.error('   Response:', JSON.stringify(error.response.data));
        } else if (error.error) {
            console.error('   Error:', error.error);
        } else {
            console.error('   Message:', error.message);
        }

        console.log('\n💡 Troubleshooting:');
        console.log('1. Make sure your PRIVATE_KEY is correct');
        console.log('2. Ensure the wallet has interacted with Polymarket before');
        console.log('3. Check if you have a Polymarket account with this wallet');
    }
}

generateApiCredentials().catch(console.error);
