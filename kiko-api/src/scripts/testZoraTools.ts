import { GetZoraTrendingTool, GetZoraProfileTool } from '../tools/zoraTools.js';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('ZORA_API_KEY present:', !!process.env.ZORA_API_KEY);

async function testTools() {
    console.log('--- Testing Zora AI Tools ---');

    console.log('\n1. Testing get_zora_trending (new coins, default 20)...');
    try {
        const trendResult = await GetZoraTrendingTool.handler({ category: 'new' });
        console.log('Result (New Coins):', trendResult.success ? `Found ${trendResult.count} coins` : 'Failed');
        if (trendResult.success && trendResult.count > 0) {
            console.log('First coin:', trendResult.coins[0].name, '(', trendResult.coins[0].symbol, ')');
        } else if (!trendResult.success) {
            console.log('Error:', trendResult.error);
        }
    } catch (e) {
        console.error('Trend failed:', e);
    }

    console.log('\n2. Testing get_zora_trending (volume)...');
    try {
        const trendResult = await GetZoraTrendingTool.handler({ category: 'volume', limit: 10 });
        console.log('Result (Volume):', trendResult.success ? `Found ${trendResult.count} coins` : 'Failed');
    } catch (e) {
        console.error('Trend Volume failed:', e);
    }

    console.log('\n3. Testing get_zora_trending (gainers)...');
    try {
        const trendResult = await GetZoraTrendingTool.handler({ category: 'gainers', limit: 10 });
        console.log('Result (Gainers):', trendResult.success ? `Found ${trendResult.count} coins` : 'Failed');
    } catch (e) {
        console.error('Trend Gainers failed:', e);
    }

    console.log('\n4. Testing get_zora_profile (Jesse - address)...');
    try {
        const profileResult = await GetZoraProfileTool.handler({ identifier: '0x2211d1d0020daea8039e46cf1367962070d77da9' });
        console.log('Result (Jesse Profile):', profileResult.success ? 'Success' : 'Failed');
        if (profileResult.success) {
            console.log('Profile Data Snippet:', JSON.stringify(profileResult.profile, null, 2).substring(0, 200) + '...');
        }
    } catch (e) {
        console.error('Profile failed:', e);
    }

    console.log('\n5. Testing get_zora_profile (almurat - handle)...');
    try {
        const profileResult = await GetZoraProfileTool.handler({ identifier: 'almurat' });
        console.log('Result (almurat Profile):', profileResult.success ? 'Success' : 'Failed');
        if (profileResult.success) {
            console.log('Display Name:', profileResult.profile.displayName);
        }
    } catch (e) {
        console.error('Profile failed:', e);
    }

    console.log('\n--- All Tests Complete ---');
}

testTools();
