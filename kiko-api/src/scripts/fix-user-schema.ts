import { prisma } from '../db/prisma.js';

async function main() {
    console.log('[SchemaCheck] Checking for missing columns in "User" table...');

    try {
        // 1. Check for 'email' column
        try {
            await prisma.$queryRaw`SELECT email FROM "User" LIMIT 1`;
            console.log('✅ Column "email" exists.');
        } catch (error: any) {
            if (error.message.includes('column "email" does not exist')) {
                console.log('❌ Column "email" is missing. Attempting to fix...');
                await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT');
                await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")');
                console.log('✅ Column "email" added and indexed.');
            } else {
                throw error;
            }
        }

        // 2. Check for 'solanaWalletAddress' column
        try {
            await prisma.$queryRaw`SELECT "solanaWalletAddress" FROM "User" LIMIT 1`;
            console.log('✅ Column "solanaWalletAddress" exists.');
        } catch (error: any) {
            if (error.message.includes('column "solanaWalletAddress" does not exist')) {
                console.log('❌ Column "solanaWalletAddress" is missing. Attempting to fix...');
                await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "solanaWalletAddress" TEXT');
                console.log('✅ Column "solanaWalletAddress" added.');
            } else {
                throw error;
            }
        }

        // 3. Check for referral columns
        try {
            await prisma.$queryRaw`SELECT "referralCode" FROM "User" LIMIT 1`;
            console.log('✅ Column "referralCode" exists.');
        } catch (error: any) {
            if (error.message.includes('column "referralCode" does not exist')) {
                console.log('❌ Column "referralCode" is missing. Attempting to fix...');
                await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode" TEXT');
                await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredBy" TEXT');
                await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key" ON "User"("referralCode")');
                console.log('✅ Referral columns added and indexed.');
            } else {
                throw error;
            }
        }

        console.log('\n[SchemaCheck] ✅ All essential User columns verified.');

    } catch (error) {
        console.error('[SchemaCheck] ❌ Error during schema verification:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
