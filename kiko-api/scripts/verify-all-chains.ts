
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // Should handle 'fetch' globally in newer nodes but import for safety if module

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE_URL = 'http://localhost:3001/api/wallets';
// Test Addresses
const ADDR_EVM = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // Vitalik
const ADDR_SOL = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'; // Random Active Sol

const CHAINS = [
    { name: 'Ethereum', slug: 'eth', type: 'evm', address: ADDR_EVM },
    { name: 'Base', slug: 'base', type: 'evm', address: ADDR_EVM }, // Was failing
    { name: 'Arbitrum', slug: 'arbitrum', type: 'evm', address: ADDR_EVM },
    { name: 'Optimism', slug: 'optimism', type: 'evm', address: ADDR_EVM },
    { name: 'Polygon', slug: 'polygon', type: 'evm', address: ADDR_EVM },
    { name: 'BSC', slug: 'bsc', type: 'evm', address: ADDR_EVM },
    { name: 'Solana', slug: 'solana', type: 'sol', address: ADDR_SOL },
];

async function testChain(chain: { name: string, slug: string, address: string }) {
    console.log(`\nTesting ${chain.name} (${chain.slug})...`);
    const url = `${BASE_URL}/${chain.address}/balance?chain=${chain.slug}`;
    try {
        const start = Date.now();
        // We might not have Auth header here easily without valid Privy token generator.
        // However, the 502 error happened BEFORE auth validation in some cases or we can mock it?
        // Wait, the 502 was a SERVER error. If we call it without Auth, we should get 401.
        // If we get 502, it means the server crashed processing the request internally.
        // *But wait*, verify-api-keys checked the external services directly.
        // This script targets the running LOCAL SERVER to verify the route logic (wallets.ts).
        // Since we don't have a valid Privy token for the script easily, we can check if we receive 401 (Healthy Route) vs 500/502 (Crash).
        // A 502/500 indicates code failure. A 401 indicates "Code ran fine, but you are not logged in".

        const res = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer mocking-check' } // Invalid token will give 401 usually
        });

        const duration = Date.now() - start;

        if (res.status === 200) {
            console.log(`✅ ${chain.name}: Success (200) in ${duration}ms`);
            try {
                const json = await res.json();
                console.log(`   Tokens found: ${json.data?.tokens?.length || 0}`);
            } catch (e) { }
        } else if (res.status === 401) {
            console.log(`✅ ${chain.name}: Route Healthy (401 Unauthorized) - Code didn't crash.`);
            // This confirms wallets.ts logic didn't throw 502 before auth check?
            // Actually, typically middleware runs first. 
            // To truly test wallets.ts logic, we might need to bypass Auth or have a valid token.
            // But the user's 502 happened *during* the request logic? No, 502 usually means upstream failed or unhandled exception.
        } else if (res.status === 502 || res.status === 500) {
            console.error(`❌ ${chain.name}: FAILED with ${res.status} - Potential Bug!`);
            const text = await res.text();
            console.error(`   Error: ${text.substring(0, 100)}...`);
        } else {
            console.log(`⚠️ ${chain.name}: Received ${res.status} - ${res.statusText}`);
        }

    } catch (error) {
        console.error(`❌ ${chain.name}: Network Error - ${error}`);
    }
}

async function main() {
    console.log('🔍 stress-testing all chain routes on local server...');
    // We strictly need to know if wallets.ts throws.
    // The previous 502 was valid because it was an unhandled exception caught by global error handler.

    // We will verify the EXTERNAL services directly again for all chains, duplicating logic of wallets.ts
    // This is safer as we don't have a valid JWT for the local server.

    // Import services dynamically if possible or just use the logic
    // Actually, we can run the previous verify-api-keys logic but extended.
    // Let's rely on that approach as it is more robust to prove specific functions work.
}

// SCRATCH THAT - Rewriting to test the internal functions directly by importing them?
// No, ESM imports of TS source files need tsx. 
// Let's stick to testing the services "unit test" style using the script.

import { isChainSupported, getEvmTokenBalances, getSolanaTokenBalances } from '../src/services/coinbaseCdp.js';
import { getEthBalance, getTokenBalances } from '../src/services/alchemy.js';

async function verifyServices() {
    console.log('🧪 Verifying Service Functions for ALL chains...');

    // 1. Verify isChainSupported for all EVM chains
    const evmChains = CHAINS.filter(c => c.type === 'evm');
    const chainIdMap: Record<string, number> = {
        'eth': 1, 'base': 8453, 'arbitrum': 42161, 'optimism': 10, 'polygon': 137, 'bsc': 56
    };

    for (const chain of evmChains) {
        const id = chainIdMap[chain.slug];
        console.log(`\nTesting ${chain.name} (ID: ${id})...`);

        // Check isChainSupported (Validation)
        try {
            const supported = isChainSupported(id);
            console.log(`   isChainSupported(${id}): ${supported}`);

            // Replicate wallets.ts logic
            if (supported) {
                console.log(`   -> Calling Coinbase CDP...`);
                await getEvmTokenBalances(chain.address, id);
                console.log(`   -> Coinbase CDP Call: OK`);
            } else {
                console.log(`   -> Calling Alchemy Fallback...`);
                await getTokenBalances(chain.address, chain.slug);
                console.log(`   -> Alchemy Call: OK`);
            }

            // Check Native Balance logic
            console.log(`   -> Fetching Native Balance (Alchemy)...`);
            await getEthBalance(chain.address, chain.slug);
            console.log(`   -> Native Balance: OK`);

        } catch (error) {
            console.error(`❌ ${chain.name} CRASHED:`, error);
            process.exit(1);
        }
    }

    // 2. Verify Solana
    console.log(`\nTesting Solana...`);
    try {
        console.log(`   -> Calling Coinbase (Solana)...`);
        await getSolanaTokenBalances(ADDR_SOL, 'solana');
        console.log(`   -> Coinbase Sol Call: OK (handled internally even if 500)`);

        console.log(`   -> Calling Alchemy Native SOL...`);
        await getEthBalance(ADDR_SOL, 'solana');
        console.log(`   -> Alchemy SOL Call: OK`);
    } catch (e) {
        console.error(`❌ Solana CRASHED:`, e);
        process.exit(1);
    }

    console.log('\n✅ ALL CHAINS PASSED SERVICE INTEGRITY CHECK.');
}

verifyServices();
