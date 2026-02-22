import { fetchJson } from '../config/unifiedApiService.js';

const ALCHEMY_AUTH_TOKEN = 'fR6KJu6SOAovb30kwCrHCy79797b1aDL'; // from .env
const webhookId = 'wh_lb0gbaogh5ek413o'; // Base webhook from .env
const addressToCheck = "0x77777351928ce19bee8ff5b4b1406bc4c152827a";

async function check() {
    try {
        const response = await fetch(`https://dashboard.alchemy.com/api/webhook-addresses?webhook_id=${webhookId}`, {
            headers: {
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN
            }
        });
        const data = await response.json();
        const addresses: string[] = data?.data || data?.addresses || [];
        console.log(`Webhook addresses count:`, addresses.length);
        console.log(`Address ${addressToCheck} in webhook?`, addresses.some(a => a.toLowerCase() === addressToCheck.toLowerCase()));

        // Print webhook status
        const hookResponse = await fetch(`https://dashboard.alchemy.com/api/webhooks`, {
            headers: {
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN
            }
        });
        const hookData = await hookResponse.json();
        console.log("Webhooks:", JSON.stringify(hookData, null, 2));

    } catch (err: any) {
        console.error("Error:", err.message);
    }
}

check();
