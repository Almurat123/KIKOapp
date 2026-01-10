import 'dotenv/config';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const ALCHEMY_WEBHOOK_ID_SOL = process.env.ALCHEMY_WEBHOOK_ID_SOL || '';
const ALCHEMY_NOTIFY_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';

async function main() {
    const targetMixed = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';

    console.log(`Adding ONLY: ${targetMixed}`);

    const body = {
        webhook_id: ALCHEMY_WEBHOOK_ID_SOL,
        addresses_to_add: [targetMixed],
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
        console.log('Response:', await response.text());
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main();
