import 'dotenv/config';
import { get, del } from '../cache/redis.js';

async function checkCache() {
    try {
        console.log('Checking Redis cache...');

        const protocolsJson = await get('market:protocols');
        if (protocolsJson) {
            const protocols = JSON.parse(protocolsJson);
            console.log('Cached protocols count:', protocols.length);
            console.log('First cached protocol:', protocols[0]);
            console.log('Has logoUrl?', 'logoUrl' in protocols[0]);
        } else {
            console.log('No protocols in cache');
        }

        const chainsJson = await get('market:chains');
        if (chainsJson) {
            const chains = JSON.parse(chainsJson);
            console.log('Cached chains count:', chains.length);
            console.log('First cached chain:', chains[0]);
            console.log('Has logoUrl?', 'logoUrl' in chains[0]);
        } else {
            console.log('No chains in cache');
        }

        // Force clear cache to be safe
        console.log('Clearing cache...');
        await del('market:protocols');
        await del('market:chains');
        console.log('Cache cleared.');

        process.exit(0);
    } catch (error) {
        console.error('Error checking cache:', error);
        process.exit(1);
    }
}

checkCache();
