package swap

import (
	"fmt"
	"math/big"
	"strings"
)

// ToBaseUnits converts human-readable amount to base units (wei/smallest unit).
func ToBaseUnits(amount string, decimals int) (string, error) {
	parts := strings.Split(strings.TrimSpace(amount), ".")
	if len(parts) > 2 {
		return "", fmt.Errorf("invalid amount: %s", amount)
	}
	whole := parts[0]
	if whole == "" {
		whole = "0"
	}
	frac := ""
	if len(parts) == 2 {
		frac = parts[1]
	}
	if len(frac) > decimals {
		frac = frac[:decimals]
	}
	combined := whole + frac
	for i := len(frac); i < decimals; i++ {
		combined += "0"
	}
	z := new(big.Int)
	if _, ok := z.SetString(combined, 10); !ok {
		return "", fmt.Errorf("invalid amount: %s", amount)
	}
	return z.String(), nil
}

// FromBaseUnits converts base units to human-readable amount.
func FromBaseUnits(amountBase string, decimals int) (string, error) {
	z := new(big.Int)
	if _, ok := z.SetString(amountBase, 10); !ok {
		return "", fmt.Errorf("invalid base amount: %s", amountBase)
	}
	if decimals <= 0 {
		return z.String(), nil
	}
	div := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	whole := new(big.Int).Div(z, div)
	rem := new(big.Int).Mod(z, div)
	s := whole.String()
	if rem.Sign() > 0 {
		frac := rem.String()
		for len(frac) < decimals {
			frac = "0" + frac
		}
		s += "." + strings.TrimRight(frac, "0")
	}
	return s, nil
}

// ParseSwapError maps common error messages to user-friendly text.
func ParseSwapError(err interface{}) string {
	var msg string
	switch v := err.(type) {
	case error:
		msg = v.Error()
	case string:
		msg = v
	default:
		msg = "Unknown error"
	}
	msgLower := strings.ToLower(msg)
	if strings.Contains(msgLower, "insufficient funds") || strings.Contains(msgLower, "insufficient balance") {
		return "Insufficient funds for gas or transaction"
	}
	if strings.Contains(msgLower, "execution reverted") {
		return "Transaction would fail (likely due to slippage, token tax, or insufficient approval)"
	}
	if strings.Contains(msgLower, "user rejected") || strings.Contains(msgLower, "user denied") {
		return "User rejected transaction"
	}
	if strings.Contains(msgLower, "slippage") || strings.Contains(msgLower, "slippage_reached") {
		return "Slippage tolerance exceeded"
	}
	if strings.Contains(msgLower, "network") || strings.Contains(msgLower, "timeout") || strings.Contains(msgLower, "etimedout") {
		return "Network error - please try again"
	}
	if strings.Contains(msgLower, "no route matched") || strings.Contains(msgLower, "no route found") {
		return "No liquidity route found for this token pair"
	}
	if len(msg) > 200 {
		return msg[:200] + "..."
	}
	return msg
}

// AddGasBuffer adds a percentage buffer to gas estimate.
func AddGasBuffer(gasEstimate string, bufferPercent int) (string, error) {
	z := new(big.Int)
	if _, ok := z.SetString(gasEstimate, 10); !ok {
		return "", fmt.Errorf("invalid gas estimate: %s", gasEstimate)
	}
	if bufferPercent <= 0 {
		bufferPercent = 30
	}
	buffer := new(big.Int).Mul(z, big.NewInt(int64(bufferPercent)))
	buffer.Div(buffer, big.NewInt(100))
	z.Add(z, buffer)
	return z.String(), nil
}

// FeeContext is the context for platform fees.
type FeeContext string

const (
	FeeContextSwap       FeeContext = "swap"
	FeeContextLaunchpad  FeeContext = "launchpad"
	FeeContextCopyTrade  FeeContext = "copy_trade"
)
