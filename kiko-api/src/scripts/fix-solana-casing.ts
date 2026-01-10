import 'dotenv/config';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN;
const WEBHOOK_ID_SOL = process.env.ALCHEMY_WEBHOOK_ID_SOL;
const ALCHEMY_NOTIFY_URL_UPDATE = 'https://dashboard.alchemy.com/api/update-webhook-addresses'; // PATCH
const ALCHEMY_NOTIFY_URL_GET = 'https://dashboard.alchemy.com/api/webhook-addresses'; // GET

// Hardcoded for repair since we can't access DB from external railway run
const TARGET_WALLETS = [
    'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV'
];

async function main() {
    if (!ALCHEMY_AUTH_TOKEN || !WEBHOOK_ID_SOL) {
        console.error('Missing env vars');
        return;
    }

    console.log(`[Fix] checking addresses for Webhook ID: ${WEBHOOK_ID_SOL}`);

    // 1. Get current addresses from Alchemy
    const response = await fetch(`${ALCHEMY_NOTIFY_URL_GET}?webhook_id=${WEBHOOK_ID_SOL}&limit=100`, {
        method: 'GET',
        headers: { 'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN, 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    const alchemyAddresses: string[] = data.data || [];
    console.log(`[Fix] Found ${alchemyAddresses.length} addresses on Alchemy.`);

    // 2. Process hardcoded list
    for (const correctAddress of TARGET_WALLETS) {
        const lowerAddress = correctAddress.toLowerCase();

        // Check if lowercase version exists in Alchemy
        if (alchemyAddresses.includes(lowerAddress) && lowerAddress !== correctAddress) {
            console.log(`[Fix] Found INCORRECT lowercase address: ${lowerAddress}`);

            // REMOVE Lowercase
            console.log(`[Fix] Step 1: Removing ${lowerAddress}...`);
            await updateWebhook(WEBHOOK_ID_SOL, [], [lowerAddress]);

            console.log('[Fix] Waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            // ADD Correct Case
            console.log(`[Fix] Step 2: Adding ${correctAddress}...`);
            await updateWebhook(WEBHOOK_ID_SOL, [correctAddress], []);

            console.log(`[Fix] ✅ Repaired ${correctAddress}`);
        } else if (!alchemyAddresses.includes(correctAddress)) {
            console.log(`[Fix] Address missing entirely. Adding ${correctAddress}...`);
            await updateWebhook(WEBHOOK_ID_SOL, [correctAddress], []);
            console.log(`[Fix] ✅ Added ${correctAddress}`);
        } else {
            console.log(`[Fix] Address ${correctAddress} appears correct (mixed case preserved).`);
        }
    }
}

async function updateWebhook(webhookId: string, add: string[], remove: string[]) {
    const res = await fetch(ALCHEMY_NOTIFY_URL_UPDATE, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN as string,
        },
        body: JSON.stringify({
            webhook_id: webhookId,
            addresses_to_add: add,
            addresses_to_remove: remove,
        }),
    });
    const text = await res.text();
    if (!res.ok) {
        console.error(`[Fix] Update failed: ${text}`);
    } else {
        console.log(`[Fix] Alchemy response: ${text}`);
    }
}

main().catch(e => console.error(e));
