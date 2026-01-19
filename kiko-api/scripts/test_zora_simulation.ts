import 'dotenv/config';
import { zoraService } from '../src/services/zoraService';
import { notificationService } from '../src/services/notificationService';
import { prisma } from '../src/db/prisma';

// Mock Services
const originalUserProfile = zoraService.getUserProfile;
const originalNotify = notificationService.sendNotification;

async function main() {
    console.log('--- Zora Notification Simulation ---');

    // 1. Fetch our target user
    // 1. Fetch our target user
    const userId = (await prisma.user.findFirst())?.id;

    if (!userId) throw new Error('No user found');
    console.log('Testing for User ID:', userId);

    // 2. Fetch User Settings to confirm threshold
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    console.log('Current Threshold:', settings?.zoraNotificationThreshold);

    // 3. Mock Zora Service to return a High Value Creator
    zoraService.getUserProfile = async (identifier: string) => {
        console.log(`[Mock] Fetching profile for ${identifier}...`);
        return {
            handle: 'crypto_whale',
            displayName: 'Crypto Whale 🐳',
            socialAccounts: {
                farcaster: {
                    followerCount: 0,
                    username: 'whale',
                    displayName: 'Whale'
                },
                twitter: {
                    followerCount: 150000, // Trigger > 100
                    username: 'whale_x',
                    displayName: 'Whale X'
                }
            }
        } as any;
    };

    // 4. Mock Notification Service to Spy
    notificationService.sendNotification = async (params: any) => {
        console.log('\n[SUCCESS] Notification Triggered!');
        console.log('To FID:', params.farcasterFid);
        console.log('Type:', params.type);
        console.log('Data:', JSON.stringify(params.data, null, 2));
        return true;
    };

    // 5. Run the logic matching ZoraSniperService
    console.log('\n--- Simulating "CoinCreated" Event ---');
    const caller = '0x123...';
    const coin = '0xCOIN...';
    const symbol = 'WHALE';

    // (This logic is copied from ZoraSniperService for standalone verification)
    const threshold = settings?.zoraNotificationThreshold ?? 5000;
    const profile = await zoraService.getUserProfile(caller);
    const farcasterFollowers = profile?.socialAccounts?.farcaster?.followerCount || 0;
    const twitterFollowers = profile?.socialAccounts?.twitter?.followerCount || 0;

    const isHighValue = farcasterFollowers >= threshold || twitterFollowers >= threshold;

    console.log('Followers: FC=', farcasterFollowers, 'X=', twitterFollowers);
    console.log('Is High Value?', isHighValue);

    if (isHighValue) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { farcasterFid: true }
        });

        let followerDisplay = '';
        if (twitterFollowers >= threshold) {
            followerDisplay = `${twitterFollowers.toLocaleString()} (Twitter)`;
        } else {
            followerDisplay = `${farcasterFollowers.toLocaleString()} (Farcaster)`;
        }

        if (twitterFollowers > 0 && farcasterFollowers > 0) {
            followerDisplay = `${twitterFollowers.toLocaleString()} (X) / ${farcasterFollowers.toLocaleString()} (FC)`;
        }

        await notificationService.sendNotification({
            userId: userId,
            farcasterFid: user?.farcasterFid,
            type: 'ALPHA_CANDIDATE',
            data: {
                tokenSymbol: symbol,
                tokenAddress: coin,
                creatorName: profile?.displayName,
                followerCount: followerDisplay,
                zoraUrl: `https://zora.co/coin/base:${coin}`
            }
        });
    } else {
        console.log('[FAIL] No notification sent - conditions not met.');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
