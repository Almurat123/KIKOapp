/**
 * Find real Privy users for testing
 */
import 'dotenv/config';
import prisma from './src/lib/prisma.js';

async function findRealUsers() {
    console.log('=== Finding Real Privy Users ===\n');

    const users = await prisma.user.findMany({
        where: {
            privyDid: { startsWith: 'did:privy:cm' }
        },
        take: 5,
        select: { id: true, privyDid: true, walletAddress: true }
    });

    console.log('Real users found:', users.length);
    for (const user of users) {
        console.log(`  ID: ${user.id}`);
        console.log(`  DID: ${user.privyDid}`);
        console.log(`  Wallet: ${user.walletAddress}`);
        console.log('');
    }

    await prisma.$disconnect();
}

findRealUsers().catch(console.error);
