package ai

import "context"

// ToolPromptGenerator generates tool-use prompts for the AI. Stub.
func ToolPromptGenerator(ctx context.Context, intent *IntentDecision, skills []string, userContext *UserContext) (string, error) {
	_ = intent
	_ = skills
	_ = userContext
	return "", nil
}
