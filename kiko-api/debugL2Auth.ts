/**
 * Debug script to verify L2 HMAC authentication
 */

import 'dotenv/config';
import crypto from 'crypto';

const CLOB_API = 'https://clob.polymarket.com';

// Generate HMAC signature with URL-safe base64
function generateHmacSignature(
    secret: string,
    timestamp: string,
    method: string,
    requestPath: string,
    body: string = ''
): string {
    const message = timestamp + method + requestPath + body;
    const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'base64'));
    hmac.update(message);
    const signature = hmac.digest('base64');
    // URL-safe base64
    return signature.replace(/\+/g, '-').replace(/\//g, '_');
}

async function debug() {
    console.log('=== Debug L2 Authentication ===\n');

    const apiKey = process.env.POLYMARKET_API_KEY;
    const apiSecret = process.env.POLYMARKET_API_SECRET;
    const passphrase = process.env.POLYMARKET_PASSPHRASE;

    if (!apiKey || !apiSecret || !passphrase) {
        console.log('❌ Missing CLOB credentials');
        return;
    }

    console.log('API Key:', apiKey.slice(0, 20) + '...');
    console.log('Secret Length:', apiSecret.length);
    console.log('Passphrase Length:', passphrase.length);

    // Test with a simple GET request (should not require order)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = '/auth/api-keys';

    const signature = generateHmacSignature(apiSecret, timestamp, method, requestPath, '');

    console.log('\nTest Request:');
    console.log('  Timestamp:', timestamp);
    console.log('  Method:', method);
    console.log('  Path:', requestPath);
    console.log('  Signature:', signature.slice(0, 30) + '...');

    // Make request
    const response = await fetch(`${CLOB_API}${requestPath}`, {
        method: 'GET',
        headers: {
            'POLY_API_KEY': apiKey,
            'POLY_PASSPHRASE': passphrase,
            'POLY_TIMESTAMP': timestamp,
            'POLY_SIGNATURE': signature
        }
    });

    const text = await response.text();
    console.log('\nResponse Status:', response.status);
    console.log('Response:', text.slice(0, 500));

    // Also check if we need POLY_ADDRESS for the API key endpoint
    console.log('\n--- Test with POLY_ADDRESS ---');

    const { ethers } = await import('ethers');
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
        const wallet = new ethers.Wallet(privateKey);
        console.log('Wallet Address:', wallet.address);

        const timestamp2 = Math.floor(Date.now() / 1000).toString();
        const signature2 = generateHmacSignature(apiSecret, timestamp2, method, requestPath, '');

        const response2 = await fetch(`${CLOB_API}${requestPath}`, {
            method: 'GET',
            headers: {
                'POLY_ADDRESS': wallet.address,
                'POLY_API_KEY': apiKey,
                'POLY_PASSPHRASE': passphrase,
                'POLY_TIMESTAMP': timestamp2,
                'POLY_SIGNATURE': signature2
            }
        });

        const text2 = await response2.text();
        console.log('Response2 Status:', response2.status);
        console.log('Response2:', text2.slice(0, 500));
    }
}

debug().catch(console.error);
