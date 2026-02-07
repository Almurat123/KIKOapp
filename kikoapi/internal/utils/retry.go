// Package utils: Exponential backoff retry (from kiko-api retryUtils.ts).

package utils

import (
	"context"
	"math"
	"math/rand"
	"net/http"
	"time"
)

// RetryConfig configures backoff behavior.
type RetryConfig struct {
	MaxRetries        int
	InitialDelayMs    int
	BackoffMultiplier float64
	MaxDelayMs        int
}

// DefaultRetryConfig returns Alchemy-style defaults.
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxRetries:        5,
		InitialDelayMs:    100,
		BackoffMultiplier: 2,
		MaxDelayMs:        30000,
	}
}

// WithExponentialBackoff runs fn with exponential backoff on retryable errors.
// Retryable: 429 or 5xx status. Returns last error if all retries fail.
func WithExponentialBackoff(ctx context.Context, fn func() error, config RetryConfig) error {
	if config.InitialDelayMs == 0 {
		config = DefaultRetryConfig()
	}
	var lastErr error
	for attempt := 0; attempt <= config.MaxRetries; attempt++ {
		lastErr = fn()
		if lastErr == nil {
			return nil
		}
		status := statusCodeFromError(lastErr)
		is429 := status == 429
		is5xx := status >= 500 && status < 600
		if !is429 && !is5xx {
			return lastErr
		}
		if attempt == config.MaxRetries {
			return lastErr
		}
		delay := time.Duration(config.InitialDelayMs) * time.Millisecond
		delay = time.Duration(float64(delay) * math.Pow(config.BackoffMultiplier, float64(attempt)))
		if maxD := time.Duration(config.MaxDelayMs) * time.Millisecond; delay > maxD {
			delay = maxD
		}
		jitter := time.Duration((rand.Float64()*2 - 1) * 0.1 * float64(delay))
		delay += jitter
		if delay < 0 {
			delay = 0
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(delay):
			continue
		}
	}
	return lastErr
}

// statusCodeFromError tries to extract HTTP status from error (e.g. *url.Error or custom type).
func statusCodeFromError(err error) int {
	type statusCoder interface{ StatusCode() int }
	if sc, ok := err.(statusCoder); ok {
		return sc.StatusCode()
	}
	// Check for common wrapped patterns
	if err != nil && err.Error() != "" {
		// Could parse "429 Too Many Requests" etc.; keep simple
	}
	return 0
}

// HTTPStatusCode allows errors to expose status code for retry logic.
type HTTPStatusCode int

func (c HTTPStatusCode) Error() string { return http.StatusText(int(c)) }
func (c HTTPStatusCode) StatusCode() int { return int(c) }
