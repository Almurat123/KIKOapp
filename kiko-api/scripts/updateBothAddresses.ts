// Update user to have both EVM and Solana addresses
import prisma from '../src/db/prisma.js';

async function updateBothAddresses() {
    const privyDid = 'did:privy:cmj0a3j3f005fl20c4xkl7195';
    const evmAddress = '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E';
    const solanaAddress = 'BgNm4YDzxb3sMppsticzEN47fCp6k8NwrmofsB9nuXZg';

    try {
        const updated = await prisma.user.update({
            where: { privyDid },
            data: {
                walletAddress: evmAddress,  // EVM address as primary
                solanaWalletAddress: solanaAddress  // Solana address as secondary
            }
        });

        console.log('✅ Updated user with both addresses:', {
            walletAddress: updated.walletAddress,
            solanaWalletAddress: updated.solanaWalletAddress
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

updateBothAddresses();
