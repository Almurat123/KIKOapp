package services

import "context"

// OGPResult holds Open Graph (og:title, og:image, etc.) for a URL.
type OGPResult struct {
	Title       string
	Description string
	Image       string
	URL         string
}

// OGPService fetches OGP metadata for a URL. Stub until HTTP fetcher is wired.
type OGPService struct{}

// Fetch returns OGP metadata for the URL. Stub: returns nil.
func (o *OGPService) Fetch(ctx context.Context, url string) (*OGPResult, error) {
	_ = ctx
	_ = url
	return nil, nil
}
