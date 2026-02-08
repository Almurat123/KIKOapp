package ai

import "context"

// PromptOrchestrator builds the system prompt and options for the AI based on intent and context.
type PromptOrchestrator struct {
	opts *OrchestratorOptions
}

// NewPromptOrchestrator creates an orchestrator with the given options.
func NewPromptOrchestrator(opts *OrchestratorOptions) *PromptOrchestrator {
	if opts == nil {
		opts = &OrchestratorOptions{Mode: "default", Agent: "kiko-terminal", RoutingMode: "thinking"}
	}
	return &PromptOrchestrator{opts: opts}
}

// GetSystemPrompt returns the system prompt for the given intent and context. Stub: returns minimal prompt until prompts are ported.
func (p *PromptOrchestrator) GetSystemPrompt(ctx context.Context, intent *IntentDecision, userContext *UserContext) (string, error) {
	_ = ctx
	_ = intent
	_ = userContext
	return "You are KIKO, a helpful crypto assistant. Do not provide financial advice.", nil
}

// GetOrchestratorOptions returns the current options.
func (p *PromptOrchestrator) GetOrchestratorOptions() OrchestratorOptions {
	if p.opts != nil {
		return *p.opts
	}
	return OrchestratorOptions{}
}
