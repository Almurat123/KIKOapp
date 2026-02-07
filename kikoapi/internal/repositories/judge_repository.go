// Package repositories: Judge decisions (stub).

package repositories

import "context"

// JudgeRepository handles JudgeDecision table.
type JudgeRepository struct{}

// NewJudgeRepository creates a JudgeRepository.
func NewJudgeRepository() *JudgeRepository {
	return &JudgeRepository{}
}

// SaveDecision is a stub.
func (r *JudgeRepository) SaveDecision(ctx context.Context, data interface{}) error {
	return nil
}
