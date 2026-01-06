import prisma from './src/lib/prisma';

async function main() {
    const configs = await prisma.copyTradeConfig.findMany({
        where: {
            status: 'active'
        }
    });

    console.log('Active Copy Trade Configs:');
    console.log(JSON.stringify(configs, null, 2));

    const targetWallet = '0xd1aa4aed47a5453dc917f2b30eb0ecca8ecbf241';
    const match = await prisma.copyTradeConfig.findMany({
        where: {
            targetWallet: {
                contains: targetWallet.slice(0, 10),
                mode: 'insensitive'
            }
        }
    });

    console.log(`\nConfigs matching target wallet containing \"${targetWallet.slice(0, 10)}\":`);
    console.log(JSON.stringify(match, null, 2));
}

main();
