// Package middleware: Auth (from kiko-api middleware/auth.ts).
// Privy JWT validation; stub when JWKS not configured.

package middleware

import (
	"net/http"
	"strings"
)

// ContextKey type for request context keys.
type ContextKey string

const (
	// ContextKeyUserID is the context key for authenticated user ID (Privy DID or sub).
	ContextKeyUserID ContextKey = "userId"
)

// AuthMiddleware validates Bearer token and sets user ID in context.
// When Privy is not configured, passes through without setting user.
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" {
			next.ServeHTTP(w, r)
			return
		}
		if !strings.HasPrefix(auth, "Bearer ") {
			next.ServeHTTP(w, r)
			return
		}
		token := strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		if token == "" {
			next.ServeHTTP(w, r)
			return
		}
		// TODO: verify Privy JWT with JWKS and set context from payload sub/did
		// For now we do not set user so routes can treat as unauthenticated
		_ = token
		next.ServeHTTP(w, r)
	})
}

// RequireAuth responds 401 if no user in context (use after AuthMiddleware when verification is enabled).
func RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Context().Value(ContextKeyUserID) == nil {
			RespondWithError(w, r, &AppError{StatusCode: 401, Code: "UNAUTHORIZED", Message: "Authentication required"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
