package ai

import "context"

// ToolPreRouter routes the request to appropriate tools/skills before full orchestration. Stub.
func ToolPreRouter(ctx context.Context, intent *IntentDecision, userContext *UserContext) ([]string, error) {
	if intent == nil {
		return nil, nil
	}
	_ = userContext
	return nil, nil
}
