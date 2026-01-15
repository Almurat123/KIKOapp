/**
 * Check Farcaster FID status in database
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📊 Checking users with Farcaster FID...\n');

    // Check users with farcasterFid set
    const usersWithFarcaster = await prisma.user.findMany({
        where: { farcasterFid: { not: null } },
        select: { id: true, email: true, walletAddress: true, farcasterFid: true, farcasterUsername: true }
    });

    console.log('Users with Farcaster FID set:');
    console.log(JSON.stringify(usersWithFarcaster, null, 2));
    console.log('\nTotal:', usersWithFarcaster.length);

    // Get total user count
    const totalUsers = await prisma.user.count();
    console.log(`\nTotal users in DB: ${totalUsers}`);
    console.log(`Users without Farcaster FID: ${totalUsers - usersWithFarcaster.length}`);

    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
