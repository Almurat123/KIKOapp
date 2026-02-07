// Package utils: Scrub sensitive data (from kiko-api scrubber.ts).

package utils

import (
	"regexp"
)

var (
	evmPrivateKeyRe   = regexp.MustCompile(`\b(0x)?[a-fA-F0-9]{64}\b`)
	solanaPrivateKeyRe = regexp.MustCompile(`\b[1-9A-HJ-NP-Za-km-z]{87,88}\b`)
	genericApiKeyRe   = regexp.MustCompile(`(?i)\b(sk|privy|ak|pk)_(live|test)_[a-zA-Z0-9]{20,}\b`)
	internalPathRe    = regexp.MustCompile(`/Users/[a-zA-Z0-9_-]+/[^\s]+`)
)

// Scrub masks sensitive patterns in text (private keys, API keys, paths).
func Scrub(text string) string {
	if text == "" {
		return text
	}
	out := evmPrivateKeyRe.ReplaceAllStringFunc(text, func(m string) string {
		if len(m) <= 8 {
			return "[REDACTED_KEY]"
		}
		return m[:4] + "...[REDACTED_KEY]..." + m[len(m)-4:]
	})
	out = solanaPrivateKeyRe.ReplaceAllString(out, "[REDACTED_SOL_KEY]")
	out = genericApiKeyRe.ReplaceAllString(out, "[REDACTED_API_KEY]")
	out = internalPathRe.ReplaceAllString(out, "[REDACTED_PATH]")
	return out
}
