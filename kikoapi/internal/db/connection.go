// Package db: Database connection (from kiko-api db/connection.ts, prisma.ts).

package db

import (
	"strings"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// OpenDB opens a PostgreSQL connection from dsn (e.g. DATABASE_URL).
func OpenDB(dsn string) (*gorm.DB, error) {
	if dsn == "" {
		dsn = "postgresql://localhost:5432/kiko_db?sslmode=disable"
	}
	return gorm.Open(postgres.Open(dsn), &gorm.Config{
		PrepareStmt: true,
		NowFunc:     func() time.Time { return time.Now().UTC() },
	})
}

// TestConnection runs SELECT 1 and returns true if successful.
func TestConnection(db *gorm.DB) bool {
	sqlDB, err := db.DB()
	if err != nil {
		return false
	}
	return sqlDB.Ping() == nil
}

// Close closes the underlying *sql.DB.
func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// WithRetry runs fn with simple retry on connection errors (e.g. P1017).
func WithRetry[T any](db *gorm.DB, fn func() (T, error), maxRetries int, delayMs int) (T, error) {
	var zero T
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		v, err := fn()
		if err == nil {
			return v, nil
		}
		lastErr = err
		msg := err.Error()
		if !isRetryableDBError(msg) {
			return zero, err
		}
		if i < maxRetries-1 {
			time.Sleep(time.Duration(delayMs*(i+1)) * time.Millisecond)
		}
	}
	return zero, lastErr
}

func isRetryableDBError(msg string) bool {
	return strings.Contains(msg, "closed the connection") ||
		strings.Contains(msg, "Closed, cause: None") ||
		strings.Contains(msg, "connection_limit") ||
		strings.Contains(msg, "P1017")
}
