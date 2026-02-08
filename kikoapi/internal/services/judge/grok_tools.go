package judge

import (
	"context"
	"regexp"
	"strings"
)

// XSearchResult holds Twitter/X presence analysis result (from Grok x_search).
type XSearchResult struct {
	TwitterActive           bool
	TwitterFollowers        int
	HasKOLMentions          bool
	CommunityDiscussionLevel float64
	RecentPosts              []string
	Sentiment                string // "positive" | "neutral" | "negative"
	ScamReports              bool
	RugReports               bool
}

// WebAnalysisResult holds website analysis result (from Grok web_search).
type WebAnalysisResult struct {
	WebsiteReachable bool
	DesignQuality    float64
	ContentDepth     float64
	HasDocs          bool
	HasProduct       bool
	HasTeamInfo      bool
	Summary          string
}

var sanitizeRe = regexp.MustCompile(`[<>{}[\]|\\^~]`)

// SanitizeInput limits length and removes characters that could be used for prompt injection.
func SanitizeInput(input string, maxLen int) string {
	if maxLen <= 0 {
		maxLen = 100
	}
	s := sanitizeRe.ReplaceAllString(strings.TrimSpace(input), "")
	if len(s) > maxLen {
		return s[:maxLen]
	}
	return s
}

// AnalyzeTwitterPresence uses Grok x_search to analyze Twitter presence. Stub: returns default until Grok client is wired.
func AnalyzeTwitterPresence(ctx context.Context, tokenSymbol, tokenAddress, twitterURL string) (*XSearchResult, error) {
	_ = ctx
	_ = SanitizeInput(tokenSymbol, 20)
	_ = SanitizeInput(tokenAddress, 64)
	_ = twitterURL
	return &XSearchResult{Sentiment: "neutral"}, nil
}

// AnalyzeWebsite uses Grok to analyze website. Stub: returns default.
func AnalyzeWebsite(ctx context.Context, websiteURL string) (*WebAnalysisResult, error) {
	_ = ctx
	_ = websiteURL
	return &WebAnalysisResult{}, nil
}

// AnalyzeTokenWithGrok runs full token analysis with Grok. Stub: returns empty/default.
func AnalyzeTokenWithGrok(ctx context.Context, tokenSymbol, tokenAddress string, twitterURL, websiteURL string) (twitter *XSearchResult, web *WebAnalysisResult, err error) {
	twitter, _ = AnalyzeTwitterPresence(ctx, tokenSymbol, tokenAddress, twitterURL)
	web, _ = AnalyzeWebsite(ctx, websiteURL)
	return twitter, web, nil
}

// GenerateJudgeRationale asks Grok to generate a short rationale for the decision. Stub: returns empty.
func GenerateJudgeRationale(ctx context.Context, tokenSymbol string, layersSummary string, finalDecision string) (string, error) {
	_ = ctx
	_ = tokenSymbol
	_ = layersSummary
	_ = finalDecision
	return "", nil
}
