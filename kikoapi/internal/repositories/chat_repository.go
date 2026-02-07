// Package repositories: Chat session/message access (stub; full impl from kiko-api repositories/chatRepository.ts).

package repositories

import "context"

// ChatRepository handles ChatSession, ChatMessage, AITask.
type ChatRepository struct{}

// NewChatRepository creates a ChatRepository.
func NewChatRepository() *ChatRepository {
	return &ChatRepository{}
}

// GetOrCreateSession is a stub.
func (r *ChatRepository) GetOrCreateSession(ctx context.Context, userID, title, model string) (sessionID string, err error) {
	return "", nil
}
