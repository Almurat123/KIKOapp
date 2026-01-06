/**
 * Compare our HMAC signature with the SDK's implementation
 */

import 'dotenv/config';
import crypto from 'crypto';
import { ethers } from 'ethers';

// Our implementation
function ourHmacSignature(
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

// SDK implementation (copied from SDK source)
async function buildPolyHmacSignature(
    secret: string,
    timestamp: number,
    method: string,
    requestPath: string,
    body?: string
): Promise<string> {
    let message = timestamp + method + requestPath;
    if (body !== undefined) {
        message += body;
    }

    // Sanitize base64
    const sanitizedBase64 = secret
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .replace(/[^A-Za-z0-9+/=]/g, '');

    const binaryString = atob(sanitizedBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const keyData = bytes.buffer;

    const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const messageBuffer = new TextEncoder().encode(message);
    const signatureBuffer = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);

    // Convert to base64
    const signatureBytes = new Uint8Array(signatureBuffer);
    let binary = '';
    for (let i = 0; i < signatureBytes.byteLength; i++) {
        binary += String.fromCharCode(signatureBytes[i]);
    }
    const sig = btoa(binary);

    // URL-safe base64
    return sig.replace(/\+/g, '-').replace(/\//g, '_');
}

async function compare() {
    console.log('=== Compare HMAC Implementations ===\n');

    const secret = process.env.POLYMARKET_API_SECRET!;
    const timestamp = Math.floor(Date.now() / 1000);
    const method = 'GET';
    const path = '/auth/api-keys';

    console.log('Secret (first 10 chars):', secret.slice(0, 10) + '...');
    console.log('Secret ends with:', secret.slice(-5));
    console.log('Timestamp:', timestamp);
    console.log('Method:', method);
    console.log('Path:', path);

    const ourSig = ourHmacSignature(secret, timestamp.toString(), method, path, '');
    const sdkSig = await buildPolyHmacSignature(secret, timestamp, method, path, undefined);

    console.log('\nOur signature:', ourSig);
    console.log('SDK signature:', sdkSig);
    console.log('Match:', ourSig === sdkSig ? '✅ YES' : '❌ NO');

    // Also test what we're actually sending
    console.log('\n--- Test actual request ---');
    const apiKey = process.env.POLYMARKET_API_KEY;
    const passphrase = process.env.POLYMARKET_PASSPHRASE;

    console.log('API Key:', apiKey);
    console.log('Passphrase:', passphrase);

    // Check for any whitespace or hidden chars
    console.log('\nChecking for hidden characters:');
    console.log('API Key has leading/trailing space:', apiKey !== apiKey?.trim());
    console.log('Secret has leading/trailing space:', secret !== secret?.trim());
    console.log('Passphrase has leading/trailing space:', passphrase !== passphrase?.trim());
}

compare().catch(console.error);
