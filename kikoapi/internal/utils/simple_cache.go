// Package utils: In-memory TTL cache (from kiko-api simpleCache.ts).

package utils

import (
	"sync"
	"time"
)

type cacheEntry struct {
	value  interface{}
	expiry time.Time
}

// SimpleCache is a TTL in-memory cache.
type SimpleCache struct {
	mu     sync.RWMutex
	cache  map[string]cacheEntry
	ttl    time.Duration
	maxLen int
}

// NewSimpleCache creates a cache with default TTL. defaultTtlMs: milliseconds.
func NewSimpleCache(defaultTtlMs int) *SimpleCache {
	if defaultTtlMs <= 0 {
		defaultTtlMs = 3600 * 1000
	}
	return &SimpleCache{
		cache:  make(map[string]cacheEntry),
		ttl:    time.Duration(defaultTtlMs) * time.Millisecond,
		maxLen: 10000,
	}
}

// Set stores value with optional ttl override (ms).
func (c *SimpleCache) Set(key string, value interface{}, ttlMs ...int) {
	ttl := c.ttl
	if len(ttlMs) > 0 && ttlMs[0] > 0 {
		ttl = time.Duration(ttlMs[0]) * time.Millisecond
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[key] = cacheEntry{value: value, expiry: time.Now().Add(ttl)}
	if len(c.cache) > c.maxLen {
		c.cleanupLocked()
	}
}

// Get returns the value or nil if missing/expired.
func (c *SimpleCache) Get(key string) interface{} {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.cache[key]
	if !ok {
		return nil
	}
	if time.Now().After(e.expiry) {
		delete(c.cache, key)
		return nil
	}
	return e.value
}

// Has returns true if key exists and is not expired.
func (c *SimpleCache) Has(key string) bool {
	return c.Get(key) != nil
}

// Delete removes the key.
func (c *SimpleCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.cache, key)
}

// Clear removes all entries.
func (c *SimpleCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache = make(map[string]cacheEntry)
}

func (c *SimpleCache) cleanupLocked() {
	now := time.Now()
	for k, e := range c.cache {
		if now.After(e.expiry) {
			delete(c.cache, k)
		}
	}
}
