/**
 * Comprehensive AI Tools Data Validation Script
 * Tests all registered tools with REAL API calls and validates responses
 * 
 * Run with: npx tsx scripts/test-ai-tools-data.ts
 */

import { toolRegistry } from '../src/tools/index.js';
import { getTrendingEvents, getTrendingMarkets } from '../src/services/polymarket.js';
import prisma from '../src/lib/prisma.js';

interface TestResult {
    name: string;
    status: 'PASS' | 'FAIL' | 'SKIP';
    dataReceived: boolean;
    sampleData?: any;
    error?: string;
    duration: number;
}

// Registry of test params or async generators for them
const TEST_PARAMS_GENERATORS: Record<string, () => Promise<any> | any> = {
    // --- MARKET DATA ---
    'get_token_info': { address: '0x4200000000000000000000000000000000000006', chain: 'base' },
    'get_trending_tokens': { chain: 'base', limit: 5 },
    'get_market_overview': {},
    'get_token_price': { symbol: 'ETH' }, // SOL failing on Binance, ETH might work or fail too if strict geoblock
    'get_historical_price': { symbol: 'BTC', date: '2024-01-01' },
    'get_gas_price': { chain: 'ethereum' },
    'get_economic_calendar': {},

    // --- WALLET & PERSONAL ---
    'get_wallet_info': { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', chain: 'ethereum' }, // Vitalik
    'get_user_favorites': {},

    // --- TRADING & SAFETY ---
    'check_token_risk': { address: '0x4200000000000000000000000000000000000006', chain: 'base' }, // WETH on Base
    'prepare_swap_transaction': {
        token_in: 'ETH',
        token_out: 'USDC',
        amount_in: '0.001',
        chain_id: 8453,
        execute: false // SAFETY: Do not execute
    },

    // --- SOCIAL (FARCASTER) ---
    'get_trending_casts': { limit: 5 },
    'get_farcaster_user': { fid: 3, include_casts: true }, // dwr.eth
    'search_farcaster_casts': { query: 'crypto', limit: 5 },

    // --- COPY TRADING (LOCAL DB) ---
    'create_copy_trade_config': {
        target_wallet: '0x1234567890123456789012345678901234567890', // Fake address
        buy_amount_usd: 10,
        chain_id: 8453
    },
    'list_copy_trade_configs': {},
    'pause_copy_trade_config': {
        target_wallet: '0x1234567890123456789012345678901234567890',
        action: 'pause'
    },
    'delete_copy_trade_config': {
        target_wallet: '0x1234567890123456789012345678901234567890'
    },

    // --- POLYMARKET (PREDICTION) ---
    'get_polymarket_trending': { limit: 3 },
    'get_polymarket_trending_markets': { limit: 3 },
    'get_new_markets': { limit: 3 },
    'search_polymarket': { query: 'US', limit: 3 },

    // Dynamic: Needs a real event ID
    'get_polymarket_event': async () => {
        try {
            const trending = await getTrendingEvents(1);
            if (trending.events.length > 0) {
                return { event_id: trending.events[0].id };
            }
            return { event_id: '123' }; // Fallback
        } catch (e) {
            return { event_id: '123' };
        }
    },

    // Dynamic: Needs a real market/token ID
    'get_market_activity': async () => {
        try {
            const trending = await getTrendingMarkets(1);
            if (trending.markets.length > 0) {
                // Use a token ID from the first market outcome
                return { token_id: trending.markets[0].outcomes[0] || '123' };
            }
            return { token_id: '123' };
        } catch (e) {
            return { token_id: '123' };
        }
    },

    'get_whale_watch': { min_amount: 500, limit: 5 },

    // --- POLYMARKET COPY TRADE ---
    'create_polymarket_copy_config': {
        target_wallet: '0x9999999999999999999999999999999999999999', // Fake
        bet_size_usd: 5
    },
    'list_polymarket_positions': { status: 'all' },
    'get_polymarket_trader_stats': { wallet: '0x4B378E5c4F5234B36A2e334A0E0Ec58E38a370e0' }, // Random active wallet

    // --- ANALYTICS ---
    'get_token_early_buyers': {
        tokenAddress: '0x4200000000000000000000000000000000000006',
        chain: 'base'
    },

    // --- UTILITY ---
    'web_search': { query: 'DeepSeek LLM release date' },
};


async function testToolWithData(toolName: string, paramsGenerator: any): Promise<TestResult> {
    const startTime = Date.now();

    try {
        // Resolve params if it's a generator function
        let params = paramsGenerator;
        if (typeof paramsGenerator === 'function') {
            process.stdout.write(' (fetching dynamic params)... ');
            params = await paramsGenerator();
        }

        console.log(`\n   Params: ${JSON.stringify(params)}`);

        // Execute Tool
        // Use walletAddress instead of userAddress to match tool context expectations
        const result = await toolRegistry.execute(toolName, params, {
            userId: 'test-admin-user', // Simulated Auth
            walletAddress: '0xTestUserAddress',
            chainId: 8453,
        });

        const duration = Date.now() - startTime;
        const hasData = result !== null && result !== undefined;
        // Some tools return explicit error objects/messages instead of throwing
        const hasErrorField = result && (result.error || (result.success === false && result.message));

        return {
            name: toolName,
            status: hasErrorField ? 'FAIL' : 'PASS',
            dataReceived: hasData,
            sampleData: typeof result === 'object' ?
                JSON.stringify(result).substring(0, 300) + '...' : result,
            error: hasErrorField ? (result.error || result.message) : undefined,
            duration,
        };
    } catch (error: any) {
        return {
            name: toolName,
            status: 'FAIL',
            dataReceived: false,
            error: error.message,
            duration: Date.now() - startTime,
        };
    }
}

async function runAllTests() {
    console.log('🧪 Comprehensive AI Tools Functional Test\n');
    console.log('='.repeat(70));

    // --- SETUP: Create Test User ---
    try {
        console.log('[Setup] Creating test user "test-admin-user"...');
        await prisma.user.upsert({
            where: { privyDid: 'test-admin-user' },
            create: { privyDid: 'test-admin-user', walletAddress: '0xTestUserAddress' },
            update: { walletAddress: '0xTestUserAddress' }
        });
        console.log('[Setup] Test user verified.');
    } catch (e: any) {
        console.warn('[Setup] Warning: Could not upsert test user:', e.message);
    }

    const tools = toolRegistry.getAllTools();
    console.log(`\n📦 Found ${tools.length} registered tools`);

    const results: TestResult[] = [];

    // Order matters for copy trade: Create -> List -> Pause -> Delete
    // Sort tools to ensure logical execution order where needed using a priority list
    const EXECUTION_ORDER = [
        'create_copy_trade_config',
        'list_copy_trade_configs',
        'pause_copy_trade_config',
        // 'delete_copy_trade_config' // Move to end or run last to ensure cleanup
    ];

    const orderedTools = [...tools].sort((a, b) => {
        const indexA = EXECUTION_ORDER.indexOf(a.definition.name);
        const indexB = EXECUTION_ORDER.indexOf(b.definition.name);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1; // A comes first
        if (indexB !== -1) return 1;  // B comes first
        return 0;
    });

    // Ensure delete runs last
    const deleteToolIdx = orderedTools.findIndex(t => t.definition.name === 'delete_copy_trade_config');
    if (deleteToolIdx !== -1) {
        const [deleteTool] = orderedTools.splice(deleteToolIdx, 1);
        orderedTools.push(deleteTool);
    }

    for (const tool of orderedTools) {
        const toolName = tool.definition.name;
        const generator = TEST_PARAMS_GENERATORS[toolName];

        process.stdout.write(`\n🔄 Testing: ${toolName}...`);

        if (!generator) {
            console.log(` ⚠️ SKIP: No test params defined in script`);
            results.push({ name: toolName, status: 'SKIP', dataReceived: false, duration: 0 });
            continue;
        }

        const result = await testToolWithData(toolName, generator);
        results.push(result);

        if (result.status === 'PASS') {
            console.log(` ✅ PASS (${result.duration}ms)`);
        } else {
            console.log(` ❌ FAIL: ${result.error || 'Unknown error'}`);
        }
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY\n');

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const skipped = results.filter(r => r.status === 'SKIP').length;

    console.log(`✅ Passed:  ${passed}`);
    console.log(`❌ Failed:  ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`📦 Total:   ${results.length}`);

    if (failed > 0) {
        console.log('\n⚠️  Failed Tools Details:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`   - ${r.name}: ${r.error}`);
        });
    }
}

runAllTests().catch(console.error);
