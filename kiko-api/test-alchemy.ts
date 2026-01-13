import { getAssetTransfers } from './dist/services/alchemy.js';

const testAddress = '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E';
const chain = 'base';

console.log(`Testing Alchemy API for address: ${testAddress} on ${chain}`);

try {
    const transfers = await getAssetTransfers(testAddress, chain, {
        maxCount: 5,
        category: ['external', 'erc20'],
        order: 'desc',
    });

    console.log('\n=== RAW ALCHEMY RESPONSE ===');
    console.log(JSON.stringify(transfers.slice(0, 3), null, 2));

    console.log('\n=== FORMATTED DATA ===');
    transfers.slice(0, 5).forEach((tx, i) => {
        console.log(`\nTransaction ${i + 1}:`);
        console.log(`  Hash: ${tx.hash}`);
        console.log(`  Asset: ${tx.asset}`);
        console.log(`  Value: ${tx.value}`);
        console.log(`  From: ${tx.from}`);
        console.log(`  To: ${tx.to}`);
        console.log(`  Category: ${tx.category}`);
        if (tx.rawContract) {
            console.log(`  Token Address: ${tx.rawContract.address}`);
            console.log(`  Token Decimals: ${tx.rawContract.decimal}`);
        }
    });

} catch (error) {
    console.error('Error:', error);
}
