```
import { searchTokens } from '../src/services/dexscreener.js';

async function testSearch() {
    // const query = '0xcbB7C0000aB88B473b423d83796A1924ED863db8'; // cbBTC on Base
    const query = '0x611Cbc29d1a19408b3Ff414c0CF692AD2bfD9B07';
    // const query = 'cbBTC';
    console.log(`Searching for: ${ query } `);

    const results = await searchTokens(query);

    if (results.length === 0) {
        console.error('No results found!');
        process.exit(1);
    }

    console.log(`Found ${ results.length } results.`);
    const firstResult = results[0];
    console.log('First result:', firstResult);

    if (!firstResult.poolAddress) {
        console.error('FAIL: poolAddress is missing!');
        process.exit(1);
    }

    if (firstResult.poolAddress === firstResult.address) {
        console.warn('WARNING: poolAddress equals token address (might be wrong if searching for token)');
    }

    console.log('SUCCESS: poolAddress found:', firstResult.poolAddress);
}

testSearch().catch(console.error);
