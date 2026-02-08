// Package routes registers HTTP routes (from kiko-api src/routes).

package routes

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	mw "kikoapi/internal/middleware"
	"kikoapi/internal/repositories"
	"kikoapi/internal/services"
)

// Config holds dependencies for routes.
type Config struct {
	HealthService   *services.HealthService
	ChainService    *services.ChainService
	RateLimitConfig mw.RateLimiterConfig
	// Optional: for market, billing, etc.
	MarketRepo   *repositories.MarketRepository
	BillingRepo  *repositories.BillingRepository
	ProtocolRepo *repositories.ProtocolRepository
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
		// Market
		r.Route("/market", func(r chi.Router) {
			r.Get("/overview", handleMarketOverview(cfg.MarketRepo))
			r.Post("/refresh", handleMarketRefresh(cfg.MarketRepo))
			r.Get("/chains", handleMarketChains(cfg.MarketRepo, cfg.ChainService))
			r.Get("/protocols", handleMarketProtocols(cfg.ProtocolRepo))
		})
		// Billing (stub responses when repo nil)
		r.Route("/billing", func(r chi.Router) {
			r.Get("/consent", handleBillingConsent(cfg.BillingRepo))
			r.Get("/usage", handleBillingUsage(cfg.BillingRepo))
		})
		// Tokens, swap, social, etc. - stub handlers
		r.Get("/tokens/trending", handleTokensTrending())
		r.Get("/tokens/search", handleTokensSearch())
		r.Route("/swap", func(r chi.Router) {
			r.Get("/quote", handleSwapQuote())
			r.Post("/execute", handleSwapExecute())
		})
		r.Get("/social/trending", handleSocialTrending())
		r.Get("/news", handleNews())
		r.Get("/favorites", handleFavorites())
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

func handleMarketOverview(repo *repositories.MarketRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if repo == nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": nil, "message": "Market overview not available."})
			return
		}
		data, err := repo.GetMarketOverview(r.Context())
		if err != nil || data == nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": nil})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": data})
	}
}

func handleMarketRefresh(repo *repositories.MarketRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "message": "Refresh triggered (job not wired)."})
	}
}

func handleMarketChains(marketRepo *repositories.MarketRepository, chainSvc *services.ChainService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if marketRepo != nil {
			chains, _ := marketRepo.GetChainsData(r.Context())
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": chains})
			return
		}
		if chainSvc != nil {
			chains, _ := chainSvc.ListChains(r.Context())
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": chains})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": []interface{}{}})
	}
}

func handleMarketProtocols(repo *repositories.ProtocolRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if repo == nil {
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": []interface{}{}})
			return
		}
		list, _ := repo.ListProtocols(r.Context())
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": list})
	}
}

func handleBillingConsent(repo *repositories.BillingRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"active": false, "termsVersion": "billing-terms-v1"})
	}
}

func handleBillingUsage(repo *repositories.BillingRepository) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"usage": 0, "limit": 0})
	}
}

func handleTokensTrending() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": []interface{}{}})
	}
}

func handleTokensSearch() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": []interface{}{}})
	}
}

func handleSwapQuote() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "Quote not implemented"})
	}
}

func handleSwapExecute() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotImplemented)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": false, "error": "Swap execute not implemented"})
	}
}

func handleSocialTrending() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": []interface{}{}})
	}
}

func handleNews() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": []interface{}{}})
	}
}

func handleFavorites() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"success": true, "data": []interface{}{}})
	}
}
