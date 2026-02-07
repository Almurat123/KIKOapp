// Package cache: Redis client (from kiko-api cache/redis.ts).

package cache

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	client *redis.Client
)

// RedisConfig for connecting.
type RedisConfig struct {
	URL      string
	Host     string
	Port     int
	Password string
	Enabled  bool
}

// ConnectRedis initializes the Redis client. If Redis is disabled or fails, client stays nil.
func ConnectRedis(cfg RedisConfig) error {
	if !cfg.Enabled {
		return nil
	}
	if cfg.URL != "" {
		opt, err := redis.ParseURL(cfg.URL)
		if err != nil {
			return err
		}
		client = redis.NewClient(opt)
	} else {
		host := cfg.Host
		if host == "" {
			host = "localhost"
		}
		port := cfg.Port
		if port <= 0 {
			port = 6379
		}
		client = redis.NewClient(&redis.Options{
			Addr:     fmt.Sprintf("%s:%d", host, port),
			Password: cfg.Password,
		})
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		client = nil
		return err
	}
	return nil
}

// InitRedis is an alias for ConnectRedis.
func InitRedis(cfg RedisConfig) error {
	return ConnectRedis(cfg)
}

// Client returns the Redis client or nil if not connected.
func Client() *redis.Client {
	return client
}

// Get returns the value for key, or empty string if missing/error.
func Get(ctx context.Context, key string) (string, error) {
	if client == nil {
		return "", nil
	}
	val, err := client.Get(ctx, key).Result()
	if err == redis.Nil {
		return "", nil
	}
	return val, err
}

// Set stores value at key with optional TTL in seconds.
func Set(ctx context.Context, key, value string, ttlSeconds int) error {
	if client == nil {
		return nil
	}
	if ttlSeconds > 0 {
		return client.Set(ctx, key, value, time.Duration(ttlSeconds)*time.Second).Err()
	}
	return client.Set(ctx, key, value, 0).Err()
}

// Del deletes the key.
func Del(ctx context.Context, key string) error {
	if client == nil {
		return nil
	}
	return client.Del(ctx, key).Err()
}

// AcquireLock sets key to value only if not exists, with TTL. Returns true if acquired.
func AcquireLock(ctx context.Context, key, value string, ttlSeconds int) (bool, error) {
	if client == nil {
		return false, nil
	}
	if ttlSeconds <= 0 {
		ttlSeconds = 30
	}
	ok, err := client.SetNX(ctx, key, value, time.Duration(ttlSeconds)*time.Second).Result()
	return ok, err
}

// ReleaseLock deletes key only if it equals value (Lua script).
func ReleaseLock(ctx context.Context, key, value string) error {
	if client == nil {
		return nil
	}
	script := redis.NewScript(`if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end`)
	return script.Run(ctx, client, []string{key}, value).Err()
}

// IsRedisEnabled returns true if Redis is configured and connected.
func IsRedisEnabled() bool {
	return client != nil
}

// BuildRedisConfigFromEnv builds RedisConfig from environment (REDIS_URL or REDIS_HOST/PORT/PASSWORD).
func BuildRedisConfigFromEnv(getEnv func(string) string, getBool func(string) bool) RedisConfig {
	url := getEnv("REDIS_URL")
	host := getEnv("REDIS_HOST")
	if host == "" {
		host = "localhost"
	}
	port := 6379
	if p := getEnv("REDIS_PORT"); p != "" {
		fmt.Sscanf(p, "%d", &port)
	}
	enabled := true
	if getBool != nil && !getBool("REDIS_ENABLED") {
		enabled = false
	}
	return RedisConfig{
		URL:      url,
		Host:     host,
		Port:     port,
		Password: strings.TrimSpace(getEnv("REDIS_PASSWORD")),
		Enabled:  enabled,
	}
}
