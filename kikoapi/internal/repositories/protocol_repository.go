// Package repositories: Protocol metrics (from kiko-api repositories/protocolRepository.ts).

package repositories

import (
	"context"

	"gorm.io/gorm"
)

// ProtocolData for save/list (from defillama).
type ProtocolData struct {
	Name        string
	Symbol      *string
	Category    *string
	Tvl         *float64
	TvlChange1d *float64
	TvlChange7d *float64
	Volume24h   *float64
	Chains      []string
	McapTvlRatio *float64
	LogoURL     *string
}

// ProtocolRepository handles ProtocolMetric table.
type ProtocolRepository struct {
	db *gorm.DB
}

// NewProtocolRepository creates a ProtocolRepository.
func NewProtocolRepository(database *gorm.DB) *ProtocolRepository {
	return &ProtocolRepository{db: database}
}

// SaveProtocolsData upserts protocols in chunks.
func (r *ProtocolRepository) SaveProtocolsData(ctx context.Context, protocols []ProtocolData) error {
	const chunkSize = 20
	for i := 0; i < len(protocols); i += chunkSize {
		end := i + chunkSize
		if end > len(protocols) {
			end = len(protocols)
		}
		chunk := protocols[i:end]
		for _, p := range chunk {
			err := r.db.WithContext(ctx).Exec(
				`INSERT INTO "ProtocolMetric" ("protocol_name", "protocol_symbol", category, tvl, "tvl_change_1d", "tvl_change_7d", "volume_24h", chains, "mcap_tvl_ratio", "logo_url", "updatedAt", "createdAt")
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?::text[], ?, ?, NOW(), NOW())
				 ON CONFLICT ("protocol_name") DO UPDATE SET "protocol_symbol" = EXCLUDED."protocol_symbol", category = EXCLUDED.category, tvl = EXCLUDED.tvl, "tvl_change_1d" = EXCLUDED."tvl_change_1d", "tvl_change_7d" = EXCLUDED."tvl_change_7d", "volume_24h" = EXCLUDED."volume_24h", chains = EXCLUDED.chains, "mcap_tvl_ratio" = EXCLUDED."mcap_tvl_ratio", "logo_url" = EXCLUDED."logo_url", "updatedAt" = NOW()`,
				p.Name, p.Symbol, p.Category, p.Tvl, p.TvlChange1d, p.TvlChange7d, p.Volume24h, p.Chains, p.McapTvlRatio, p.LogoURL,
			).Error
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// ListProtocols returns all protocol names (minimal for stub).
func (r *ProtocolRepository) ListProtocols(ctx context.Context) ([]interface{}, error) {
	var names []string
	err := r.db.WithContext(ctx).Raw(`SELECT "protocol_name" FROM "ProtocolMetric" ORDER BY "updatedAt" DESC`).Scan(&names).Error
	if err != nil {
		return nil, err
	}
	out := make([]interface{}, len(names))
	for i, n := range names {
		out[i] = n
	}
	return out, nil
}
