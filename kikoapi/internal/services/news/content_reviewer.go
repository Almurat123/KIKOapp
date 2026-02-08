package news

import (
	"regexp"
)

// Prohibited and compliance patterns (from newsrules.md).
var (
	prohibitedPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)scam`),
		regexp.MustCompile(`(?i)ponzi`),
		regexp.MustCompile(`(?i)money laundering`),
		regexp.MustCompile(`(?i)drug`),
		regexp.MustCompile(`(?i)guaranteed return`),
		regexp.MustCompile(`(?i)risk-free`),
		regexp.MustCompile(`(?i)no risk`),
		regexp.MustCompile(`(?i)certain to pump`),
		regexp.MustCompile(`(?i)must buy`),
		regexp.MustCompile(`(?i)financial advice`),
		regexp.MustCompile(`(?i)100x guaranteed`),
		regexp.MustCompile(`(?i)insider leak`),
		regexp.MustCompile(`(?i)confirmed by (?:source|insider)`),
	}
	compliancePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)risk`),
		regexp.MustCompile(`(?i)financial advice`),
		regexp.MustCompile(`(?i)investment advice`),
	}
	notFinancialAdviceRe = regexp.MustCompile(`(?i)(not|no|not intended as)\s+financial advice`)
	scamWarningRe        = regexp.MustCompile(`(?i)(avoid|beware of|alert|warning|report)\s+scams?`)
)

// ReviewResult is the result of content review.
type ReviewResult struct {
	Approved        bool
	Reason          string
	FlaggedKeywords []string
}

// ReviewContent checks content against compliance rules; returns approved=false if prohibited or missing disclosure.
func ReviewContent(content string) ReviewResult {
	var flagged []string
	for _, p := range prohibitedPatterns {
		if !p.MatchString(content) {
			continue
		}
		// Context: "not financial advice" is a disclaimer
		if p.String() == "(?i)financial advice" && notFinancialAdviceRe.MatchString(content) {
			continue
		}
		if p.String() == "(?i)scam" && scamWarningRe.MatchString(content) {
			continue
		}
		flagged = append(flagged, p.String())
	}
	if len(flagged) > 0 {
		return ReviewResult{
			Approved:        false,
			Reason:          "Found prohibited keywords",
			FlaggedKeywords: flagged,
		}
	}
	for _, p := range compliancePatterns {
		if p.MatchString(content) {
			return ReviewResult{Approved: true}
		}
	}
	return ReviewResult{
		Approved: false,
		Reason:   "Missing mandatory risk disclosure (not financial advice)",
	}
}
