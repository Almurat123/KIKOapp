import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Searching for stuck user...');

    // Find user with dummy wallet address
    const user = await prisma.user.findFirst({
        where: {
            walletAddress: {
                contains: '0xMyWalletAddress0000'
            }
        }
    });

    if (!user) {
        console.log('User not found.');
        return;
    }

    console.log(`Found user: ${user.id} (${user.walletAddress})`);
    console.log('Deleting...');

    // Delete specific user (cascade will handle configs/positions if correctly set up in schema, 
    // schema says onDelete: Cascade, so it should be fine).
    await prisma.user.delete({
        where: {
            id: user.id
        }
    });

    console.log('Successfully deleted user.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
