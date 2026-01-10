import 'dotenv/config';
import { addAddressToWebhook, removeAddressFromWebhook } from '../services/alchemyWebhookService.js';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN;
const WEBHOOK_ID_SOL = process.env.ALCHEMY_WEBHOOK_ID_SOL;
const ALCHEMY_NOTIFY_URL_GET = 'https://dashboard.alchemy.com/api/webhook-addresses';

// A unique test address with Mixed Case (Note: 'TEST' at the end)
// Must be valid base58 chars. '0' 'O' 'I' 'l' are excluded from base58 usually but Alchemy might be lenient on format vs charset. 
// We'll use safe chars.
const TEST_ADDRESS = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';

async function main() {
    if (!ALCHEMY_AUTH_TOKEN || !WEBHOOK_ID_SOL) {
        console.error('Missing env vars: ALCHEMY_AUTH_TOKEN or ALCHEMY_WEBHOOK_ID_SOL');
        return;
    }

    console.log(`[Test] Starting verification for address: ${TEST_ADDRESS}`);
    console.log(`[Test] Using Webhook ID: ${WEBHOOK_ID_SOL}`);

    // 1. Add Address using the SERVICE function (which should now be fixed)
    console.log('[Test] Calling addAddressToWebhook(..., 900)...');
    const added = await addAddressToWebhook(TEST_ADDRESS, 900);
    if (!added) {
        console.error('[Test] Failed to add address locally.');
        return;
    }

    // 2. Verify on Alchemy immediately
    console.log('[Test] Querying Alchemy for stored addresses...');
    const alchemyAddresses = await getAlchemyAddresses();

    const stored = alchemyAddresses.find(a => a.toLowerCase() === TEST_ADDRESS.toLowerCase());

    if (!stored) {
        console.error('[Test] ❌ Address NOT found on Alchemy at all!');
    } else {
        console.log(`[Test] Found address on Alchemy: ${stored}`);
        if (stored === TEST_ADDRESS) {
            console.log('[Test] ✅ SUCCESS! Casing is PRESERVED (Mixed Case match).');
        } else {
            console.log(`[Test] ❌ FAILED! Casing mismatch. Expected ${TEST_ADDRESS}, got ${stored}`);
        }
    }

    // 3. Cleanup
    console.log('[Test] Cleaning up...');
    await removeAddressFromWebhook(TEST_ADDRESS, 900);
    console.log('[Test] Done.');
}

async function getAlchemyAddresses(): Promise<string[]> {
    const response = await fetch(`${ALCHEMY_NOTIFY_URL_GET}?webhook_id=${WEBHOOK_ID_SOL}&limit=100`, {
        method: 'GET',
        headers: { 'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN as string, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    return data.data || [];
}

main().catch(console.error);
