// Package utils: Sanitizer / redact (from kiko-api sanitizer.ts).

package utils

import (
	"regexp"
	"strings"
)

var (
	sensitiveKeys = []string{"api", "key", "apikey", "api_key", "secret", "token", "auth", "authorization", "bearer", "password", "pwd", "jwt", "database", "db_url", "jwks", "private", "mnemonic", "seed"}
	urlSensitiveParams = []string{"api_key", "apikey", "key", "token", "auth", "access_token"}
	bearerRe = regexp.MustCompile(`(?i)Bearer\s+[a-zA-Z0-9\-_.]+`)
)

func keyContainsSensitive(key string) bool {
	lower := strings.ToLower(key)
	for _, k := range sensitiveKeys {
		if strings.Contains(lower, k) {
			return true
		}
	}
	return false
}

// RedactUrl redacts sensitive query parameters from a URL.
func RedactUrl(url string) string {
	if url == "" || (!strings.Contains(url, "?") && !strings.Contains(url, "=")) {
		return url
	}
	out := url
	for _, param := range urlSensitiveParams {
		re := regexp.MustCompile(`(?i)([?&]` + regexp.QuoteMeta(param) + `=)([^&\s]+)`)
		out = re.ReplaceAllString(out, "${1}[REDACTED]")
	}
	return out
}

// RedactString redacts bearer tokens and key=value in strings.
func RedactString(s string) string {
	out := bearerRe.ReplaceAllString(s, "Bearer [REDACTED]")
	for _, param := range urlSensitiveParams {
		re := regexp.MustCompile(`(?i)(` + regexp.QuoteMeta(param) + `=)([^&\s]+)`)
		out = re.ReplaceAllString(out, "${1}[REDACTED]")
	}
	return out
}
