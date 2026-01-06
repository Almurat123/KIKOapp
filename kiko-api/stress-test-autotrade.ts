import prisma from './src/lib/prisma';
import * as autoTradeService from './src/services/autoTradeService.js';
import * as tradeExecutor from './src/services/tradeExecutor.js';
import * as solanaExecutor from './src/services/solanaExecutor.js';

// --- Configuration ---
const WALLET_COUNT = 100;
const CONCURRENT_BATCH = 100;
const CHAIN_ID = 8453; // Base

async function setupMockData() {
    console.log(`Setting up ${WALLET_COUNT} mock wallets and configs...`);

    // Check if first wallet exists to skip expensive setup
    const firstCheck = await prisma.trackedWallet.findUnique({
        where: { address_chainId: { address: '0xstress_test_000000000000000000000000000', chainId: CHAIN_ID } }
    });
    if (firstCheck) {
        console.log('Mock data seems already set up, proceeding...');
        return;
    }

    const prefix = '0xSTRESS_TEST_';

    // Process in batches of 10
    for (let i = 0; i < WALLET_COUNT; i += 10) {
        const batch = [];
        for (let j = 0; j < 10 && (i + j) < WALLET_COUNT; j++) {
            const index = i + j;
            const walletAddr = (prefix + index.toString().padStart(27, '0')).toLowerCase();

            batch.push((async () => {
                const user = await prisma.user.upsert({
                    where: { privyDid: `did:privy:stress_${index}` },
                    update: {},
                    create: {
                        privyDid: `did:privy:stress_${index}`,
                        walletAddress: `0xUSER_${index.toString().padStart(33, '0')}`.toLowerCase()
                    }
                });

                await prisma.trackedWallet.upsert({
                    where: { address_chainId: { address: walletAddr, chainId: CHAIN_ID } },
                    update: { activeConfigs: 1 },
                    create: { address: walletAddr, chainId: CHAIN_ID, activeConfigs: 1 }
                });

                const existingConfig = await prisma.copyTradeConfig.findFirst({
                    where: { userId: user.id, targetWallet: walletAddr, chainId: CHAIN_ID }
                });

                if (!existingConfig) {
                    await prisma.copyTradeConfig.create({
                        data: {
                            userId: user.id,
                            targetWallet: walletAddr,
                            chainId: CHAIN_ID,
                            buyAmountUsd: 10,
                            status: 'active',
                            mirrorSell: true
                        }
                    });
                }
            })());
        }
        await Promise.all(batch);
        console.log(`  Set up ${Math.min(i + 10, WALLET_COUNT)}/${WALLET_COUNT}...`);
    }
}

async function runStressTest() {
    console.log('--- STARTING STRESS TEST ---');
    const startTime = Date.now();

    // 1. Mock External Dependencies
    // @ts-ignore
    autoTradeService.getTokenInfo = async () => {
        // Simulate DexScreener delay
        await new Promise(r => setTimeout(r, 100 + Math.random() * 200));
        return { price: 1.0, symbol: 'TEST', decimals: 18 };
    };

    // @ts-ignore
    tradeExecutor.executeSwapInstant = async () => {
        // Simulate execution delay
        await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
        return '0x' + Math.random().toString(16).slice(2);
    };

    // 2. Prepare Tasks
    const tasks = [];
    const results = {
        success: 0,
        fail: 0,
        errors: [] as any[]
    };

    const swapData = {
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: '0xTOKEN_OUT_ADDRESS',
        amountIn: '100000000000000000', // 0.1 ETH
        amountOut: '1000000000000000000',
        router: '0xROUTER',
        dexName: 'Uniswap'
    };

    console.log(`Firing ${CONCURRENT_BATCH} concurrent handleSwapDetected calls...`);

    for (let i = 0; i < CONCURRENT_BATCH; i++) {
        const walletAddr = `0xSTRESS_TEST_${i.toString().padStart(27, '0')}`.toLowerCase();

        const task = (async () => {
            try {
                await autoTradeService.handleSwapDetected(walletAddr, swapData, CHAIN_ID);
                results.success++;
            } catch (err: any) {
                results.fail++;
                results.errors.push(err.message);
            }
        })();
        tasks.push(task);
    }

    // 3. Execute and Measure
    await Promise.all(tasks);

    const endTime = Date.now();
    const durationSec = (endTime - startTime) / 1000;

    console.log('\n--- STRESS TEST RESULTS ---');
    console.log(`Concurrent Wallets: ${CONCURRENT_BATCH}`);
    console.log(`Total Duration: ${durationSec.toFixed(2)}s`);
    console.log(`Throughput: ${(CONCURRENT_BATCH / durationSec).toFixed(2)} trades/sec`);
    console.log(`Success Rate: ${((results.success / CONCURRENT_BATCH) * 100).toFixed(2)}%`);
    console.log(`Failures: ${results.fail}`);

    if (results.fail > 0) {
        console.log('Unique Errors:', [...new Set(results.errors)]);
    }
}

async function main() {
    try {
        await setupMockData();
        await runStressTest();
    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        // Cleanup would go here, but keeping for now
        await prisma.$disconnect();
    }
}

main();
