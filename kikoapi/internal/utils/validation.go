// Package utils: Validation helpers (from kiko-api validation.ts).

package utils

import (
	"errors"
	"strconv"
	"strings"
)

// SupportedChainIDs for validateChainId.
var SupportedChainIDs = map[int]struct{}{
	1:    {},
	8453: {},
	42161: {},
	137:  {},
	10:   {},
	56:   {},
	900:  {},
}

// ValidateLimit clamps limit to [defaultLimit, maxLimit].
func ValidateLimit(limit int, defaultLimit, maxLimit int) int {
	if limit <= 0 {
		return defaultLimit
	}
	if limit > maxLimit {
		return maxLimit
	}
	return limit
}

// ValidateLimitFromString parses limit from string and validates.
func ValidateLimitFromString(s string, defaultLimit, maxLimit int) int {
	val, err := strconv.Atoi(s)
	if err != nil || val <= 0 {
		return defaultLimit
	}
	return ValidateLimit(val, defaultLimit, maxLimit)
}

// ValidateAddress returns true if address looks like EVM (0x + 42) or Solana (32-44).
func ValidateAddress(address string) bool {
	if address == "" {
		return false
	}
	s := strings.TrimSpace(address)
	if strings.HasPrefix(s, "0x") && len(s) == 42 {
		return true
	}
	if len(s) >= 32 && len(s) <= 44 {
		return true
	}
	return false
}

// ValidateChainId parses chainId and checks it's supported.
func ValidateChainId(chainIdStr string) (int, error) {
	val, err := strconv.Atoi(chainIdStr)
	if err != nil {
		return 0, err
	}
	if _, ok := SupportedChainIDs[val]; !ok {
		return 0, ErrUnsupportedChainID
	}
	return val, nil
}

// ErrUnsupportedChainID is returned by ValidateChainId.
var ErrUnsupportedChainID = errors.New("unsupported chainId")

// ValidateAmount parses amount and returns non-negative string.
func ValidateAmount(amount string) string {
	if amount == "" {
		return "0"
	}
	val, err := strconv.ParseFloat(amount, 64)
	if err != nil || val < 0 {
		return "0"
	}
	return strconv.FormatFloat(val, 'f', -1, 64)
}

// ValidateTimeframe returns one of 1h, 4h, 24h, 7d, 30d or default "24h".
func ValidateTimeframe(timeframe string) string {
	supported := map[string]struct{}{"1h": {}, "4h": {}, "24h": {}, "7d": {}, "30d": {}}
	if timeframe == "" {
		return "24h"
	}
	if _, ok := supported[timeframe]; ok {
		return timeframe
	}
	return "24h"
}

// SanitizeString strips <> and truncates to maxLength.
func SanitizeString(s string, maxLength int) string {
	if maxLength <= 0 {
		maxLength = 255
	}
	s = strings.ReplaceAll(s, "<", "")
	s = strings.ReplaceAll(s, ">", "")
	s = strings.TrimSpace(s)
	if len(s) > maxLength {
		return s[:maxLength]
	}
	return s
}
