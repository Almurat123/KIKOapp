import 'dotenv/config';

const ALCHEMY_AUTH_TOKEN = process.env.ALCHEMY_AUTH_TOKEN;
const WEBHOOK_ID_SOL = process.env.ALCHEMY_WEBHOOK_ID_SOL;
const ALCHEMY_NOTIFY_URL = 'https://dashboard.alchemy.com/api/webhook-addresses'; // GET endpoint

async function main() {
    if (!ALCHEMY_AUTH_TOKEN || !WEBHOOK_ID_SOL) {
        console.error('Missing env vars');
        return;
    }

    console.log(`Checking addresses for Webhook ID: ${WEBHOOK_ID_SOL}`);

    try {
        const url = `${ALCHEMY_NOTIFY_URL}?webhook_id=${WEBHOOK_ID_SOL}&limit=100`;
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error('Error fetching addresses:', await response.text());
            return;
        }

        const data = await response.json();
        console.log('--- Tracked Addresses on Alchemy ---');
        // Alchemy returns { data: string[] } or similar structure depending on version
        // Actually the endpoint usually returns a list or paginated list
        console.log(JSON.stringify(data, null, 2));

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

main();
