import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDefiLlamaChains() {
    try {
        // Get all chains ordered by TVL
        const chains = await prisma.chainMetric.findMany({
            select: { name: true, tvl: true, volume24h: true },
            orderBy: { tvl: 'desc' },
            take: 60
        });

        console.log('=== Top Chains in Database ===\n');
        chains.forEach((c, i) => {
            const tvl = c.tvl ? `$${(Number(c.tvl) / 1e9).toFixed(2)}B` : '$0';
            const vol = c.volume24h ? `Vol: $${(Number(c.volume24h) / 1e6).toFixed(0)}M` : 'No vol';
            console.log(`${i + 1}. ${c.name.padEnd(25)} TVL: ${tvl.padEnd(10)} ${vol}`);
        });

        console.log('\n=== Checking for Specific Chains ===');
        const searchNames = ['Avalanche', 'Avalanche C', 'OP Mainnet', 'Optimism', 'Hyperliquid L1', 'Hyperevm'];
        for (const name of searchNames) {
            const chain = await prisma.chainMetric.findFirst({ where: { name } });
            if (chain) {
                console.log(`✅ Found "${name}" - TVL: $${chain.tvl ? (Number(chain.tvl) / 1e6).toFixed(1) + 'M' : '0'}`);
            } else {
                console.log(`❌ NOT found "${name}"`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDefiLlamaChains();
