import prisma from '../db/prisma.js';

async function main() {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { privyDid: { contains: 'cmk74yj4r03jcl70b8hwyuh2c' } },
                { walletAddress: { contains: 'FB64Ce8d64CEC808a8aCb977d3Ee7bE1169f1a2B', mode: 'insensitive' } }
            ]
        },
        select: { id: true, privyDid: true, walletAddress: true, solanaWalletAddress: true }
    });
    console.log('Found users:', JSON.stringify(users, null, 2));
    await prisma.$disconnect();
}
main();
