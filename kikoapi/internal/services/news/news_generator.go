package news

import (
	"context"
	"regexp"
	"strings"
	"time"
)

// NewsArticleRepo provides persistence for news articles.
type NewsArticleRepo interface {
	RecentTokenSymbols(ctx context.Context, since time.Time, excludeStatus string) ([]string, error)
	Create(ctx context.Context, article *NewsArticleCreate) (id string, err error)
}

// NewsArticleCreate is the input for creating a news article.
type NewsArticleCreate struct {
	Title        string
	Content      string
	Tokens       string // JSON array of token symbols/addresses
	CoverImageURL string
	Status       string
	ParagraphURL  string
}

// GrokNewsClient calls Grok service for news content. Stub returns empty until wired.
type GrokNewsClient interface {
	WriteNews(ctx context.Context, tokens []TrendingToken) (markdownContent string, err error)
}

// GenerateNewsArticle runs one news generation cycle: collect trending, generate content, review, optional cover/publish.
func GenerateNewsArticle(
	ctx context.Context,
	repo NewsArticleRepo,
	trendingProvider TrendingProvider,
	grokClient GrokNewsClient,
	manualTrigger bool,
) error {
	_ = manualTrigger

	exclusionList := make(map[string]bool)
	if repo != nil {
		since := time.Now().Add(-72 * time.Hour)
		if syms, err := repo.RecentTokenSymbols(ctx, since, "rejected"); err == nil {
			for _, s := range syms {
				exclusionList[strings.ToUpper(s)] = true
			}
		}
	}

	data, err := CollectTrendingTokens(ctx, exclusionList, trendingProvider)
	if err != nil || len(data.Tokens) == 0 {
		return err
	}

	markdownContent := ""
	if grokClient != nil {
		markdownContent, _ = grokClient.WriteNews(ctx, data.Tokens)
	}
	if markdownContent == "" {
		markdownContent = "# Market Watch\n\nNo content generated."
	}

	title := extractTitle(markdownContent)
	coverURL := ""
	if cov, _ := GenerateCoverImage(ctx, data); cov != "" {
		coverURL = cov
	}

	review := ReviewContent(markdownContent)
	status := "approved"
	if !review.Approved {
		status = "rejected"
	}

	tokensJSON := "[]" // TODO: marshal data.Tokens
	if repo != nil {
		_, _ = repo.Create(ctx, &NewsArticleCreate{
			Title:         title,
			Content:       markdownContent,
			Tokens:        tokensJSON,
			CoverImageURL: coverURL,
			Status:        status,
			ParagraphURL:  "",
		})
	}

	if status == "approved" && coverURL != "" {
		_, _ = PublishToParagraph(ctx, title, markdownContent, coverURL)
	}

	return nil
}

func extractTitle(markdown string) string {
	// Bold quoted: **"Title"**
	if m := regexp.MustCompile(`\*\*[""]([^""]+)[""]\.?\*\*`).FindStringSubmatch(markdown); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	// H1: # Title
	if m := regexp.MustCompile(`(?m)^#\s+(.+)$`).FindStringSubmatch(markdown); len(m) > 1 {
		return strings.TrimSpace(regexp.MustCompile(`[*"]`).ReplaceAllString(m[1], ""))
	}
	// First non-empty line
	for _, line := range strings.Split(markdown, "\n") {
		s := strings.TrimSpace(line)
		if s != "" {
			return strings.TrimSpace(regexp.MustCompile(`[*#"]`).ReplaceAllString(s, ""))
		}
	}
	return "KIKO Market Watch - " + time.Now().Format("2006-01-02")
}
