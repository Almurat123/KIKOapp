
import { DynamicTakeProfitService } from '../services/dynamicTakeProfitService.js';

async function testDynamicTP() {
    console.log('=== 动态止盈单元测试 ===\n');

    // Test 1: Rapid Decline Detection
    console.log('📉 Test 1: 快速下跌检测 (Rapid Decline)');
    const mockPos1: any = {
        id: 'mock-rapid',
        entryPrice: 1000,
        peakPrice: 5000,
        priceHistory: [
            { timestamp: Date.now() - 180000, price: 4000, high: 4000, low: 3500, close: 3500 },
            { timestamp: Date.now() - 120000, price: 3500, high: 3500, low: 3000, close: 3000 },
            { timestamp: Date.now() - 60000, price: 3000, high: 3000, low: 2600, close: 2600 }
        ],
        config: { enableDynamicTP: true, dynamicTPMinProfitPct: 1 }
    };

    const result1 = await DynamicTakeProfitService.checkDynamicTP(mockPos1, 2200);
    console.log(`  结果: ${result1.shouldSell ? '✅ 触发' : '❌ 未触发'}`);
    console.log(`  原因: ${result1.reason}`);
    console.log(`  紧急度: ${result1.urgency}\n`);

    // Test 2: Chandelier Exit
    console.log('📊 Test 2: Chandelier Exit (ATR 追踪止损)');
    const mockPos2: any = {
        id: 'mock-chandelier',
        entryPrice: 1000,
        peakPrice: 5000,
        priceHistory: Array.from({ length: 20 }, (_, i) => ({
            timestamp: Date.now() - (20 - i) * 60000,
            price: 4900 - i * 10,
            high: 4900 - i * 10 + 50,
            low: 4900 - i * 10 - 50,
            close: 4900 - i * 10
        })),
        config: { enableDynamicTP: true, dynamicTPMinProfitPct: 1 }
    };

    const result2 = await DynamicTakeProfitService.checkDynamicTP(mockPos2, 3000);
    console.log(`  结果: ${result2.shouldSell ? '✅ 触发' : '❌ 未触发'}`);
    console.log(`  原因: ${result2.reason}`);
    console.log(`  紧急度: ${result2.urgency}\n`);

    // Test 3: Not Activated (Low Profit)
    console.log('⏸️  Test 3: 未激活 (盈利不足)');
    const mockPos3: any = {
        id: 'mock-inactive',
        entryPrice: 1000,
        peakPrice: 1050,
        priceHistory: [],
        config: { enableDynamicTP: true, dynamicTPMinProfitPct: 100 }
    };

    const result3 = await DynamicTakeProfitService.checkDynamicTP(mockPos3, 1040);
    console.log(`  结果: ${result3.shouldSell ? '✅ 触发' : '❌ 未触发'}`);
    console.log(`  原因: ${result3.reason}\n`);

    // Summary
    console.log('=== 测试总结 ===');
    const passed = [result1.shouldSell, result2.shouldSell, !result3.shouldSell].filter(Boolean).length;
    console.log(`✅ 通过: ${passed}/3`);

    if (passed === 3) {
        console.log('\n🎉 所有测试通过！动态止盈功能正常工作。');
    } else {
        console.log('\n⚠️  部分测试失败，请检查算法逻辑。');
    }
}

testDynamicTP().catch(console.error).finally(() => process.exit(0));
