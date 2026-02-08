package billing

import (
	"fmt"
	"strings"
	"time"

	"kikoapi/internal/config"
)

// BillingCategory is the category for pricing (deepseek, grok, other).
type BillingCategory string

const (
	BillingCategoryDeepseek BillingCategory = "deepseek"
	BillingCategoryGrok    BillingCategory = "grok"
	BillingCategoryOther   BillingCategory = "other"
)

// GetUtcDateString returns YYYY-MM-DD for the given time (UTC). Pass time.Time; if nil, uses time.Now().UTC().
func GetUtcDateString(now *time.Time) string {
	var t time.Time
	if now != nil {
		t = now.UTC()
	} else {
		t = time.Now().UTC()
	}
	return fmt.Sprintf("%04d-%02d-%02d", t.Year(), t.Month(), t.Day())
}

// NormalizeModelForPricing returns lowercase model name for pricing lookup.
func NormalizeModelForPricing(model string) string {
	return strings.ToLower(strings.TrimSpace(model))
}

// GetBillingCategory returns the billing category for the given model.
func GetBillingCategory(cfg *config.BillingConfig, model string) BillingCategory {
	norm := NormalizeModelForPricing(model)
	for _, m := range cfg.DeepseekModels {
		if m == norm {
			return BillingCategoryDeepseek
		}
	}
	for _, m := range cfg.GrokModels {
		if m == norm {
			return BillingCategoryGrok
		}
	}
	if strings.Contains(norm, "deepseek") {
		return BillingCategoryDeepseek
	}
	if strings.Contains(norm, "grok") {
		return BillingCategoryGrok
	}
	return BillingCategoryOther
}

// GetDailyFreeQuota returns the daily free quota for the category.
func GetDailyFreeQuota(cfg *config.BillingConfig, category BillingCategory) int {
	switch category {
	case BillingCategoryDeepseek:
		return cfg.DailyFreeDeepseek
	case BillingCategoryGrok:
		return cfg.DailyFreeGrok
	default:
		return 0
	}
}

// UsageInput holds token counts for cost computation.
type UsageInput struct {
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// ComputeUsdCost computes USD cost for the given usage and model (and optional tool calls).
func ComputeUsdCost(cfg *config.BillingConfig, usage *UsageInput, model string, toolCallsCount int) float64 {
	if cfg == nil || usage == nil {
		return 0
	}
	norm := NormalizeModelForPricing(model)
	entry, ok := cfg.ModelPricing[norm]
	if !ok {
		return 0
	}
	promptTokens := usage.PromptTokens
	if promptTokens == 0 && usage.TotalTokens > 0 {
		// Some APIs only return total_tokens
		completionTokens := usage.CompletionTokens
		if completionTokens > 0 {
			promptTokens = usage.TotalTokens - completionTokens
		} else {
			promptTokens = usage.TotalTokens / 2
		}
	}
	completionTokens := usage.CompletionTokens
	if completionTokens == 0 && usage.TotalTokens > 0 && promptTokens > 0 {
		completionTokens = usage.TotalTokens - promptTokens
	}
	promptCost := (float64(promptTokens) / 1_000_000) * entry.PromptUsdPer1M
	completionCost := (float64(completionTokens) / 1_000_000) * entry.CompletionUsdPer1M
	total := promptCost + completionCost
	if toolCallsCount > 0 && strings.Contains(norm, "grok") {
		total += float64(toolCallsCount) * cfg.ToolPricePerCall
	}
	if total < 0 {
		return 0
	}
	return total
}
