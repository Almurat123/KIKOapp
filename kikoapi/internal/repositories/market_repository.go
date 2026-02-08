// Package repositories: Market overview and chain metrics (from kiko-api repositories/marketRepository.ts).

package repositories

import (
	"context"

	"gorm.io/gorm"
)

// MarketOverview holds latest market overview data.
type MarketOverview struct {
	GlobalMarketCap       float64
	Volume24h             float64
	ActiveUsers           *int64
	EthGasPrice           *string
	FearGreedIndex        int
	FearGreedClassification string
	BitcoinDominance      float64
	AltcoinSeasonIndex    *float64
	GlobalOpenInterest    *float64
	GasLevel              *float64
	GasLevelStatus        *string
	Bvix                  *float64
	Evix                  *float64
	LiquidityStressIndex  *float64
	LiquidityStressStatus *string
	UpdatedAt             *string
}

// MarketRepository handles MarketOverview and ChainMetric.
type MarketRepository struct {
	db *gorm.DB
}

// NewMarketRepository creates a MarketRepository.
func NewMarketRepository(database *gorm.DB) *MarketRepository {
	return &MarketRepository{db: database}
}

// SaveMarketOverview inserts a row into MarketOverview table.
func (r *MarketRepository) SaveMarketOverview(ctx context.Context, data *MarketOverview) error {
	return r.db.WithContext(ctx).Exec(
		`INSERT INTO "MarketOverview" ("globalMarketCap", "volume24h", "activeUsers", "ethGasPrice", "fearGreedIndex", "fearGreedClassification", "bitcoinDominance", "altcoinSeasonIndex", "globalOpenInterest", "gasLevel", "gasLevelStatus", "bvix", "evix", "liquidityStressIndex", "liquidityStressStatus", "updatedAt", "createdAt")
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
		data.GlobalMarketCap, data.Volume24h, data.ActiveUsers, data.EthGasPrice, data.FearGreedIndex, data.FearGreedClassification,
		data.BitcoinDominance, data.AltcoinSeasonIndex, data.GlobalOpenInterest, data.GasLevel, data.GasLevelStatus,
		data.Bvix, data.Evix, data.LiquidityStressIndex, data.LiquidityStressStatus,
	).Error
}

// GetMarketOverview returns the latest row from MarketOverview.
func (r *MarketRepository) GetMarketOverview(ctx context.Context) (*MarketOverview, error) {
	var row struct {
		GlobalMarketCap          float64
		Volume24h                float64
		ActiveUsers              *int64
		EthGasPrice              *string
		FearGreedIndex           *int
		FearGreedClassification  *string
		BitcoinDominance         float64
		AltcoinSeasonIndex       *float64
		GlobalOpenInterest       *float64
		GasLevel                 *float64
		GasLevelStatus           *string
		Bvix                     *float64
		Evix                     *float64
		LiquidityStressIndex     *float64
		LiquidityStressStatus    *string
	}
	err := r.db.WithContext(ctx).Raw(
		`SELECT "globalMarketCap", "volume24h", "activeUsers", "ethGasPrice", "fearGreedIndex", "fearGreedClassification", "bitcoinDominance", "altcoinSeasonIndex", "globalOpenInterest", "gasLevel", "gasLevelStatus", "bvix", "evix", "liquidityStressIndex", "liquidityStressStatus" FROM "MarketOverview" ORDER BY "updatedAt" DESC LIMIT 1`,
	).Scan(&row).Error
	if err != nil {
		return nil, err
	}
	out := &MarketOverview{
		GlobalMarketCap: row.GlobalMarketCap,
		Volume24h:       row.Volume24h,
		ActiveUsers:     row.ActiveUsers,
		EthGasPrice:     row.EthGasPrice,
		BitcoinDominance: row.BitcoinDominance,
		AltcoinSeasonIndex: row.AltcoinSeasonIndex,
		GlobalOpenInterest: row.GlobalOpenInterest,
		GasLevel:         row.GasLevel,
		GasLevelStatus:   row.GasLevelStatus,
		Bvix:             row.Bvix,
		Evix:             row.Evix,
		LiquidityStressIndex: row.LiquidityStressIndex,
		LiquidityStressStatus: row.LiquidityStressStatus,
	}
	if row.FearGreedIndex != nil {
		out.FearGreedIndex = *row.FearGreedIndex
	}
	if row.FearGreedClassification != nil {
		out.FearGreedClassification = *row.FearGreedClassification
	}
	return out, nil
}

// ChainMetricRow for GetChainsData (chain_name, tvl, volume_24h, etc.).
type ChainMetricRow struct {
	ChainName   string   `gorm:"column:chain_name"`
	Tvl         *float64
	Volume24h   *float64
	Txns24h     *int64   `gorm:"column:txns_24h"`
	ActiveWallets *int64 `gorm:"column:active_wallets"`
	GasPrice    *string  `gorm:"column:gas_price"`
	LogoURL     *string  `gorm:"column:logo_url"`
}

// GetChainsData returns chain metrics with tvl or volume/txns/wallets/gas (from ChainMetric table).
func (r *MarketRepository) GetChainsData(ctx context.Context) ([]ChainMetricRow, error) {
	var out []ChainMetricRow
	err := r.db.WithContext(ctx).Raw(
		`SELECT "chain_name", tvl, "volume_24h", "txns_24h", "active_wallets", "gas_price", "logo_url" FROM "ChainMetric" WHERE tvl > 0 OR "volume_24h" IS NOT NULL OR "txns_24h" IS NOT NULL OR "active_wallets" IS NOT NULL OR "gas_price" IS NOT NULL ORDER BY tvl DESC NULLS LAST`,
	).Scan(&out).Error
	return out, err
}
