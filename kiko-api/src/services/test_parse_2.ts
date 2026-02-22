import { PrismaClient } from '@prisma/client';
import { parseSwapTransaction } from './txDecoder.js';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:mUQsMFiZOWvdHmiqvHyvLACYvEEifuSF@ballast.proxy.rlwy.net:21731/railway"
    }
  }
});

async function main() {
    console.log("Fetching payload...");
    const events = await prisma.$queryRawUnsafe<any[]>(`
        SELECT payload, tx_hash 
        FROM alchemy_webhook_inbox 
        WHERE payload::text ILIKE '%0x77777351928ce19bee8ff5b4b1406bc4c152827a%'
        ORDER BY created_at DESC LIMIT 1
    `);
    
    if (!events.length) return;
    
    const event = events[0];
    const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;
    const txHash = event.tx_hash;
    const trackedWallet = "0x77777351928ce19bee8ff5b4b1406bc4c152827a";
    const chainId = 8453; // Assuming Base

    console.log("Test parsing swap for tx:", txHash);
    
    try {
        const swap = await parseSwapTransaction(
            { hash: txHash, from: trackedWallet, to: "0xunknown", input: "0x", value: "0" },
            { logs: [], status: 1 }, // Mock receipt
            chainId,
            trackedWallet
        );
        console.log("Parsed result:", swap);
    } catch (err: any) {
        console.log("Parse Error:", err.message);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
