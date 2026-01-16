// Check all users in database
import prisma from '../src/db/prisma.js';

async function checkUsers() {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                privyDid: true,
                walletAddress: true,
                solanaWalletAddress: true,
                createdAt: true
            }
        });

        console.log(`Found ${users.length} users in database:`);
        users.forEach(user => {
            console.log('---');
            console.log('ID:', user.id);
            console.log('Privy DID:', user.privyDid);
            console.log('EVM Address:', user.walletAddress);
            console.log('Solana Address:', user.solanaWalletAddress || '(null)');
            console.log('Created:', user.createdAt);
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkUsers();
