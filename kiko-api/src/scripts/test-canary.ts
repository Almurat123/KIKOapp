import 'dotenv/config';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const ALCHEMY_WEBHOOK_ID_SOL = process.env.ALCHEMY_WEBHOOK_ID_SOL || '';
const ALCHEMY_NOTIFY_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';

async function main() {
    // Original (problematic) ends in V
    // Canary ends in T
    const targetCanary = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvT';

    console.log(`Adding CANARY: ${targetCanary}`);

    const body = {
        webhook_id: ALCHEMY_WEBHOOK_ID_SOL,
        addresses_to_add: [targetCanary],
        addresses_to_remove: []
    };

    try {
        const response = await fetch(ALCHEMY_NOTIFY_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
            },
            body: JSON.stringify(body),
        });

        console.log('Status:', response.status);
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main();
