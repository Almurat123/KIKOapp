import { fetchJson } from '../config/unifiedApiService.js';

const ALCHEMY_AUTH_TOKEN = 'fR6KJu6SOAovb30kwCrHCy79797b1aDL'; // from .env
const webhookId = 'wh_lb0gbaogh5ek413o'; // Base webhook from .env

async function check() {
    try {
        const response = await fetch(`https://dashboard.alchemy.com/api/webhook-addresses?webhook_id=${webhookId}`, {
            headers: {
                'X-Alchemy-Token': ALCHEMY_AUTH_TOKEN
            }
        });
        const data = await response.json();
        console.log(`Addresses for webhook ${webhookId}:`, data?.data?.length || data?.addresses?.length || 'Unknown length', 'Preview:', JSON.stringify(data).slice(0, 300));
    } catch (err: any) {
        console.error("Error:", err.message);
    }
}

check();
