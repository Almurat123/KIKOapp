package services

import (
	"context"

	"kikoapi/internal/services/swap"
)

// QuoteResult is the result of getting a best quote (provider + quote).
type QuoteResult struct {
	Provider string
	Quote    *swap.SwapQuote
}

// QuoteService gets the best swap quote across providers.
type QuoteService struct {
	Providers []swap.SwapProvider
}

// GetBestQuote returns the best quote for the request. Stub: returns nil until providers are wired.
func (q *QuoteService) GetBestQuote(ctx context.Context, req *swap.SwapRequest) (*QuoteResult, error) {
	if q == nil || len(q.Providers) == 0 {
		return nil, nil
	}
	for _, p := range q.Providers {
		quote, err := p.GetQuote(ctx, req)
		if err != nil || quote == nil {
			continue
		}
		return &QuoteResult{Provider: p.Name(), Quote: quote}, nil
	}
	return nil, nil
}
