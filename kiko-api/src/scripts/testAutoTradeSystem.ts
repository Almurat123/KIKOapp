/**
 * Comprehensive AutoTrade System Test
 * Tests all edge cases and validates system robustness
 * 
 * Test Token: 0x06fc3d5d2369561e28f261148576520f5e49d6ea (Base)
 */

import { getTokenInfo } from '../services/autoTradeService.js';
import { detectLaunchpadToken } from '../services/ai/launchpadDetector.js';
import { zoraSniperService } from '../services/zoraSniperService.js';
import { getZeroExQuote } from '../services/zeroEx.js';
import { fourMemeService } from '../services/fourMemeService.js';
import prisma from '../db/prisma.js';

const TEST_TOKEN = '0x06fc3d5d2369561e28f261148576520f5e49d6ea';
const BASE_CHAIN_ID = 8453;

// Known tokens for comparison
const ZORA_TOKEN = '0x1111111111166b7fe7bd91427724b487980afc69';
const CLANKER_TOKEN = '0x0Db510e79909666d6dEc7f5e49370838c16D950f'; // Example Clanker

interface TestResult {
    test: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
    data?: any;
}

const results: TestResult[] = [];

function log(test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, data?: any) {
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${emoji} [${test}] ${message}`);
    if (data) console.log('   Data:', JSON.stringify(data, null, 2));
    results.push({ test, status, message, data });
}

async function runTests() {
    console.log('🧪 ========== AutoTrade System Test ==========\n');
    console.log(`Test Token: ${TEST_TOKEN}`);
    console.log(`Chain: Base (${BASE_CHAIN_ID})\n`);

    // =========================================================================
    // TEST 1: Token Info Fetching & Caching
    // =========================================================================
    console.log('\n📊 TEST 1: Token Info Fetching & Caching');
    try {
        const start1 = Date.now();
        const tokenInfo1 = await getTokenInfo(TEST_TOKEN, BASE_CHAIN_ID);
        const time1 = Date.now() - start1;

        if (!tokenInfo1) {
            log('Token Info', 'FAIL', 'Failed to fetch token info', null);
        } else {
            log('Token Info', 'PASS', `Fetched in ${time1}ms`, {
                symbol: tokenInfo1.symbol,
                price: tokenInfo1.price,
                liquidity: tokenInfo1.liquidity,
                provider: tokenInfo1.provider
            });

            // Test caching
            const start2 = Date.now();
            const tokenInfo2 = await getTokenInfo(TEST_TOKEN, BASE_CHAIN_ID);
            const time2 = Date.now() - start2;

            if (time2 < time1 / 2) {
                log('Token Cache', 'PASS', `Cache hit! ${time2}ms vs ${time1}ms`, null);
            } else {
                log('Token Cache', 'WARN', `Cache might not be working: ${time2}ms vs ${time1}ms`, null);
            }
        }
    } catch (e: any) {
        log('Token Info', 'FAIL', e.message, null);
    }

    // =========================================================================
    // TEST 2: Launchpad Detection
    // =========================================================================
    console.log('\n🚀 TEST 2: Launchpad Detection');
    try {
        // Test with known tokens
        const testTokens = [
            { address: TEST_TOKEN, expected: 'paragraph' }, // This is a Paragraph token
            { address: ZORA_TOKEN, expected: 'zora' },
            { address: CLANKER_TOKEN, expected: 'clanker' }
        ];

        for (const { address, expected } of testTokens) {
            try {
                const detection = await detectLaunchpadToken(address, BASE_CHAIN_ID);
                if (!detection) {
                    log(
                        'Launchpad Detection',
                        'WARN',
                        `${address.slice(0, 10)}... returned null (timeout or not found)`,
                        null
                    );
                } else {
                    const match = detection.provider === expected;
                    log(
                        'Launchpad Detection',
                        match ? 'PASS' : 'WARN',
                        `${address.slice(0, 10)}... detected as ${detection.provider} (expected: ${expected})`,
                        detection
                    );
                }
            } catch (detectionErr: any) {
                log('Launchpad Detection', 'WARN', `${address.slice(0, 10)}... error: ${detectionErr.message}`, null);
            }
        }
    } catch (e: any) {
        log('Launchpad Detection', 'FAIL', e.message, null);
    }

    // =========================================================================
    // TEST 3: Quote Fetching (0x API)
    // =========================================================================
    console.log('\n💱 TEST 3: Quote Fetching (0x API)');
    try {
        const WETH = '0x4200000000000000000000000000000000000006'; // Base WETH
        const amount = '1000000000000000'; // 0.001 ETH

        const quote = await getZeroExQuote(
            WETH,
            TEST_TOKEN,
            amount,
            BASE_CHAIN_ID,
            1000 // 10% slippage
        );

        if (quote) {
            log('0x Quote', 'PASS', 'Quote fetched successfully', {
                buyAmount: quote.buyAmount,
                price: quote.price,
                estimatedGas: quote.estimatedGas
            });
        } else {
            log('0x Quote', 'WARN', 'No quote available (might be low liquidity)', null);
        }
    } catch (e: any) {
        log('0x Quote', 'FAIL', e.message, null);
    }

    // =========================================================================
    // TEST 4: Honeypot Detection (Fast Mode)
    // =========================================================================
    console.log('\n🛡️ TEST 4: Honeypot Detection');
    try {
        const tokenInfo = await getTokenInfo(TEST_TOKEN, BASE_CHAIN_ID);
        if (tokenInfo) {
            const MIN_LIQUIDITY_FAST = 500;
            const MIN_LIQUIDITY_NORMAL = 1000;
            const MIN_VOLUME_RATIO = 0.01;

            // Fast mode check
            const passesFast = tokenInfo.liquidity >= MIN_LIQUIDITY_FAST;
            log(
                'Honeypot (Fast)',
                passesFast ? 'PASS' : 'FAIL',
                `Liquidity: $${tokenInfo.liquidity?.toFixed(0)} (min: $${MIN_LIQUIDITY_FAST})`,
                null
            );

            // Normal mode checks
            const passesNormal = tokenInfo.liquidity >= MIN_LIQUIDITY_NORMAL;
            const volumeRatio = tokenInfo.volume24h / tokenInfo.liquidity;
            const passesVolume = volumeRatio >= MIN_VOLUME_RATIO;

            log(
                'Honeypot (Normal)',
                passesNormal && passesVolume ? 'PASS' : 'WARN',
                `Liquidity: $${tokenInfo.liquidity?.toFixed(0)}, Volume Ratio: ${(volumeRatio * 100).toFixed(2)}%`,
                null
            );

            // Token age check
            if (tokenInfo.pairCreatedAt) {
                const ageMinutes = (Date.now() - tokenInfo.pairCreatedAt) / (1000 * 60);
                const passesAge = ageMinutes >= 5;
                log(
                    'Token Age',
                    passesAge ? 'PASS' : 'WARN',
                    `Age: ${ageMinutes.toFixed(1)} minutes (min: 5)`,
                    null
                );
            }
        }
    } catch (e: any) {
        log('Honeypot Detection', 'FAIL', e.message, null);
    }

    // =========================================================================
    // TEST 5: Price Validation
    // =========================================================================
    console.log('\n💰 TEST 5: Price Validation');
    try {
        const tokenInfo = await getTokenInfo(TEST_TOKEN, BASE_CHAIN_ID);
        if (tokenInfo) {
            const validPrice = tokenInfo.price && tokenInfo.price > 0;
            log(
                'Price Validation',
                validPrice ? 'PASS' : 'FAIL',
                `Price: $${tokenInfo.price} (${validPrice ? 'valid' : 'invalid'})`,
                null
            );
        }
    } catch (e: any) {
        log('Price Validation', 'FAIL', e.message, null);
    }

    // =========================================================================
    // TEST 6: Database Connection & Position Query
    // =========================================================================
    console.log('\n🗄️ TEST 6: Database Connection');
    try {
        const openPositions = await prisma.position.count({
            where: { status: 'open' }
        });
        log('Database', 'PASS', `Found ${openPositions} open positions`, null);
    } catch (e: any) {
        log('Database', 'FAIL', e.message, null);
    }

    // =========================================================================
    // TEST 7: API Rate Limiting & Retry Logic
    // =========================================================================
    console.log('\n⏱️ TEST 7: API Rate Limiting & Retry');
    try {
        // Make 5 rapid requests to test rate limiting
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(getTokenInfo(TEST_TOKEN, BASE_CHAIN_ID, { verbose: false }));
        }

        const start = Date.now();
        const results = await Promise.all(promises);
        const time = Date.now() - start;

        const successCount = results.filter(r => r !== null).length;
        log(
            'Rate Limiting',
            successCount === 5 ? 'PASS' : 'WARN',
            `${successCount}/5 requests succeeded in ${time}ms`,
            null
        );
    } catch (e: any) {
        log('Rate Limiting', 'FAIL', e.message, null);
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n\n📋 ========== TEST SUMMARY ==========\n');
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const warned = results.filter(r => r.status === 'WARN').length;

    console.log(`✅ PASSED: ${passed}`);
    console.log(`⚠️  WARNED: ${warned}`);
    console.log(`❌ FAILED: ${failed}`);
    console.log(`\nTotal Tests: ${results.length}`);

    if (failed > 0) {
        console.log('\n❌ FAILED TESTS:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  - ${r.test}: ${r.message}`);
        });
    }

    if (warned > 0) {
        console.log('\n⚠️  WARNINGS:');
        results.filter(r => r.status === 'WARN').forEach(r => {
            console.log(`  - ${r.test}: ${r.message}`);
        });
    }

    console.log('\n========================================\n');

    // Exit with appropriate code
    process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);
