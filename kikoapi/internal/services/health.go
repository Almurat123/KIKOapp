// Package services: Health check (no external deps).

package services

// HealthService returns service health status.
type HealthService struct{}

// NewHealthService creates a HealthService.
func NewHealthService() *HealthService {
	return &HealthService{}
}

// OK returns true (caller can combine with DB/Redis checks).
func (s *HealthService) OK() bool {
	return true
}
