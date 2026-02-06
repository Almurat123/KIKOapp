
import { getChainsData } from '../src/repositories/chainRepository';

async function main() {
    const chains = await getChainsData();

    console.log(`Found ${chains.length} chains.`);
    if (chains.length > 0) {
        console.log('Top 5 Chains Data (Repo Output):');
        console.table(chains.slice(0, 5).map(c => ({
            name: c.name,
            activeWallets: c.activeWallets,
            txns24h: c.txns24h,
            gasPrice: c.gasPrice,
            contracts: `${c.contracts24h ?? 'N/A'} / ${c.contracts7d ?? 'N/A'}`,
            tvl: c.tvl
        })));

        // Check serialization
        try {
            const json = JSON.stringify(chains);
            console.log('\nJSON Serialization Test: SUCCESS');
            console.log('Sample JSON substring:', json.substring(0, 200));
        } catch (e) {
            console.error('\nJSON Serialization Test: FAILED', e);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
    });
