/**
 * Judge System Types
 * Launchpad Decision Engine v3.5
 * 
 * Based on Juage.md specification
 */

// ========================
// INPUT TYPES
// ========================

export interface DecisionEngineInput {
    user_amount: number;        // USD
    token_address: string;
    launchpad_type: string;     // e.g., 'pump.fun', 'zora', 'four.meme'
    chain: string;
    chain_id: number;
    timestamp: string;
    target_wallet?: string;     // For copy trade context
}

// ========================
// USER SIZE LAYER
// ========================

export type UserSizeLevel = 'L1' | 'L2' | 'L3' | 'L4';

export interface UserSizeLayer {
    user_size_level: UserSizeLevel;
    max_slippage_allowed: number;   // e.g., 0.05 = 5%
    max_risk_allowed: number;       // 0-1
    score: number;                  // 0-1 (higher = safer for user)
    reasons: string[];
}

// User Size Thresholds (USD)
export const USER_SIZE_THRESHOLDS = {
    L1: { max: 100, label: 'Small Probe' },
    L2: { min: 100, max: 400, label: 'Medium' },
    L3: { min: 400, max: 1500, label: 'Large' },
    L4: { min: 1500, label: 'Heavy Position' },
} as const;

// ========================
// LIQUIDITY LAYER
// ========================

export type LayerDecision = 'ALLOW' | 'ALLOW_WITH_RISK' | 'BLOCK';

export interface LiquidityLayer {
    lp_depth_usd: number;
    user_amount_usd: number;
    slippage_estimate: number;       // 0-1 (0.05 = 5%)
    liquidity_risk_score: number;    // 0-1 (higher = safer)
    liquidity_decision: LayerDecision;
    reasons: string[];
}

// ========================
// STRUCTURE LAYER
// ========================

export interface StructureFeatures {
    has_bonding_curve: boolean;
    has_fixed_pool: boolean;
    has_migration: boolean;
    creator_fee: number;            // 0-1 (0.05 = 5%)
    curve_type: string;             // 'linear', 'exponential', 'fixed', 'unknown'
    lp_lock_info: string;           // 'locked', 'unlocked', 'unknown'
    metadata_quality: number;       // 0-1
}

export interface StructureLayer {
    launchpad_type: string;
    structure_features: StructureFeatures;
    structure_risk_score: number;   // 0-1 (higher = safer)
    structure_decision: LayerDecision;
    reasons: string[];
}

// ========================
// STAGE LAYER
// ========================

export type TokenStage = 'S0' | 'S1' | 'S2' | 'S3' | 'S4';

export interface StageLayer {
    stage: TokenStage;
    contract_age_minutes: number;
    stage_risk_score: number;       // 0-1 (higher = safer)
    stage_decision: LayerDecision;
    reasons: string[];
}

// Stage Thresholds (minutes)
export const STAGE_THRESHOLDS = {
    S0: { max: 10, label: 'Just Created', risk: 0.2 },
    S1: { min: 10, max: 120, label: 'Early', risk: 0.4 },
    S2: { min: 120, max: 1440, label: 'Mid-term', risk: 0.6 },
    S3: { min: 1440, label: 'Stable', risk: 0.8 },
    S4: { label: 'Post-Migration / Special', risk: 0.5 },
} as const;

// ========================
// TOKEN INTELLIGENCE LAYER
// ========================

export interface ProjectIdentity {
    has_official_twitter: boolean;
    has_team_identity: boolean;
    has_logo: boolean;
    has_description: boolean;
    contract_verified: boolean;
    contract_age_hours: number;
    launchpad_metadata_quality: number;  // 0-1
    score: number;                       // 0-1
}

export interface SocialPresence {
    twitter_active: boolean;
    twitter_followers: number;
    has_kol_mentions: boolean;
    community_discussion_level: number;  // 0-1
    telegram_active: boolean;
    discord_active: boolean;
    score: number;                       // 0-1
}

export interface NarrativeStrength {
    narrative_type: string;              // 'meme', 'AI', 'infra', 'culture', 'celebrity', 'unknown'
    narrative_strength: number;          // 0-1
    narrative_alignment: number;         // 0-1 (market trend alignment)
    narrative_consistency: number;       // 0-1 (cross-channel consistency)
    score: number;                       // 0-1
}

export interface WebsiteQuality {
    has_website: boolean;
    website_reachable: boolean;
    website_design_quality: number;      // 0-1
    website_content_depth: number;       // 0-1
    has_docs: boolean;
    has_product: boolean;
    score: number;                       // 0-1
}

export interface RiskSignals {
    scam_reports_found: boolean;
    rug_reports_found: boolean;
    honeypot_reports_found: boolean;
    negative_sentiment_score: number;    // 0-1 (higher = more negative)
    deployer_reputation: number;         // 0-1 (higher = better)
    score: number;                       // 0-1 (safety score, higher = safer)
}

export type TokenIntelligenceLabel = 'strong' | 'medium' | 'weak' | 'danger';

export interface TokenIntelligenceLayer {
    project_identity: ProjectIdentity;
    social_presence: SocialPresence;
    narrative_strength: NarrativeStrength;
    website_quality: WebsiteQuality;
    risk_signals: RiskSignals;

    token_intelligence_score: number;    // 0-1 (aggregate)
    token_intelligence_label: TokenIntelligenceLabel;
    risk_tags: string[];                 // e.g., ['no-docs', 'strong-social', 'meme']
    reasons: string[];
}

// ========================
// FINAL DECISION
// ========================

export type FinalDecision = 'ALLOW' | 'ALLOW_WITH_RISK' | 'BLOCK';

export interface FinalDecisionOutput {
    decision: FinalDecision;
    overall_risk_score: number;          // 0-1 (higher = safer)
    slippage_estimate: number;           // 0-1
    reasons: string[];
    ai_rationale?: string;
}

// ========================
// COMPLETE OUTPUT
// ========================

export interface DecisionEngineLayers {
    user_size_layer: UserSizeLayer;
    liquidity_layer: LiquidityLayer;
    structure_layer: StructureLayer;
    stage_layer: StageLayer;
    token_intelligence_layer: TokenIntelligenceLayer;
}

export interface DecisionEngineOutput {
    decision_engine: {
        input: DecisionEngineInput;
        layers: DecisionEngineLayers;
        final_decision: FinalDecisionOutput;
        decision_id?: string;
    };
}

// ========================
// HELPER TYPES
// ========================

export interface TokenData {
    address: string;
    symbol: string;
    name: string;
    price: number;
    liquidity: number;
    fdv: number;
    marketCap: number;
    priceChange5m: number;
    priceChange1h: number;
    priceChange24h: number;
    pairCreatedAt?: number;
    poolAddress?: string;
    socials?: Array<{ type: string; url: string }>;
    websites?: Array<{ url: string }>;
}

export interface SecurityData {
    status: 'Unknown' | 'Safe' | 'Warning' | 'High Risk' | 'Critical' | 'Medium';
    riskScore: number;
    isHoneypot: boolean;
    isMintable: boolean;
    isProxy: boolean;
    buyTax: number;
    sellTax: number;
    warnings: string[];
    positives: string[];
    recommendation: string;
    details: {
        isOpenSource: boolean;
        hasRenouncedOwner: boolean;
        isMintable: boolean;
        canDisableTrade: boolean;
        isBlacklisted: boolean;
    };
    source: string;
    lpLocked: boolean;
}
