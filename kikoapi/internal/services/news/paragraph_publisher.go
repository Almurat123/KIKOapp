package news

import "context"

// PublishResult is the result of publishing to Paragraph.
type PublishResult struct {
	ID  string
	URL string
}

// PublishToParagraph publishes the article to Paragraph.xyz.
// Stub: returns nil until Paragraph SDK/client is wired.
func PublishToParagraph(ctx context.Context, title, markdownContent, coverImageURL string) (*PublishResult, error) {
	_ = ctx
	_ = title
	_ = markdownContent
	_ = coverImageURL
	return nil, nil
}
