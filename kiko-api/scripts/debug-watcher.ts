
import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { checkWalletNow, startWatcher, stopWatcher } from '../src/services/watcherService';
import { onSwapDetected } from '../src/services/watcherService';
import { DecodedSwap } from '../src/services/txDecoder';

const TARGET_WALLET = '0x2cd32fb42748774fafde72d8607f16ccc5f5c0ed';
const CHAIN_ID = 8453; // Base

async function main() {
    console.log('🔍 Debug Watcher Script Started');

    // 1. Check Env Vars
    console.log('Checking Environment Variables...');
    if (!process.env.ALCHEMY_API_KEY) {
        console.error('❌ Missing ALCHEMY_API_KEY');
    } else {
        console.log('✅ ALCHEMY_API_KEY is set');
    }

    if (!process.env.DATABASE_URL) {
        console.error('❌ Missing DATABASE_URL');
    } else {
        console.log('✅ DATABASE_URL is set');
    }

    // 2. Check Database for TrackedWallet
    console.log(`\nChecking database for wallet: ${TARGET_WALLET}...`);
    const trackedWallet = await prisma.trackedWallet.findUnique({
        where: { address: TARGET_WALLET.toLowerCase() }
    });

    if (!trackedWallet) {
        console.warn(`⚠️  Wallet ${TARGET_WALLET} is NOT in TrackedWallet table!`);
        console.warn('   This means the COPY TRADE CONFIG was created, but the WATCHER did not register the wallet tracking.');
    } else {
        console.log(`✅ Found TrackedWallet entry:`, trackedWallet);
        if (trackedWallet.activeConfigs <= 0) {
            console.warn(`⚠️  activeConfigs is ${trackedWallet.activeConfigs}, so watcher might skip it.`);
        }
    }

    // 3. Register a dummy callback to receive the swap
    console.log('\nRegistering swap callback...');
    onSwapDetected(async (targetWallet, swap, chainId) => {
        console.log('\n🎉 SWAP DETECTED IN CALLBACK!');
        console.log('Target:', targetWallet);
        console.log('Token In:', swap.tokenIn);
        console.log('Token Out:', swap.tokenOut);
        console.log('Amount In:', swap.amountIn);
        console.log('DEX:', swap.dexName);
    });

    // 4. Manually trigger checkWalletNow
    console.log(`\nTriggering checkWalletNow for ${TARGET_WALLET}...`);
    try {
        await checkWalletNow(TARGET_WALLET, CHAIN_ID);
        console.log('✅ checkWalletNow completed.');
    } catch (error) {
        console.error('❌ Error in checkWalletNow:', error);
    }

    console.log('\nScript finished.');
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
