
import prisma from '../db/prisma.js';

async function getMeta() {
    const u = await prisma.user.findFirst();
    const c = await prisma.copyTradeConfig.findFirst();
    console.log('TEST_DATA:' + JSON.stringify({ userId: u?.privyDid, configId: c?.id }));
    process.exit(0);
}

getMeta().catch(e => {
    console.error(e);
    process.exit(1);
});
