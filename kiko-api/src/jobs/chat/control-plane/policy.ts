import type {
    EvidenceContract,
    EvidenceRequirement,
    SearchRequirement,
    SearchTarget,
    SemanticParse,
    TaskControlDecision,
    TaskTargetScope,
    TaskType,
} from './types.js';

const SCHEMA_VERSION = 'control-plane-v1';

export function deriveTaskControlDecision(parse: SemanticParse): TaskControlDecision {
    const taskType = deriveTaskType(parse);
    const lane = isExecutionTask(taskType) ? 'execution' : 'analysis';
    const searchRequirement = deriveSearchRequirement(taskType);
    const searchTarget = deriveSearchTarget(taskType);
    const targetScope = deriveTargetScope(parse);
    const evidenceContract = buildEvidenceContract(taskType);

    return {
        schemaVersion: SCHEMA_VERSION,
        taskType,
        lane,
        searchRequirement,
        searchTarget,
        targetScope,
        evidenceContract,
        answerGrounding: {
            allowExternalClaimsWithoutEvidence: false,
            allowSearchSummaryWithoutCitations: false,
        },
    };
}

function deriveTaskType(parse: SemanticParse): TaskType {
    switch (parse.intent) {
        case 'swap_execution':
            return 'swap_execution';
        case 'copy_trade_execution':
            return 'copy_trade_execution';
        case 'early_buyer_export':
            return 'early_buyer_export';
        case 'creator_analysis':
            return 'creator_analysis';
        case 'token_risk_review':
            return 'token_risk_review';
        case 'wallet_analysis':
            return 'wallet_analysis';
        case 'wallet_pnl':
            return 'wallet_pnl';
        case 'social_discovery':
            return 'social_discovery';
        case 'market_discovery':
            return 'market_discovery';
        case 'polymarket_discovery':
            return 'polymarket_discovery';
        case 'polymarket_order':
            return 'polymarket_order';
        case 'token_attention_analysis':
            return 'token_attention_analysis';
        case 'token_analysis':
            return parse.cues.currentTurnExplicitAddress && parse.cues.explicitSocialEvidenceRequest
                ? 'token_attention_analysis'
                : 'token_analysis';
        default:
            return 'general_answer';
    }
}

function deriveSearchRequirement(taskType: TaskType): SearchRequirement {
    switch (taskType) {
        case 'token_attention_analysis':
        case 'social_discovery':
            return 'required';
        case 'market_discovery':
        case 'token_analysis':
        case 'creator_analysis':
            return 'optional';
        default:
            return 'forbidden';
    }
}

function deriveSearchTarget(taskType: TaskType): SearchTarget {
    switch (taskType) {
        case 'token_attention_analysis':
        case 'social_discovery':
            return 'x_and_web';
        case 'market_discovery':
        case 'token_analysis':
        case 'creator_analysis':
            return 'web';
        default:
            return 'none';
    }
}

function deriveTargetScope(parse: SemanticParse): TaskTargetScope {
    const primaryTokenAddress = parse.entities.tokenAddresses[0];
    const primaryTokenSymbol = primaryTokenAddress ? undefined : parse.entities.tokenSymbols[0];
    const primaryWalletAddress = parse.entities.walletAddresses[0];
    const requestedChainId = parse.entities.chainIds[0];
    const requestedChainName = parse.entities.chainNames[0];

    return {
        mode: parse.cues.currentTurnExplicitAddress
            ? 'current_turn_only'
            : parse.cues.followupReference
                ? 'followup_scoped'
                : 'session_scoped',
        primaryTokenAddress,
        primaryTokenSymbol,
        primaryWalletAddress,
        requestedChainId,
        requestedChainName,
    };
}

function buildEvidenceContract(taskType: TaskType): EvidenceContract {
    return {
        id: `${SCHEMA_VERSION}:${taskType}`,
        taskType,
        requirements: requirementsForTask(taskType),
    };
}

function requirementsForTask(taskType: TaskType): EvidenceRequirement[] {
    switch (taskType) {
        case 'token_attention_analysis':
            return [
                required('identity', 'static', 'Lock token identity before gathering any evidence.'),
                required('market', 'realtime', 'Heat analysis must anchor current market activity.'),
                required('onchain_token', 'realtime', 'Heat analysis must include chain-side token flow evidence.'),
                required('external_attention', 'realtime', 'Heat analysis must include external social or web attention evidence.'),
            ];
        case 'token_analysis':
            return [
                required('identity', 'static', 'Token analysis must lock the token identity first.'),
                required('market', 'session', 'Token analysis needs market context.'),
                required('onchain_token', 'session', 'Token analysis needs chain-side token evidence.'),
            ];
        case 'token_risk_review':
            return [
                required('identity', 'static', 'Risk review must lock the token identity first.'),
                required('onchain_token', 'session', 'Risk review needs token holder and creator evidence.'),
                optional('official_announcements', 'session', 'Official verification is helpful when available.'),
            ];
        case 'early_buyer_export':
            return [
                required('identity', 'static', 'Early-buyer export must lock the token identity first.'),
                required('onchain_token', 'historical', 'Early-buyer export is defined by chain-side evidence.'),
            ];
        case 'creator_analysis':
            return [
                required('identity', 'static', 'Creator analysis must lock the token identity first.'),
                required('onchain_token', 'session', 'Creator analysis needs deployment and holder evidence.'),
                optional('official_announcements', 'session', 'Official context may help attribute the creator.'),
            ];
        case 'wallet_analysis':
        case 'wallet_pnl':
            return [
                required('wallet_state', 'session', 'Wallet tasks require wallet state evidence.'),
            ];
        case 'swap_execution':
        case 'copy_trade_execution':
        case 'polymarket_order':
            return [
                required('wallet_state', 'session', 'Execution requires wallet state.'),
                required('execution_preflight', 'session', 'Execution requires preflight validation.'),
                optional('execution_quote', 'session', 'Quote may be required by user settings.'),
            ];
        case 'market_discovery':
            return [
                required('market', 'realtime', 'Market discovery should be anchored to fresh market data.'),
            ];
        case 'social_discovery':
            return [
                required('external_attention', 'realtime', 'Social discovery requires fresh public-source evidence.'),
            ];
        default:
            return [];
    }
}

function isExecutionTask(taskType: TaskType): boolean {
    return ['swap_execution', 'copy_trade_execution', 'polymarket_order'].includes(taskType);
}

function required(
    kind: EvidenceRequirement['kind'],
    freshness: EvidenceRequirement['freshness'],
    reason: string,
): EvidenceRequirement {
    return { kind, freshness, required: true, reason };
}

function optional(
    kind: EvidenceRequirement['kind'],
    freshness: EvidenceRequirement['freshness'],
    reason: string,
): EvidenceRequirement {
    return { kind, freshness, required: false, reason };
}
