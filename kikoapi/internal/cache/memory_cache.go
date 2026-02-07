// Package cache: In-memory cache (from kiko-api cache/memoryCache.ts).

package cache

import (
	"sync"
	"time"
)

type memoryEntry struct {
	data      interface{}
	timestamp time.Time
	ttl       time.Duration
}

// MemoryCache is a TTL in-memory cache.
type MemoryCache struct {
	mu    sync.RWMutex
	cache map[string]memoryEntry
}

// NewMemoryCache creates a new memory cache.
func NewMemoryCache() *MemoryCache {
	return &MemoryCache{cache: make(map[string]memoryEntry)}
}

// Get returns the value for key or nil if missing/expired.
func (m *MemoryCache) Get(key string) interface{} {
	m.mu.RLock()
	entry, ok := m.cache[key]
	m.mu.RUnlock()
	if !ok {
		return nil
	}
	if entry.ttl > 0 && time.Since(entry.timestamp) > entry.ttl {
		m.mu.Lock()
		delete(m.cache, key)
		m.mu.Unlock()
		return nil
	}
	return entry.data
}

// Set stores value with optional TTL. ttlMs 0 means no expiry.
func (m *MemoryCache) Set(key string, data interface{}, ttlMs int) {
	ttl := time.Duration(ttlMs) * time.Millisecond
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache[key] = memoryEntry{
		data:      data,
		timestamp: time.Now(),
		ttl:       ttl,
	}
}

// Delete removes the key.
func (m *MemoryCache) Delete(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.cache, key)
}

// Clear removes all entries.
func (m *MemoryCache) Clear() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.cache = make(map[string]memoryEntry)
}
