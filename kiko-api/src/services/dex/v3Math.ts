/**
 * Uniswap V3 Math Utilities
 * Accurate TVL calculation using tick math
 * 
 * [Ref]: https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickMath.sol
 */

const Q96 = BigInt(2) ** BigInt(96);
const Q128 = BigInt(2) ** BigInt(128);

/**
 * Calculate token amounts from V3 liquidity
 * [Logic]: Uses sqrtPriceX96 and liquidity to derive token0/token1 amounts
 * 
 * Formula (V3 whitepaper):
 * amount0 = L / sqrtPrice (in token0 wei)
 * amount1 = L * sqrtPrice (in token1 wei)
 * 
 * [Ref]: https://docs.uniswap.org/contracts/v3/reference/core/libraries/SqrtPriceMath
 */
export function getTokenAmountsFromLiquidity(
    sqrtPriceX96: bigint,
    liquidity: bigint,
    decimals0: number,
    decimals1: number
): { amount0: number; amount1: number } {
    // sqrtPrice = sqrtPriceX96 / 2^96
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);

    // L is raw liquidity value (not scaled)
    const L = Number(liquidity);

    // amount0 = L / sqrtPrice (raw units)
    // amount1 = L * sqrtPrice (raw units)
    const amount0Raw = L / sqrtPrice;
    const amount1Raw = L * sqrtPrice;

    // Convert from raw units to token amounts
    const amount0 = amount0Raw / Math.pow(10, decimals0);
    const amount1 = amount1Raw / Math.pow(10, decimals1);

    return { amount0, amount1 };
}

/**
 * Calculate V3 pool TVL in USD
 * [Logic]: Converts token amounts to USD using token prices
 */
export function calculateV3TVL(
    sqrtPriceX96: bigint,
    liquidity: bigint,
    decimals0: number,
    decimals1: number,
    price0USD: number,
    price1USD: number
): number {
    const { amount0, amount1 } = getTokenAmountsFromLiquidity(
        sqrtPriceX96,
        liquidity,
        decimals0,
        decimals1
    );

    const tvl = (amount0 * price0USD) + (amount1 * price1USD);
    return tvl;
}

/**
 * Get price from sqrtPriceX96
 */
export function getPriceFromSqrtX96(
    sqrtPriceX96: bigint,
    decimals0: number,
    decimals1: number
): number {
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice * sqrtPrice;
    const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
    return price * decimalAdjustment;
}
