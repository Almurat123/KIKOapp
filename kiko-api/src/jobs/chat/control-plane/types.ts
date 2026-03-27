export type SemanticDomain =
    | 'general'
    | 'token'
    | 'wallet'
    | 'polymarket'
    | 'social'
    | 'market';

export type SemanticIntent =
    | 'assistant_meta'
    | 'token_attention_analysis'
    | 'token_analysis'
    | 'token_risk_review'
    | 'early_buyer_export'
    | 'creator_analysis'
    | 'wallet_analysis'
    | 'wallet_pnl'
    | 'social_discovery'
    | 'market_discovery'
    | 'swap_execution'
    | 'copy_trade_execution'
    | 'polymarket_discovery'
    | 'polymarket_order';

export type ControlLane = 'analysis' | 'execution';

export type SearchRequirement = 'forbidden' | 'optional' | 'required';

export type SearchTarget = 'none' | 'web' | 'x' | 'x_and_web';

export type TaskType =
    | 'general_answer'
    | 'token_attention_analysis'
    | 'token_analysis'
    | 'token_risk_review'
    | 'early_buyer_export'
    | 'creator_analysis'
    | 'wallet_analysis'
    | 'wallet_pnl'
    | 'social_discovery'
    | 'market_discovery'
    | 'swap_execution'
    | 'copy_trade_execution'
    | 'polymarket_discovery'
    | 'polymarket_order';

export type EvidenceKind =
    | 'identity'
    | 'market'
    | 'onchain_token'
    | 'onchain_wallet'
    | 'external_attention'
    | 'official_announcements'
    | 'wallet_state'
    | 'execution_quote'
    | 'execution_preflight'
    | 'execution_receipt';

export type EvidenceFreshness = 'static' | 'session' | 'historical' | 'realtime';

export type EvidenceSourceType =
    | 'tool'
    | 'provider_native_search'
    | 'session_context'
    | 'user_input';

export type TargetScopeMode =
    | 'current_turn_only'
    | 'followup_scoped'
    | 'session_scoped';

export interface SemanticEntities {
    tokenAddresses: string[];
    tokenSymbols: string[];
    walletAddresses: string[];
    chainIds: number[];
    chainNames: string[];
}

export interface SemanticCues {
    explicitTradeVerb: boolean;
    explicitExternalEvidenceRequest: boolean;
    explicitSocialEvidenceRequest: boolean;
    currentTurnExplicitAddress: boolean;
    followupReference: boolean;
}

/**
 * Model-owned output. This is semantic understanding only, not workflow control.
 */
export interface SemanticParse {
    parserVersion: string;
    domain: SemanticDomain;
    intent: SemanticIntent;
    confidence: number;
    locale: 'en' | 'zh';
    explanation: string;
    entities: SemanticEntities;
    cues: SemanticCues;
    timeWindow?: {
        description?: string;
        startTime?: string;
        endTime?: string;
    } | null;
}

export interface EvidenceRequirement {
    kind: EvidenceKind;
    freshness: EvidenceFreshness;
    required: boolean;
    reason: string;
}

export interface EvidenceContract {
    id: string;
    taskType: TaskType;
    requirements: EvidenceRequirement[];
}

export interface TaskTargetScope {
    mode: TargetScopeMode;
    primaryTokenAddress?: string;
    primaryTokenSymbol?: string;
    primaryWalletAddress?: string;
    requestedChainId?: number;
    requestedChainName?: string;
}

export interface AnswerGroundingPolicy {
    allowExternalClaimsWithoutEvidence: boolean;
    allowSearchSummaryWithoutCitations: boolean;
}

/**
 * System-owned output. This drives orchestration and evidence gathering.
 */
export interface TaskControlDecision {
    schemaVersion: string;
    taskType: TaskType;
    lane: ControlLane;
    searchRequirement: SearchRequirement;
    searchTarget: SearchTarget;
    targetScope: TaskTargetScope;
    evidenceContract: EvidenceContract;
    answerGrounding: AnswerGroundingPolicy;
}

export interface EvidenceNode {
    id: string;
    kind: EvidenceKind;
    sourceType: EvidenceSourceType;
    targetRef: string;
    obtainedAt: string;
    freshness: EvidenceFreshness;
    payload: Record<string, unknown>;
}

export interface EvidenceGraph {
    nodes: EvidenceNode[];
}

export interface GroundedAnswerInput {
    decision: TaskControlDecision;
    evidenceGraph: EvidenceGraph;
}
