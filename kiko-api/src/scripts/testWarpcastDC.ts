import 'dotenv/config';
import { warpcastService } from '../services/warpcastService.js';

async function testDC() {
    const fidString = process.argv[2];

    if (!fidString) {
        console.error('Usage: npx ts-node src/scripts/testWarpcastDC.ts <fid>');
        process.exit(1);
    }

    const fid = parseInt(fidString);
    if (isNaN(fid)) {
        console.error('Invalid FID. Must be a number.');
        process.exit(1);
    }

    console.log(`🚀 Testing Direct Cast to FID: ${fid}...`);

    const message = `🚀 *Kiko Direct Cast Test*\n\n💎 *Status:* Active ✅\n🔮 *Mission:* Smarter Trading\n\n🔗 *Warpcast:* https://warpcast.com/kiko\n\n*Powered by KiKo AI* 🤖`;

    const success = await warpcastService.sendDirectCast({
        recipientFid: fid,
        message
    });

    if (success) {
        console.log('✅ Test DM sent! Check your Warpcast messages.');
    } else {
        console.log('❌ Failed to send test DM. Check WARPCAST_DC_API_KEY in .env.');
    }
}

testDC().catch(console.error);
