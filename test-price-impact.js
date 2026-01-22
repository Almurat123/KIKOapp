// Test script to debug price impact calculation
// Based on the actual LOTRY trade data

// Actual trade data from logs
const amountIn = 33251255.870381349278423916; // LOTRY
const amountOut = 0.028329151005357685; // WETH (from 0x API response)

// Token prices (we need to fetch these or estimate)
// From DexScreener: LOTRY = $0.000002567, WETH ≈ $2,970
const tokenInUsd = 0.000002567; // LOTRY price in USD
const tokenOutUsd = 2970; // WETH price in USD (approximate)

// Calculate quote price (how many WETH per LOTRY from the quote)
const quotePrice = amountOut / amountIn;
console.log('Quote Price (WETH per LOTRY):', quotePrice);
console.log('Quote Price (scientific):', quotePrice.toExponential());

// Calculate reference price (how many WETH per LOTRY based on USD prices)
const refPrice = tokenInUsd / tokenOutUsd;
console.log('\nReference Price (WETH per LOTRY):', refPrice);
console.log('Reference Price (scientific):', refPrice.toExponential());

// Calculate price impact using the current formula
const priceImpact = ((quotePrice - refPrice) / refPrice) * 100;
console.log('\nPrice Impact (current formula):', priceImpact.toFixed(4) + '%');

// Calculate the ratio to see the relationship
const ratio = quotePrice / refPrice;
console.log('Quote/Ref Ratio:', ratio);

// Alternative calculation: if the formula should be inverted
const invertedImpact = ((refPrice - quotePrice) / refPrice) * 100;
console.log('\nPrice Impact (inverted formula):', invertedImpact.toFixed(4) + '%');

// Calculate what the impact should be based on pool size
const poolLotry = 83303926587; // from DexScreener
const poolWeth = 9.3801; // from DexScreener
const sellAmount = amountIn;
const sellRatio = sellAmount / poolLotry;
console.log('\n--- Pool Analysis ---');
console.log('Sell amount as % of pool:', (sellRatio * 100).toFixed(4) + '%');

// Using constant product formula: impact ≈ sellAmount / (poolLotry + sellAmount)
const theoreticalImpact = (sellAmount / (poolLotry + sellAmount)) * 100;
console.log('Theoretical impact (constant product):', theoreticalImpact.toFixed(4) + '%');

// Debug: Show if there's a unit mismatch
console.log('\n--- Debugging ---');
console.log('If quotePrice is in wrong units (e.g., 100x off):');
console.log('  quotePrice / 100:', (quotePrice / 100).toExponential());
console.log('  Impact would be:', (((quotePrice / 100) - refPrice) / refPrice * 100).toFixed(4) + '%');
