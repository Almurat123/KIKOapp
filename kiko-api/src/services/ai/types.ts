// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: the shared AI prompt-orchestration types still carried `deepseek` as
//         the canonical normal-model family even after KiKo moved normal-model
//         traffic to NVIDIA-hosted GLM/Kimi.
// Goal: keep one explicit model-family contract for prompt assembly while
//       preserving legacy compatibility during the migration window.
// Owns: prompt-orchestration type contracts shared by system-prompt assembly.
// Does Not Own: provider routing, billing buckets, or frontend model labels.
// Design Language:
// - `nvidia` is the active normal-model family for current routing.
// - `deepseek` remains a legacy compatibility value until old workers are removed.
// - Shared types should reflect migration state instead of hiding it in callers.
// Document Provenance:
// - Source: NVIDIA NIM model pages for moonshotai/kimi-k2-5 and z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: prompt-layer model family typing for NVIDIA GLM/Kimi
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type IntentType =
    | 'TRADING'
    | 'COPY_TRADING'
    | 'PREDICTION_MARKETS'
    | 'RISK_SCAN'
    | 'GENERAL_QUERY';

export type ModelType = 'deepseek' | 'nvidia' | 'grok';

export interface UserContext {
    userAddress?: string;
    solanaAddress?: string;
    chainId?: number;
    chainName?: string;
    isWalletConnected?: boolean;
    farcaster?: {
        followsKiko?: boolean | null;
        followStatus?: 'following' | 'not_following' | 'unknown';
        checkedAt?: string | null;
        kikoHandle?: string;
        profileUrl?: string;
    };
    balance?: Record<string, string> | Array<{
        symbol: string;
        balance: string;
        decimals?: number;
        contractAddress?: string;
        raw?: string;
    }>;
    nativeBalance?: string;
    pageContext?: string;
    currentPage?: string;
    pendingSwapToken?: { address: string; symbol: string; chainId: number };
    toolConfig?: any;
    /**
     * @deprecated Legacy-only field. Intent hints are no longer injected into prompts.
     */
    intentHints?: {
        conflict?: string;
        question?: string;
        labels?: string[];
    };
}

export interface OrchestratorOptions {
    mode?: 'default' | 'strict' | 'experiment';
    agent?: 'kiko-terminal' | 'copytrade';
    routingMode?: 'execution';
}
