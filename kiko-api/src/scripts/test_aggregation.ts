
import { DynamicTakeProfitService } from '../services/dynamicTakeProfitService.js';

async function testAggregation() {
    console.log('🧪 Testing 1-Minute Price Aggregation...');

    const mockPosition: any = {
        id: 'mock-test',
        entryPrice: 100,
        peakPrice: 100,
        priceHistory: [],
        config: { enableDynamicTP: true, dynamicTPMinProfitPct: 0 }
    };

    const baseTime = Math.floor(Date.now() / 60000) * 60000;

    // 1. First sample
    console.log('\n--- Sample 1 (Init) ---');
    await DynamicTakeProfitService.checkDynamicTP(mockPosition, 105);
    console.log('History Length:', mockPosition.priceHistory.length);
    console.log('Last Point:', mockPosition.priceHistory[0]);

    // 2. Same minute update (Higher High)
    console.log('\n--- Sample 2 (Same Min, High++ ) ---');
    await DynamicTakeProfitService.checkDynamicTP(mockPosition, 110);
    console.log('History Length:', mockPosition.priceHistory.length);
    console.log('Last Point:', mockPosition.priceHistory[0]);

    // 3. Same minute update (Lower Low)
    console.log('\n--- Sample 3 (Same Min, Low-- ) ---');
    await DynamicTakeProfitService.checkDynamicTP(mockPosition, 102);
    console.log('History Length:', mockPosition.priceHistory.length);
    console.log('Last Point (Target L:102, C:102):', mockPosition.priceHistory[0]);

    // 4. New minute
    console.log('\n--- Sample 4 (New Minute) ---');
    // Simulate timestamp shift by injecting it into history
    mockPosition.priceHistory[0].timestamp -= 60000;
    await DynamicTakeProfitService.checkDynamicTP(mockPosition, 115);
    console.log('History Length (Target: 2):', mockPosition.priceHistory.length);
    console.log('Point 0 (Prev Min):', mockPosition.priceHistory[0]);
    console.log('Point 1 (Curr Min):', mockPosition.priceHistory[1]);
}

testAggregation().catch(console.error);
