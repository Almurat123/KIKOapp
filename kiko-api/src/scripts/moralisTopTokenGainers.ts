/**
 * Query Moralis token top gainers.
 * Usage:
 *   npx tsx src/scripts/moralisTopTokenGainers.ts <tokenAddress> [chain=eth] [days] [limit=50]
 *
 * Example:
 *   npx tsx src/scripts/moralisTopTokenGainers.ts 0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE eth 30 50
 */

import { getTokenTopProfitableWallets } from '../services/moralisService.js';

const tokenAddress = String(process.argv[2] || '').trim();
const chain = String(process.argv[3] || 'eth').trim();
const daysArg = process.argv[4];
const limitArg = process.argv[5];

if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    console.error('Usage: npx tsx src/scripts/moralisTopTokenGainers.ts <tokenAddress> [chain=eth] [days] [limit=50]');
    process.exit(1);
}

const parsedDays = daysArg !== undefined ? Math.trunc(Number(daysArg)) : NaN;
const days = Number.isFinite(parsedDays) && parsedDays > 0
    ? parsedDays
    : undefined;
const parsedLimit = limitArg !== undefined ? Math.trunc(Number(limitArg)) : 50;
const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(100, parsedLimit)
    : 50;

async function main() {
    const result = await getTokenTopProfitableWallets(tokenAddress, chain, {
        days,
        limit,
        fallbackToAllTime: true,
    });

    if (!result) {
        console.error('No result. Check MORALIS_API_KEY, token address, and chain.');
        process.exit(2);
    }

    console.log(JSON.stringify({
        token: {
            address: result.tokenAddress,
            symbol: result.tokenSymbol,
            name: result.tokenName,
            decimals: result.tokenDecimals,
            possibleSpam: result.possibleSpam,
        },
        chain: result.chain,
        chainId: result.chainId,
        requestedDays: result.requestedDays,
        appliedDays: result.appliedDays,
        usedAllTimeFallback: result.usedAllTimeFallback,
        count: result.wallets.length,
        topGainers: result.wallets,
    }, null, 2));
}

main().catch((error) => {
    console.error(error?.message || String(error));
    process.exit(3);
});
