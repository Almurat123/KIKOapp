// Package repositories: Judge decisions (from kiko-api repositories/judgeRepository.ts).

package repositories

import (
	"context"
	"encoding/json"

	"gorm.io/gorm"

	"kikoapi/internal/types"
)

// JudgeRepository handles JudgeDecision table.
type JudgeRepository struct {
	db *gorm.DB
}

// NewJudgeRepository creates a JudgeRepository.
func NewJudgeRepository(database *gorm.DB) *JudgeRepository {
	return &JudgeRepository{db: database}
}

// SaveJudgeDecision inserts a JudgeDecision from DecisionEngineOutput.
func (r *JudgeRepository) SaveJudgeDecision(ctx context.Context, output *types.DecisionEngineOutput, analysisTimeMs int) (string, error) {
	eng := &output.DecisionEngine
	input := eng.Input
	layers := eng.Layers
	fin := eng.FinalDecision
	fullJSON, _ := json.Marshal(output)
	var id string
	err := r.db.WithContext(ctx).Raw(
		`INSERT INTO "JudgeDecision" (id, "tokenAddress", "tokenSymbol", "tokenName", "chainId", "userAmountUsd", "targetWallet", "launchpadType", liquidity, "contractAgeHours", "userSizeLayer", "liquidityLayer", "structureLayer", "stageLayer", "tokenIntelLayer", "finalDecision", "overallRiskScore", "slippageEstimate", reasons, "aiRationale", "fullOutputJson", "analysisTimeMs")
		 VALUES (gen_random_uuid()::text, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?, ?::jsonb, ?, ?, ?)
		 RETURNING id`,
		input.TokenAddress, nil, nil, input.ChainID, input.UserAmount, input.TargetWallet, input.LaunchpadType,
		layers.LiquidityLayer.LpDepthUSD, float64(layers.StageLayer.ContractAgeMins)/60,
		mustJSON(layers.UserSizeLayer), mustJSON(layers.LiquidityLayer), mustJSON(layers.StructureLayer), mustJSON(layers.StageLayer), mustJSON(layers.TokenIntelligenceLayer),
		string(fin.Decision), fin.OverallRiskScore, fin.SlippageEstimate, mustJSON(fin.Reasons), fin.AiRationale, string(fullJSON), analysisTimeMs,
	).Scan(&id).Error
	return id, err
}

func mustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// UpdateJudgeOutcome updates actualExecuted, actualProfitPct, actualOutcome, outcomeNotes.
func (r *JudgeRepository) UpdateJudgeOutcome(ctx context.Context, decisionID string, actualExecuted bool, actualProfitPct *float64, actualOutcome, outcomeNotes *string) error {
	return r.db.WithContext(ctx).Exec(
		`UPDATE "JudgeDecision" SET "actualExecuted" = ?, "actualProfitPct" = ?, "actualOutcome" = ?, "outcomeNotes" = ?, "outcomeUpdatedAt" = NOW() WHERE id = ?`,
		actualExecuted, actualProfitPct, actualOutcome, outcomeNotes, decisionID,
	).Error
}

// JudgeDecisionRow for GetJudgeDecisionsForTraining.
type JudgeDecisionRow struct {
	ID string `gorm:"column:id"`
}

// GetJudgeDecisionsForTraining returns decision rows with optional filters.
func (r *JudgeRepository) GetJudgeDecisionsForTraining(ctx context.Context, chainID *int, minLiquidity *float64, finalDecision *string, hasOutcome *bool) ([]JudgeDecisionRow, error) {
	query := `SELECT id FROM "JudgeDecision" WHERE 1=1`
	args := []interface{}{}
	if chainID != nil {
		query += ` AND "chainId" = ?`
		args = append(args, *chainID)
	}
	if minLiquidity != nil {
		query += ` AND liquidity >= ?`
		args = append(args, *minLiquidity)
	}
	if finalDecision != nil {
		query += ` AND "finalDecision" = ?`
		args = append(args, *finalDecision)
	}
	if hasOutcome != nil {
		if *hasOutcome {
			query += ` AND "actualExecuted" IS NOT NULL`
		} else {
			query += ` AND "actualExecuted" IS NULL`
		}
	}
	query += ` ORDER BY "createdAt" DESC`
	var out []JudgeDecisionRow
	err := r.db.WithContext(ctx).Raw(query, args...).Scan(&out).Error
	return out, err
}

// JudgeStats for GetJudgeStats.
type JudgeStats struct {
	Total     int64
	Allow     int64
	AllowRisk int64
	Block     int64
	Executed  int64
	Success   int64
	SuccessRate float64
}

// GetJudgeStats returns counts for evaluation.
func (r *JudgeRepository) GetJudgeStats(ctx context.Context) (*JudgeStats, error) {
	var total, allow, allowRisk, block, executed, success int64
	_ = r.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM "JudgeDecision"`).Scan(&total).Error
	_ = r.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM "JudgeDecision" WHERE "finalDecision" = 'ALLOW'`).Scan(&allow).Error
	_ = r.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM "JudgeDecision" WHERE "finalDecision" = 'ALLOW_WITH_RISK'`).Scan(&allowRisk).Error
	_ = r.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM "JudgeDecision" WHERE "finalDecision" = 'BLOCK'`).Scan(&block).Error
	_ = r.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM "JudgeDecision" WHERE "actualExecuted" = true`).Scan(&executed).Error
	_ = r.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM "JudgeDecision" WHERE "actualOutcome" = 'success'`).Scan(&success).Error
	rate := 0.0
	if executed > 0 {
		rate = float64(success) / float64(executed) * 100
	}
	return &JudgeStats{Total: total, Allow: allow, AllowRisk: allowRisk, Block: block, Executed: executed, Success: success, SuccessRate: rate}, nil
}

// SaveDecision is a convenience that accepts generic data (for stub compatibility).
func (r *JudgeRepository) SaveDecision(ctx context.Context, data interface{}) error {
	_ = data
	return nil
}
