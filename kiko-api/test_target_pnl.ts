import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:mUQsMFiZOWvdHmiqvHyvLACYvEEifuSF@ballast.proxy.rlwy.net:21731/railway"
    }
  }
});

async function main() {
   const cfg = await prisma.copyTradeConfig.findUnique({where: {id: "cml5i3w0800c3m112bpaat30r"}});
   console.log("Config target wallet:", cfg?.targetWallet);

   // Check if Alchemy webhook is enabled for this address
   const trackers = await prisma.trackedWallet.findMany({where: {address: cfg?.targetWallet}});
   console.log(`Found ${trackers.length} TrackedWallet entries for ${cfg?.targetWallet}, raw records: ${JSON.stringify(trackers)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
