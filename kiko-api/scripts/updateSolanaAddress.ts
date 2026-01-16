// Quick script to manually update Solana wallet address in database
// Run this in kiko-api directory: npx tsx scripts/updateSolanaAddress.ts

import prisma from '../src/db/prisma.js';

async function updateSolanaAddress() {
    const evmAddress = '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E';
    const solanaAddress = 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg';

    try {
        const user = await prisma.user.findUnique({
            where: { walletAddress: evmAddress }
        });

        if (!user) {
            console.error('User not found with EVM address:', evmAddress);
            return;
        }

        console.log('Found user:', user.id, user.privyDid);

        const updated = await prisma.user.update({
            where: { id: user.id },
            data: { solanaWalletAddress: solanaAddress }
        });

        console.log('✅ Updated user with Solana address:', updated.solanaWalletAddress);
    } catch (error) {
        console.error('Error updating Solana address:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateSolanaAddress();
