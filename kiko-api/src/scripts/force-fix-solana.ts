import 'dotenv/config';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const ALCHEMY_WEBHOOK_ID_SOL = process.env.ALCHEMY_WEBHOOK_ID_SOL || '';
const ALCHEMY_NOTIFY_URL = 'https://dashboard.alchemy.com/api/update-webhook-addresses';

async function main() {
    const targetMixed = 'CWk2NqZwy3Fo9cumJcWwt45j4D6FnboS5h3vHZWtKyvV';
    const targetLower = targetMixed.toLowerCase();

    console.log('--- Force Fix Solana Casing ---');
    console.log(`Webhook ID: ${ALCHEMY_WEBHOOK_ID_SOL}`);
    console.log(`Removing: ${targetLower}`);
    console.log(`Adding:   ${targetMixed}`);

    const body = {
        webhook_id: ALCHEMY_WEBHOOK_ID_SOL,
        addresses_to_add: [targetMixed],
        addresses_to_remove: [targetLower]
    };

    console.log('Request Body:', JSON.stringify(body, null, 2));

    try {
        const response = await fetch(ALCHEMY_NOTIFY_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        if (response.ok) {
            console.log('✅ Success!');
            console.log('Response:', text);
        } else {
            console.error('❌ Failed!');
            console.error('Status:', response.status);
            console.error('Response:', text);
        }
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main();
