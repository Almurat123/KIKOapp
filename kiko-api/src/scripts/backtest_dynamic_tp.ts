
import { DynamicTakeProfitService } from '../services/dynamicTakeProfitService.js';
import { callGeckoTerminal } from '../config/unifiedApiService.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

interface BacktestCase {
    symbol: string;
    address: string;
    network: string;
}

const TEST_CASES: BacktestCase[] = [
    { symbol: 'BSC-1', address: '0x617cab4aaae1f8dfb3ee138698330776a1e1b324', network: 'bsc' },
    { symbol: 'BSC-2', address: '0x619940c0f69f1612245f94b7659403623239fb20', network: 'bsc' },
    { symbol: 'BASE-1', address: '0x9f86db9fc6f7c9408e8fda3ff8ce4e78ac7a6b07', network: 'base' },
    { symbol: 'BASE-2', address: '0xb695559b26bb2c9703ef1935c37aeae9526bab07', network: 'base' },
    { symbol: 'BASE-3', address: '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b', network: 'base' },
];

async function getPoolAddress(network: string, tokenAddress: string) {
    const endpoint = `/networks/${network}/tokens/${tokenAddress}/pools`;
    const data: any = await callGeckoTerminal(endpoint);
    return data.data?.[0]?.attributes?.address;
}

async function getOHLCV(network: string, poolAddress: string) {
    // Fetch last 1000 minutes (aggregate=1 means 1 min candles)
    const endpoint = `/networks/${network}/pools/${poolAddress}/ohlcv/minute?aggregate=1&limit=1000`;
    const data: any = await callGeckoTerminal(endpoint);
    return data.data?.attributes?.ohlcv_list || [];
}

async function runBacktest() {
    console.log('# 🚀 Dynamic TP Backtest Report\n');
    console.log('| Token | Max PnL (%) | Triggered? | Exit Reason | Sim Exit Price | Sim Profit | Status |');
    console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

    for (const token of TEST_CASES) {
        try {
            const poolAddress = await getPoolAddress(token.network, token.address);
            if (!poolAddress) {
                console.log(`| ${token.symbol} | - | N/A | Pool Not Found | - | - | ❌ |`);
                continue;
            }

            const rawOhlcv = await getOHLCV(token.network, poolAddress);
            if (rawOhlcv.length === 0) {
                console.log(`| ${token.symbol} | - | N/A | No OHLCV Data | - | - | ❌ |`);
                continue;
            }

            // GeckoTerminal returns [timestamp, open, high, low, close, volume]
            // Order is usually descending (newest first), reverse it for simulation
            const ohlcv = rawOhlcv.reverse();

            // Simulation State
            let entryPrice = ohlcv[0][1]; // Start at first candle's open
            let peakPrice = entryPrice;
            let currentPriceHistory: any[] = [];
            let exitResult: any = null;
            let maxPnL = 0;

            for (const candle of ohlcv) {
                const [ts, op, hi, lo, cl, vol] = candle;

                // Update history (max 20)
                currentPriceHistory.push({
                    timestamp: ts * 1000,
                    price: cl, high: hi, low: lo, close: cl
                });
                if (currentPriceHistory.length > 20) currentPriceHistory.shift();

                // Update Peak Price
                if (cl > peakPrice) peakPrice = cl;

                // Track Max PnL
                const pnl = ((cl - entryPrice) / entryPrice) * 100;
                if (pnl > maxPnL) maxPnL = pnl;

                // Mock Position Object for Service
                const mockPosition = {
                    id: `mock-${token.symbol}`,
                    peakPrice,
                    priceHistory: currentPriceHistory,
                    config: {
                        enableDynamicTP: true,
                        dynamicTPMinProfitPct: 50 // Set lower for backtest visibility
                    },
                    entryPrice
                };

                // Check Trigger
                const result = await DynamicTakeProfitService.checkDynamicTP(mockPosition as any, cl);
                if (result.shouldSell) {
                    exitResult = {
                        price: cl,
                        reason: result.reason,
                        profit: pnl
                    };
                    break;
                }
            }

            if (exitResult) {
                console.log(`| ${token.symbol} | ${maxPnL.toFixed(2)}% | YES | ${exitResult.reason.split(':')[0]} | ${exitResult.price.toFixed(8)} | ${exitResult.profit.toFixed(2)}% | ✅ |`);
            } else {
                const finalPnL = ((ohlcv[ohlcv.length - 1][4] - entryPrice) / entryPrice) * 100;
                console.log(`| ${token.symbol} | ${maxPnL.toFixed(2)}% | NO | Still Holding / Inactive | - | ${finalPnL.toFixed(2)}% | 🟡 |`);
            }

            // Add 1s delay between tokens to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (err: any) {
            console.log(`| ${token.symbol} | ERR | - | ${err.message} | - | - | ❌ |`);
        }
    }
}

runBacktest().catch(console.error);
