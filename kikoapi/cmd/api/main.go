// Package main is the entry point for the KIKO API server.
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"kikoapi/internal/cache"
	"kikoapi/internal/config"
	"kikoapi/internal/db"
	"kikoapi/internal/handlers/routes"
	"kikoapi/internal/jobs"
	mw "kikoapi/internal/middleware"
	"kikoapi/internal/repositories"
	"kikoapi/internal/services"
)

func main() {
	env, err := config.LoadEnv()
	if err != nil {
		fmt.Fprintf(os.Stderr, "config: %v\n", err)
		os.Exit(1)
	}

	database, err := db.OpenDB(env.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer func() { _ = db.Close(database) }()

	if !db.TestConnection(database) {
		fmt.Fprintf(os.Stderr, "db: connection test failed\n")
		os.Exit(1)
	}

	redisCfg := cache.RedisConfig{
		URL:      os.Getenv("REDIS_URL"),
		Host:     env.Redis.Host,
		Port:     env.Redis.Port,
		Password: env.Redis.Password,
		Enabled:  true,
	}
	_ = cache.ConnectRedis(redisCfg)

	chainRepo := repositories.NewChainRepository(database)
	chainSvc := services.NewChainService(chainRepo)
	healthSvc := services.NewHealthService()
	marketRepo := repositories.NewMarketRepository(database)
	billingRepo := repositories.NewBillingRepository(database)
	protocolRepo := repositories.NewProtocolRepository(database)

	r := chi.NewRouter()
	routes.Register(r, routes.Config{
		HealthService:   healthSvc,
		ChainService:    chainSvc,
		MarketRepo:      marketRepo,
		BillingRepo:     billingRepo,
		ProtocolRepo:    protocolRepo,
		RateLimitConfig: mw.RateLimiterConfig{
			WindowSec:   env.APIConfig.RateLimit.WindowMs / 1000,
			MaxRequests: env.APIConfig.RateLimit.MaxRequests,
			SkipPaths:   []string{"/health", "/api/health"},
		},
	})

	r.NotFound(http.HandlerFunc(mw.NotFoundHandler))

	jobRunner := jobs.NewRunner()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	_ = jobRunner.Start(ctx)
	defer jobRunner.Stop()

	addr := fmt.Sprintf(":%d", env.Port)
	srv := &http.Server{Addr: addr, Handler: r, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "http: %v\n", err)
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdownCtx)
}
