import prisma from '../db/prisma.js';

async function main() {
    const users = await prisma.user.findMany({
        where: {
            farcasterFid: { not: null }
        },
        select: {
            farcasterFid: true,
            farcasterUsername: true,
            walletAddress: true
        }
    });

    console.log('Users with Farcaster FID:');
    console.log(JSON.stringify(users, null, 2));
    console.log(`\nTotal: ${users.length}`);
}

main()
    .catch(console.error)
    .finally(() => process.exit(0));
