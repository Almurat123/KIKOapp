package news

import "context"

// GenerateCoverImage generates a cover image for the given trending data.
// Stub: returns empty string until Puppeteer/HTML-to-image is wired.
func GenerateCoverImage(ctx context.Context, data *NewsTrendingData) (string, error) {
	if data == nil {
		return "", nil
	}
	_ = ctx
	return "", nil
}
