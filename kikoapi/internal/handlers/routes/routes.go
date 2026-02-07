// Package routes registers HTTP routes (from kiko-api src/routes).

package routes

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	mw "kikoapi/internal/middleware"
	"kikoapi/internal/services"
)

// Config holds dependencies for routes.
type Config struct {
	HealthService    *services.HealthService
	ChainService     *services.ChainService
	RateLimitConfig  mw.RateLimiterConfig
}

// Register mounts all routes on r.
func Register(r chi.Router, cfg Config) {
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(mw.ErrorHandler)
	r.Use(mw.RateLimiter(cfg.RateLimitConfig))
	r.Use(mw.AuthMiddleware)

	r.Get("/health", handleHealth(cfg.HealthService))
	r.Get("/api/health", handleHealth(cfg.HealthService))
	r.Route("/api", func(r chi.Router) {
		r.Get("/chains", handleChains(cfg.ChainService))
	})
}

func handleHealth(s *services.HealthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ok := s != nil && s.OK()
		w.Header().Set("Content-Type", "application/json")
		if ok {
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"status": "ok"})
		} else {
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"status": "unavailable"})
		}
	}
}

func handleChains(s *services.ChainService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s == nil {
			http.Error(w, `{"error":"not configured"}`, http.StatusNotImplemented)
			return
		}
		chains, err := s.ListChains(r.Context())
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(chains)
	}
}
