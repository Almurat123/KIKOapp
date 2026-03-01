import { syncCopyTradeWebhookChain } from '../services/copyTradeWebhookSync.js';

async function main() {
    const requested = process.argv.slice(2).map(Number).filter(Number.isInteger);
    const chainIds = requested.length > 0 ? requested : [8453, 56, 900];
    const results = [];
    for (const chainId of chainIds) {
        results.push(await syncCopyTradeWebhookChain(chainId, 'manual_reconcile'));
    }
    console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
    console.error('[reconcileCopyTradeWebhooks] failed', error);
    process.exit(1);
});
