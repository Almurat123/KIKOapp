// Fix user record - set walletAddress to Solana address if EVM is empty
import prisma from '../src/db/prisma.js';

async function fixUserRecord() {
    const privyDid = 'did:privy:cmj0a3j3f005fl20c4xkl7195';
    const solanaAddress = 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg';

    try {
        const user = await prisma.user.findUnique({
            where: { privyDid }
        });

        if (!user) {
            console.error('User not found');
            return;
        }

        console.log('Current user:', {
            id: user.id,
            walletAddress: user.walletAddress || '(empty)',
            solanaWalletAddress: user.solanaWalletAddress || '(empty)'
        });

        // Update walletAddress to Solana address if it's empty
        if (!user.walletAddress || user.walletAddress.trim() === '') {
            const updated = await prisma.user.update({
                where: { id: user.id },
                data: {
                    walletAddress: solanaAddress,
                    solanaWalletAddress: solanaAddress
                }
            });

            console.log('✅ Fixed user record:', {
                walletAddress: updated.walletAddress,
                solanaWalletAddress: updated.solanaWalletAddress
            });
        } else {
            console.log('User already has walletAddress, no update needed');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

fixUserRecord();
