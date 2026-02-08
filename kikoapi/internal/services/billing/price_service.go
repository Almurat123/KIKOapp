package billing

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"strconv"
	"sync"
	"time"

	"kikoapi/internal/config"
)

// PriceQuote is the cached billing token price from DexScreener.
type PriceQuote struct {
	PriceUsd    float64 `json:"priceUsd"`
	LiquidityUsd float64 `json:"liquidityUsd"`
	PairAddress string  `json:"pairAddress,omitempty"`
	FetchedAt   int64   `json:"fetchedAt"`
	Source      string  `json:"source"`
}

// dexPair matches DexScreener tokens/v1 response.
type dexPair struct {
	ChainID     string  `json:"chainId"`
	PriceUsd    string  `json:"priceUsd"`
	Liquidity   *struct { Usd interface{} `json:"usd"` } `json:"liquidity"`
	PairAddress string  `json:"pairAddress"`
}

// PriceService fetches and caches the billing token USD price from DexScreener.
type PriceService struct {
	cfg   *config.BillingConfig
	mu    sync.Mutex
	cache *PriceQuote
	client *http.Client
}

// NewPriceService creates a PriceService with the given config.
func NewPriceService(cfg *config.BillingConfig) *PriceService {
	return &PriceService{
		cfg: cfg,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

func (s *PriceService) isFresh(q *PriceQuote) bool {
	if q == nil {
		return false
	}
	ttlMs := int64(s.cfg.PriceCacheTtlSec) * 1000
	return time.Now().UnixMilli()-q.FetchedAt <= ttlMs
}

// GetBillingTokenPriceUsd returns the current USD price quote (cached if fresh).
func (s *PriceService) GetBillingTokenPriceUsd(ctx context.Context) (*PriceQuote, error) {
	s.mu.Lock()
	if s.isFresh(s.cache) {
		q := s.cache
		s.mu.Unlock()
		return q, nil
	}
	s.mu.Unlock()

	if s.cfg.TokenAddress == "" {
		return nil, ErrBillingTokenNotConfigured
	}

	chainSlug := "base"
	url := "https://api.dexscreener.com/tokens/v1/" + chainSlug + "/" + s.cfg.TokenAddress

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var pairs []dexPair
	if err := json.NewDecoder(resp.Body).Decode(&pairs); err != nil {
		return nil, err
	}
	if len(pairs) == 0 {
		return nil, ErrNoPairs
	}

	type pairInfo struct {
		priceUsd    float64
		liquidityUsd float64
		pairAddress string
	}
	var eligible []pairInfo
	for _, p := range pairs {
		if p.ChainID != chainSlug {
			continue
		}
		priceUsd := parseFloat(p.PriceUsd)
		var liq float64
		if p.Liquidity != nil && p.Liquidity.Usd != nil {
			switch v := p.Liquidity.Usd.(type) {
			case string:
				liq = parseFloat(v)
			case float64:
				liq = v
			case int:
				liq = float64(v)
			}
		}
		if isFinite(priceUsd) && isFinite(liq) {
			eligible = append(eligible, pairInfo{priceUsd, liq, p.PairAddress})
		}
	}
	if len(eligible) == 0 {
		return nil, ErrNoEligiblePairs
	}

	// Sort by liquidity descending and take best
	best := eligible[0]
	for i := 1; i < len(eligible); i++ {
		if eligible[i].liquidityUsd > best.liquidityUsd {
			best = eligible[i]
		}
	}
	if best.liquidityUsd < s.cfg.MinLiquidityUsd || best.priceUsd <= 0 {
		return nil, ErrPriceRejected
	}

	q := &PriceQuote{
		PriceUsd:     best.priceUsd,
		LiquidityUsd: best.liquidityUsd,
		PairAddress:  best.pairAddress,
		FetchedAt:    time.Now().UnixMilli(),
		Source:       "dexscreener",
	}
	s.mu.Lock()
	s.cache = q
	s.mu.Unlock()
	return q, nil
}

// Errors for price service.
var (
	ErrBillingTokenNotConfigured = &errBilling{msg: "billing token address is not configured"}
	ErrNoPairs                  = &errBilling{msg: "DexScreener returned no pairs for billing token"}
	ErrNoEligiblePairs          = &errBilling{msg: "DexScreener returned no eligible Base pairs for billing token"}
	ErrPriceRejected            = &errBilling{msg: "DexScreener price rejected due to low liquidity or zero price"}
)

type errBilling struct{ msg string }

func (e *errBilling) Error() string { return e.msg }

func parseFloat(s string) float64 {
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func isFinite(f float64) bool {
	return !math.IsNaN(f) && !math.IsInf(f, 0)
}
