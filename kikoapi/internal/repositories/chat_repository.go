// Package repositories: Chat session/message/AITask (from kiko-api repositories/chatRepository.ts).

package repositories

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"kikoapi/internal/db"
)

// ChatRepository handles ChatSession, ChatMessage, AITask.
type ChatRepository struct {
	db *gorm.DB
}

// NewChatRepository creates a ChatRepository.
func NewChatRepository(database *gorm.DB) *ChatRepository {
	return &ChatRepository{db: database}
}

// CreateSession creates a new chat session.
func (r *ChatRepository) CreateSession(ctx context.Context, userID, title, model string) (*db.ChatSession, error) {
	if title == "" {
		title = "New Chat"
	}
	if model == "" {
		model = "deepseek-chat"
	}
	s := &db.ChatSession{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     title,
		Model:     model,
		Status:    "active",
	}
	err := r.db.WithContext(ctx).Create(s).Error
	return s, err
}

// GetSession returns a session by ID.
func (r *ChatRepository) GetSession(ctx context.Context, sessionID string) (*db.ChatSession, error) {
	var s db.ChatSession
	err := r.db.WithContext(ctx).Where("id = ?", sessionID).First(&s).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// GetUserSessions returns active sessions for user, ordered by updatedAt desc.
func (r *ChatRepository) GetUserSessions(ctx context.Context, userID string, limit, offset int) ([]db.ChatSession, error) {
	if limit <= 0 {
		limit = 50
	}
	var out []db.ChatSession
	err := r.db.WithContext(ctx).Where("\"userId\" = ? AND status = ?", userID, "active").
		Order("\"updatedAt\" DESC").Limit(limit).Offset(offset).Find(&out).Error
	return out, err
}

// UpdateSession updates title/model/status.
func (r *ChatRepository) UpdateSession(ctx context.Context, sessionID string, updates map[string]interface{}) error {
	return r.db.WithContext(ctx).Model(&db.ChatSession{}).Where("id = ?", sessionID).Updates(updates).Error
}

// DeleteSession deletes a session.
func (r *ChatRepository) DeleteSession(ctx context.Context, sessionID string) error {
	return r.db.WithContext(ctx).Where("id = ?", sessionID).Delete(&db.ChatSession{}).Error
}

// CreateMessage creates a message and returns it. messageIndex is set automatically if 0.
func (r *ChatRepository) CreateMessage(ctx context.Context, sessionID, role, content string, messageIndex int) (*db.ChatMessage, error) {
	if messageIndex == 0 {
		var max int
		_ = r.db.WithContext(ctx).Model(&db.ChatMessage{}).Where("\"sessionId\" = ?", sessionID).Select("COALESCE(MAX(\"messageIndex\"), -1)").Scan(&max).Error
		messageIndex = max + 1
	}
	m := &db.ChatMessage{
		ID:           uuid.New().String(),
		SessionID:    sessionID,
		Role:         role,
		Content:      content,
		MessageIndex: messageIndex,
		Status:       "complete",
	}
	err := r.db.WithContext(ctx).Create(m).Error
	return m, err
}

// GetMessages returns messages for session ordered by messageIndex.
func (r *ChatRepository) GetMessages(ctx context.Context, sessionID string, limit int) ([]db.ChatMessage, error) {
	if limit <= 0 {
		limit = 100
	}
	var out []db.ChatMessage
	err := r.db.WithContext(ctx).Where("\"sessionId\" = ?", sessionID).Order("\"messageIndex\" ASC").Limit(limit).Find(&out).Error
	return out, err
}

// CreateAITask creates an AITask with status queued.
func (r *ChatRepository) CreateAITask(ctx context.Context, sessionID, model string, userMessageID, assistantMessageID *string) (*db.AITask, error) {
	t := &db.AITask{
		ID:                  uuid.New().String(),
		SessionID:           sessionID,
		Model:               model,
		Status:              "queued",
		UserMessageID:       userMessageID,
		AssistantMessageID:  assistantMessageID,
	}
	err := r.db.WithContext(ctx).Create(t).Error
	return t, err
}

// GetAITask returns task by ID.
func (r *ChatRepository) GetAITask(ctx context.Context, taskID string) (*db.AITask, error) {
	var t db.AITask
	err := r.db.WithContext(ctx).Where("id = ?", taskID).First(&t).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// GetOrCreateSession returns existing session by ID or creates one (convenience).
func (r *ChatRepository) GetOrCreateSession(ctx context.Context, userID, title, model string) (sessionID string, err error) {
	s, err := r.CreateSession(ctx, userID, title, model)
	if err != nil {
		return "", err
	}
	return s.ID, nil
}
