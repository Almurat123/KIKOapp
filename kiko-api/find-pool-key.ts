/**
 * Expanded script to find the correct PoolKey for a given PoolId
 */

import { encodeAbiParameters, parseAbiParameters, keccak256, type Address } from 'viem';

const POOL_ID_TARGET = '0x3f04372cdcaac649547c27dbb285feba098f9b247ae634cfe0154290df3372d3';
const WETH = '0x4200000000000000000000000000000000000006';
const NATIVE_ETH = '0x0000000000000000000000000000000000000000';
const TOKEN = '0x611cbc29d1a19408b3ff414c0cf692ad2bfd9b07';

const CLANKER_HOOKS = [
    '0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC', // STATIC V1
    '0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC', // DYNAMIC V1
    '0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC', // STATIC V2
    '0xd60D6B218116cFd801E28F78d011a203D2b068Cc', // DYNAMIC V2
    '0x11b51DBC2f7F683b81CeDa83DC0078D57bA328cc', // Old STATIC_V2?
    '0xBF4983dC0f2F8FE78C5cf8Fc621f294A993728Cc', // Old DYNAMIC_V2?
];

const QUOTE_TOKENS = [WETH, NATIVE_ETH];
const FEES = [100, 500, 3000, 10000, 8388608]; // 10000 is 1%, 8388608 is dynamic flag
const TICK_SPACINGS = [60, 200];

async function main() {
    console.log(`Brute-forcing PoolKey for PoolID: ${POOL_ID_TARGET}`);

    for (const quoteToken of QUOTE_TOKENS) {
        const [currency0, currency1] = [quoteToken, TOKEN].sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);

        for (const hook of CLANKER_HOOKS) {
            for (const fee of FEES) {
                for (const tickSpacing of TICK_SPACINGS) {
                    const encoded = encodeAbiParameters(
                        parseAbiParameters('address,address,uint24,int24,address'),
                        [currency0 as Address, currency1 as Address, fee, tickSpacing, hook as Address]
                    );
                    const poolId = keccak256(encoded);

                    if (poolId === POOL_ID_TARGET) {
                        console.log('\n✅ FOUND MATCH!');
                        console.log('Quote Token:', quoteToken === WETH ? 'WETH' : 'Native ETH');
                        console.log('Currency0:', currency0);
                        console.log('Currency1:', currency1);
                        console.log('Hook:', hook);
                        console.log('Fee:', fee);
                        console.log('TickSpacing:', tickSpacing);
                        return;
                    }
                }
            }
        }
    }
    console.log('\n❌ No match found.');
}

main().catch(console.error);
