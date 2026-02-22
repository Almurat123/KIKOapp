import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:mUQsMFiZOWvdHmiqvHyvLACYvEEifuSF@ballast.proxy.rlwy.net:21731/railway"
    }
  }
});

async function main() {
    const rawEvents = await prisma.$queryRaw`SELECT id, status, network, "errorCount", "createdAt" FROM "AlchemyWebhookInbox" ORDER BY "createdAt" DESC LIMIT 5`;
    console.log('Recent raw webhook events:', rawEvents);
}

main().catch(console.error).finally(() => prisma.$disconnect());
