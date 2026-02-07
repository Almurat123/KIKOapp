// Package middleware: Rate limiter (from kiko-api middleware/rateLimiter.ts).

package middleware

import (
	"net/http"
	"sync"
	"time"
)

// RateLimiterConfig holds window and max requests.
type RateLimiterConfig struct {
	WindowSec    int
	MaxRequests  int
	SkipInTest   bool
	SkipPaths    []string // e.g. /health, /api/health
}

// RateLimiter returns middleware that limits requests per identifier (IP or user).
// Uses in-memory store; Redis-based limiting can be added later via cache package.
func RateLimiter(cfg RateLimiterConfig) func(next http.Handler) http.Handler {
	if cfg.WindowSec <= 0 {
		cfg.WindowSec = 60
	}
	if cfg.MaxRequests <= 0 {
		cfg.MaxRequests = 200
	}
	return rateLimitMemory(cfg)
}

func rateLimitMemory(cfg RateLimiterConfig) func(next http.Handler) http.Handler {
	type entry struct {
		count int
		start time.Time
	}
	var mu sync.Mutex
	store := make(map[string]*entry)
	go func() {
		tick := time.NewTicker(time.Duration(cfg.WindowSec) * time.Second)
		defer tick.Stop()
		for range tick.C {
			mu.Lock()
			now := time.Now()
			for k, v := range store {
				if now.Sub(v.start) > time.Duration(cfg.WindowSec)*time.Second {
					delete(store, k)
				}
			}
			mu.Unlock()
		}
	}()
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if skipRateLimit(r, cfg) {
				next.ServeHTTP(w, r)
				return
			}
			key := "i:" + r.RemoteAddr
			mu.Lock()
			e, ok := store[key]
			if !ok || time.Since(e.start) > time.Duration(cfg.WindowSec)*time.Second {
				e = &entry{count: 1, start: time.Now()}
				store[key] = e
			} else {
				e.count++
			}
			count := e.count
			mu.Unlock()
			if count > cfg.MaxRequests {
				writeError(w, r, 429, "RATE_LIMITED", "Too many requests")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func skipRateLimit(r *http.Request, cfg RateLimiterConfig) bool {
	path := r.URL.Path
	for _, p := range cfg.SkipPaths {
		if path == p {
			return true
		}
	}
	return false
}
