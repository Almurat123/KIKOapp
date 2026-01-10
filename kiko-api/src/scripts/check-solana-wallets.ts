
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const wallets = await prisma.trackedWallet.findMany({
        where: { chainId: 900 }
    });
    console.log(JSON.stringify(wallets, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
