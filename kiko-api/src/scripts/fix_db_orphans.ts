import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Checking for orphaned UserActivity records...');

    // Find users
    const users = await prisma.user.findMany({ select: { privyDid: true } });
    const userIds = new Set(users.map(u => u.privyDid));

    // Find activities
    const activities = await prisma.userActivity.findMany({ select: { id: true, userId: true } });

    let orphans = 0;
    const idsToDelete: string[] = [];

    for (const act of activities) {
        if (!userIds.has(act.userId)) {
            console.log(`🗑️ Found orphan activity: ${act.id} (User: ${act.userId})`);
            idsToDelete.push(act.id);
            orphans++;
        }
    }

    if (orphans > 0) {
        console.log(`⚠️ Found ${orphans} orphaned UserActivity records. Deleting...`);
        await prisma.userActivity.deleteMany({
            where: {
                id: { in: idsToDelete }
            }
        });
        console.log('✅ Cleanup complete.');
    } else {
        console.log('✅ No orphans found.');
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
