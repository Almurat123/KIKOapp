// Package utils: Address normalization (from kiko-api address.ts).

package utils

import (
	"regexp"
	"strings"
)

var solanaAddressRe = regexp.MustCompile(`^[1-9A-HJ-NP-Za-km-z]{32,44}$`)

// NormalizeAddress normalizes an address by chain type.
// EVM (0x...) is lowercased; Solana (base58) is preserved.
func NormalizeAddress(address string) string {
	s := strings.TrimSpace(address)
	if s == "" {
		return ""
	}
	if strings.HasPrefix(s, "0x") {
		return strings.ToLower(s)
	}
	if solanaAddressRe.MatchString(s) {
		return s
	}
	return strings.ToLower(s)
}

// IsSolanaAddress returns true if the string looks like a Solana base58 address.
func IsSolanaAddress(address string) bool {
	if address == "" {
		return false
	}
	return solanaAddressRe.MatchString(strings.TrimSpace(address))
}
