import { diagnoseCopyTradeWebhookChain } from '../services/alchemyWebhookReconciler.js';
import { getSupportedAlchemyWebhookChains } from '../services/alchemyWebhookConfig.js';

async function main() {
    const requested = process.argv.slice(2).map(Number).filter(Number.isInteger);
    const chainIds = requested.length > 0 ? requested : getSupportedAlchemyWebhookChains();
    const reports = [];
    for (const chainId of chainIds) {
        reports.push(await diagnoseCopyTradeWebhookChain(chainId));
    }
    console.log(JSON.stringify(reports, null, 2));
}

main().catch((error) => {
    console.error('[diagnoseCopyTradeWebhookDrift] failed', error);
    process.exit(1);
});
