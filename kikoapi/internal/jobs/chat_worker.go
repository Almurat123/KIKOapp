package jobs

import "context"

// ChatWorker processes chat/AI queue messages.
type ChatWorker struct{}

// Run runs the chat worker loop. Stub: no-op until queue is wired.
func (w *ChatWorker) Run(ctx context.Context) error {
	_ = ctx
	return nil
}
