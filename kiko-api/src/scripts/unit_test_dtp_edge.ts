
import { DynamicTakeProfitService } from '../services/dynamicTakeProfitService.js';
import { logger } from '../utils/logger.js';

async function testEdgeCases() {
    console.log('=== Dynamic Take Profit Edge Case Tests ===\n');

    // Mock logger to avoid spam
    // @ts-ignore
    logger.warn = (code, msg) => console.log(`[WARN] ${msg}`);
    // @ts-ignore
    logger.error = (code, msg) => console.log(`[ERROR] ${msg}`);

    // Test 1: Invalid Current Price (<= 0)
    console.log('🧪 Test 1: Invalid Current Price (0)');
    const mockPos1: any = {
        id: 'mock-edge-1',
        entryPrice: 1000,
        config: { enableDynamicTP: true }
    };
    const res1 = await DynamicTakeProfitService.checkDynamicTP(mockPos1, 0);
    console.log(`  Result: shouldSell=${res1.shouldSell}, reason="${res1.reason}"`);
    if (!res1.shouldSell && res1.reason.includes('Invalid price')) console.log('✅ PASS');
    else console.log('❌ FAIL');

    // Test 2: Invalid Entry Price (0)
    console.log('\n🧪 Test 2: Invalid Entry Price (0)');
    const mockPos2: any = {
        id: 'mock-edge-2',
        entryPrice: 0,
        config: { enableDynamicTP: true }
    };
    const res2 = await DynamicTakeProfitService.checkDynamicTP(mockPos2, 1200);
    console.log(`  Result: shouldSell=${res2.shouldSell}, reason="${res2.reason}"`);
    if (!res2.shouldSell && res2.reason.includes('Invalid entry')) console.log('✅ PASS');
    else console.log('❌ FAIL');

    // Test 3: Corrupted Price History
    console.log('\n🧪 Test 3: Corrupted Price History');
    const mockPos3: any = {
        id: 'mock-edge-3',
        entryPrice: 1000,
        priceHistory: ['invalid', null, { timestamp: Date.now(), price: 1100 }], // Mixed bad data
        config: { enableDynamicTP: true }
    };
    try {
        const res3 = await DynamicTakeProfitService.checkDynamicTP(mockPos3, 1200);
        console.log(`  Result: shouldSell=${res3.shouldSell}, reason="${res3.reason}"`);
        console.log('✅ PASS (Did not crash)');
    } catch (e) {
        console.log('❌ FAIL (Crashed)', e);
    }

    console.log('\n=== Test Summary ===');
}

testEdgeCases().catch(console.error).finally(() => process.exit(0));
