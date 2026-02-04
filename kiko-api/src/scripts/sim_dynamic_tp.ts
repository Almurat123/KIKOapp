
import { DynamicTakeProfitService, DynamicTPConfig } from '../services/dynamicTakeProfitService.js';

// Mock Position and Config
const mockPosition = {
    id: 'test-pos-1',
    userId: 'user-1',
    tokenAddress: '0x123',
    tokenSymbol: 'TEST',
    chainId: 8453,
    entryPrice: 1.0,
    peakPrice: 2.0, // Peak +100%
    priceHistory: [], // Will be populated
    config: {
        enableDynamicTP: true,
        dynamicTPMinProfitPct: 100,
        enableDynamicTPConfig: true, // Some duplicate field handling in service?
    }
};

async function testScenario() {
    console.log('🧪 Starting Dynamic TP Simulation...');

    // Scenario 1: Price drops slightly (Normal fluctuation)
    // Peak: 2.0, ATR: small. Expected: HOLD
    console.log('\n--- Scenario 1: Normal Drawdown ---');
    const result1 = await DynamicTakeProfitService.checkDynamicTP(
        mockPosition as any,
        1.9 // -5% from peak
    );
    console.log(`Price 1.9 (Peak 2.0): ${result1.shouldSell ? 'SELL 🔴' : 'HOLD 🟢'} (${result1.reason})`);

    // Scenario 2: Chandelier Exit Trigger
    // Peak: 2.0. Drop to 1.5 (-25%). Assuming ATR is tight.
    console.log('\n--- Scenario 2: Chandelier Exit ---');
    // Pre-populate history to generate ATR
    // Create a history with high volatility to increase ATR? Or low to trigger tight stop?
    // Let's manually force a trigger by dropping price significantly below implicit stop
    // Note: service calculates ATR from history. Empty history = 0 ATR? 
    // Let's inject history.
    const history = [];
    for (let i = 0; i < 20; i++) {
        history.push({
            timestamp: Date.now() - i * 60000,
            price: 2.0, high: 2.05, low: 1.95, close: 2.0
        });
    }
    mockPosition.priceHistory = history as any;

    const result2 = await DynamicTakeProfitService.checkDynamicTP(
        mockPosition as any,
        1.4 // Big drop
    );
    console.log(`Price 1.4 (Peak 2.0): ${result2.shouldSell ? 'SELL 🔴' : 'HOLD 🟢'} (${result2.reason})`);


    // Scenario 3: Rapid Decline (Rug Pull)
    console.log('\n--- Scenario 3: Rug Pull Detection ---');
    // Construct history with rapid drops
    const rugHistory = [];
    let price = 2.0;
    for (let i = 0; i < 4; i++) {
        // Drop 15% each step
        const newPrice = price * 0.85;
        rugHistory.push({
            timestamp: Date.now() - (3 - i) * 60000,
            price: newPrice, high: price, low: newPrice, close: newPrice
        });
        price = newPrice;
    }
    mockPosition.priceHistory = rugHistory as any;

    const result3 = await DynamicTakeProfitService.checkDynamicTP(
        mockPosition as any,
        price // Current low price
    );
    console.log(`Rapid Drop Sequence: ${result3.shouldSell ? 'SELL 🔴' : 'HOLD 🟢'} (${result3.reason}) - Urgency: ${result3.urgency}`);

}

testScenario().catch(console.error);
