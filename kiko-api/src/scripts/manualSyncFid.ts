/**
 * Manual script to sync Farcaster FID for a specific user
 * Usage: DATABASE_URL=<prod_url> npx tsx src/scripts/manualSyncFid.ts <privyDid> <fid> <username>
 */

import prisma from '../db/prisma.js';

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: npx tsx src/scripts/manualSyncFid.ts <privyDid> <fid> [username]');
        console.error('Example: npx tsx src/scripts/manualSyncFid.ts did:privy:xxx 877398 almurat');
        process.exit(1);
    }

    const [privyDid, fidStr, username] = args;
    const fid = parseInt(fidStr);

    if (isNaN(fid)) {
        console.error('Error: FID must be a number');
        process.exit(1);
    }

    console.log(`Syncing Farcaster FID for user ${privyDid}...`);
    console.log(`  FID: ${fid}`);
    console.log(`  Username: ${username || '(not provided)'}`);

    try {
        const user = await prisma.user.update({
            where: { privyDid },
            data: {
                farcasterFid: fid,
                farcasterUsername: username || null
            }
        });

        console.log('\n✅ Successfully synced!');
        console.log(`User ID: ${user.id}`);
        console.log(`Wallet: ${user.walletAddress}`);
        console.log(`Farcaster FID: ${user.farcasterFid}`);
        console.log(`Farcaster Username: ${user.farcasterUsername}`);
    } catch (error: any) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

main()
    .catch(console.error)
    .finally(() => process.exit(0));
