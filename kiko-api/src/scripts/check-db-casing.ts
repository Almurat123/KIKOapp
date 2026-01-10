import prisma from '../db/prisma.js';

async function main() {
    const target = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';

    console.log(`--- Checking DB casing for: ${target} ---`);

    const configs = await prisma.copyTradeConfig.findMany({
        where: { targetWallet: { mode: 'insensitive', equals: target } }
    });

    console.log('CopyTradeConfigs:');
    configs.forEach(c => {
        console.log(`- ID: ${c.id}, Wallet: ${c.targetWallet}, Chain: ${c.chainId}`);
    });

    const tracked = await prisma.trackedWallet.findMany({
        where: { address: { mode: 'insensitive', equals: target } }
    });

    console.log('\nTrackedWallets:');
    tracked.forEach(t => {
        console.log(`- Wallet: ${t.address}, Chain: ${t.chainId}, Active: ${t.activeConfigs}`);
    });
}

main();
