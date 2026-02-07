// Package utils: Logger using slog (from kiko-api logger.ts).

package utils

import (
	"log/slog"
	"os"
	"strings"
)

// LogLevel for filtering.
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

func parseLogLevel(s string) LogLevel {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "debug":
		return LogLevelDebug
	case "info":
		return LogLevelInfo
	case "warn":
		return LogLevelWarn
	case "error":
		return LogLevelError
	default:
		return LogLevelInfo
	}
}

// Logger wraps slog with code and level filtering.
type Logger struct {
	level  LogLevel
	inner  *slog.Logger
}

// NewLogger creates a logger with the given level string (e.g. from config).
func NewLogger(level string) *Logger {
	lvl := parseLogLevel(level)
	var slogLevel slog.Level
	switch lvl {
	case LogLevelDebug:
		slogLevel = slog.LevelDebug
	case LogLevelInfo:
		slogLevel = slog.LevelInfo
	case LogLevelWarn:
		slogLevel = slog.LevelWarn
	case LogLevelError:
		slogLevel = slog.LevelError
	default:
		slogLevel = slog.LevelInfo
	}
	opts := &slog.HandlerOptions{Level: slogLevel}
	handler := slog.NewTextHandler(os.Stdout, opts)
	return &Logger{level: lvl, inner: slog.New(handler)}
}

// Debug logs with code (e.g. config.LogSysInfo).
func (l *Logger) Debug(code, message string, keyvals ...any) {
	if l.level > LogLevelDebug {
		return
	}
	args := append([]any{"code", code}, keyvals...)
	l.inner.Debug(message, args...)
}

// Info logs with code.
func (l *Logger) Info(code, message string, keyvals ...any) {
	if l.level > LogLevelInfo {
		return
	}
	args := append([]any{"code", code}, keyvals...)
	l.inner.Info(message, args...)
}

// Warn logs with code.
func (l *Logger) Warn(code, message string, keyvals ...any) {
	if l.level > LogLevelWarn {
		return
	}
	args := append([]any{"code", code}, keyvals...)
	l.inner.Warn(message, args...)
}

// Error logs with code.
func (l *Logger) Error(code, message string, keyvals ...any) {
	if l.level > LogLevelError {
		return
	}
	args := append([]any{"code", code}, keyvals...)
	l.inner.Error(message, args...)
}

// Default logger instance (set by main or tests).
var DefaultLogger *Logger

func init() {
	level := os.Getenv("LOG_LEVEL")
	if level == "" {
		level = "info"
	}
	DefaultLogger = NewLogger(level)
}
