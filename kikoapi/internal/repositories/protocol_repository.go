// Package repositories: Protocol metrics (stub).

package repositories

import "context"

// ProtocolRepository handles ProtocolMetric table.
type ProtocolRepository struct{}

// NewProtocolRepository creates a ProtocolRepository.
func NewProtocolRepository() *ProtocolRepository {
	return &ProtocolRepository{}
}

// ListProtocols is a stub.
func (r *ProtocolRepository) ListProtocols(ctx context.Context) ([]interface{}, error) {
	return nil, nil
}
