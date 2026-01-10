import 'dotenv/config';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN || '';
const WEBHOOK_ID_SOL = process.env.ALCHEMY_WEBHOOK_ID_SOL || '';
const ALCHEMY_NOTIFY_URL = 'https://dashboard.alchemy.com/api/webhooks'; // GET all webhooks

async function main() {
    if (!ALCHEMY_AUTH_TOKEN || !WEBHOOK_ID_SOL) {
        console.error('Missing env vars');
        return;
    }

    try {
        const response = await fetch(ALCHEMY_NOTIFY_URL, {
            method: 'GET',
            headers: {
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Error fetching webhooks:', await response.text());
            return;
        }

        const data = await response.json();
        const webhook = data.data.find((w: any) => w.id === WEBHOOK_ID_SOL);

        console.log('--- Webhook Details ---');
        console.log(JSON.stringify(webhook, null, 2));

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main();
