/**
 * Migrate all users' swapMethod to 'allowance_trade'
 * Run: npx tsx migrations/migrate-swap-method.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting swapMethod migration...');

    // Count users before migration
    const before = await prisma.userSettings.groupBy({
        by: ['swapMethod'],
        _count: true,
    });
    console.log('📊 Before migration:', before);

    // Update all users to allowance_trade
    const result = await prisma.userSettings.updateMany({
        where: {
            swapMethod: {
                not: 'allowance_trade',
            },
        },
        data: {
            swapMethod: 'allowance_trade',
        },
    });

    console.log(`✅ Updated ${result.count} users to allowance_trade mode`);

    // Count users after migration
    const after = await prisma.userSettings.groupBy({
        by: ['swapMethod'],
        _count: true,
    });
    console.log('📊 After migration:', after);

    // Verify all users are now using allowance_trade
    const verification = await prisma.userSettings.count({
        where: {
            swapMethod: 'allowance_trade',
        },
    });
    const total = await prisma.userSettings.count();

    console.log(`\n🎉 Migration complete!`);
    console.log(`   Total users: ${total}`);
    console.log(`   Using allowance_trade: ${verification}`);
    console.log(`   Success rate: ${verification === total ? '100%' : 'ERROR - Some users not migrated!'}`);
}

main()
    .catch((e) => {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
