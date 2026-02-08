package dex

import (
	"math"
	"math/big"
)

var (
	q96 = new(big.Int).Exp(big.NewInt(2), big.NewInt(96), nil)
)

// GetTokenAmountsFromLiquidity computes token0/token1 amounts from V3 liquidity and sqrtPriceX96.
func GetTokenAmountsFromLiquidity(sqrtPriceX96, liquidity *big.Int, decimals0, decimals1 int) (amount0, amount1 float64) {
	if sqrtPriceX96 == nil || liquidity == nil {
		return 0, 0
	}
	// sqrtPrice = sqrtPriceX96 / 2^96
	num := new(big.Float).SetInt(sqrtPriceX96)
	denom := new(big.Float).SetInt(q96)
	sqrtPrice, _ := new(big.Float).Quo(num, denom).Float64()
	L := new(big.Float).SetInt(liquidity)
	Lf, _ := L.Float64()
	amount0Raw := Lf / sqrtPrice
	amount1Raw := Lf * sqrtPrice
	amount0 = amount0Raw / math.Pow(10, float64(decimals0))
	amount1 = amount1Raw / math.Pow(10, float64(decimals1))
	return amount0, amount1
}

// CalculateV3TVL returns V3 pool TVL in USD.
func CalculateV3TVL(sqrtPriceX96, liquidity *big.Int, decimals0, decimals1 int, price0USD, price1USD float64) float64 {
	a0, a1 := GetTokenAmountsFromLiquidity(sqrtPriceX96, liquidity, decimals0, decimals1)
	return a0*price0USD + a1*price1USD
}

// GetPriceFromSqrtX96 returns token1/token0 price from sqrtPriceX96.
func GetPriceFromSqrtX96(sqrtPriceX96 *big.Int, decimals0, decimals1 int) float64 {
	if sqrtPriceX96 == nil {
		return 0
	}
	num := new(big.Float).SetInt(sqrtPriceX96)
	denom := new(big.Float).SetInt(q96)
	sqrtPrice, _ := new(big.Float).Quo(num, denom).Float64()
	price := sqrtPrice * sqrtPrice
	return price * math.Pow(10, float64(decimals0-decimals1))
}
