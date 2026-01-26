
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const sessionId = 'cmkqgqpc10001xhiixg6msyam';

async function main() {
    console.log(`Fetching messages for session: ${sessionId}`);
    const messages = await prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { messageIndex: 'asc' }
    });

    console.log(`Found ${messages.length} messages:`);
    messages.forEach(m => {
        console.log('------------------------------------------------');
        console.log(`ID: ${m.id}`);
        console.log(`Role: ${m.role}`);
        console.log(`Type: ${m.type}`);
        console.log(`Status: ${m.status}`);
        console.log(`Content: ${m.content?.substring(0, 100)}...`); // Truncate content
        console.log(`Data: ${m.data}`);
        console.log(`TxHash: ${m.transactionHash}`);
        console.log(`TxStatus: ${m.transactionStatus}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
