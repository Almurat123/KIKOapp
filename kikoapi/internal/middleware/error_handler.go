// Package middleware: Error handling (from kiko-api middleware/errorHandler.ts).

package middleware

import (
	"encoding/json"
	"log"
	"net/http"
	"runtime/debug"
)

// AppError represents an API error with status and code.
type AppError struct {
	StatusCode int    `json:"-"`
	Code       string `json:"code"`
	Message    string `json:"message"`
	RequestID  string `json:"requestId,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

// ErrorResponse is the JSON body for errors.
type ErrorResponse struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	RequestID string `json:"requestId,omitempty"`
}

// ErrorHandler recovers panics and writes consistent JSON error responses.
func ErrorHandler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("[ErrorHandler] panic: %v\n%s", rec, debug.Stack())
				writeError(w, r, 500, "INTERNAL_ERROR", "Internal server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

// NotFoundHandler responds with 404 JSON.
func NotFoundHandler(w http.ResponseWriter, r *http.Request) {
	writeError(w, r, 404, "NOT_FOUND", "Not found")
}

func writeError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	reqID := r.Header.Get("X-Request-Id")
	if reqID == "" {
		reqID = r.Header.Get("X-Request-ID")
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(ErrorResponse{
		Error:     struct{ Code string `json:"code"`; Message string `json:"message"` }{Code: code, Message: message},
		RequestID: reqID,
	})
}

// RespondWithError writes an AppError as JSON.
func RespondWithError(w http.ResponseWriter, r *http.Request, err *AppError) {
	writeError(w, r, err.StatusCode, err.Code, err.Message)
}
