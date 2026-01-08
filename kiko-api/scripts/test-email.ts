import 'dotenv/config';
import { sendTradeNotification } from '../src/services/emailService.js';
import { env } from '../src/config/env.js';

async function testEmail() {
    const testEmail = 'almurat250@gmail.com';

    console.log(`[Test] Sending test emails to ${testEmail}...`);
    console.log(`[Test] Using Resend API Key: ${env.apiKeys.resendApiKey ? 'Present' : 'MISSING'}`);

    if (!env.apiKeys.resendApiKey) {
        console.error('Error: RESEND_API_KEY is not set in environment.');
        process.exit(1);
    }

    try {
        // 1. Test Welcome Email
        console.log('Sending Welcome Email...');
        await sendTradeNotification(testEmail, {
            type: 'welcome',
            userName: 'Almurat'
        });

        // 2. Test Success Trade Email (Realistic Data)
        console.log('Sending Trade Success Email (Realistic Data)...');
        await sendTradeNotification(testEmail, {
            type: 'success',
            tokenSymbol: 'VIRTUAL',
            tokenAddress: '0x0b3e328453488734279df14d59aae9170068831b',
            amount: '5,420.55',
            usdValue: '862.14',
            txHash: '0x217d8339c3683f3f336683f336683f336683f336683f336683f336683f336683',
            targetWallet: '0x32134567890abcdef1234567890abcdef1234567',
            chainId: 8453
        });

        console.log('✅ All test emails sent!');
    } catch (error) {
        console.error('❌ Failed to send test emails:', error);
    }
}

testEmail();
