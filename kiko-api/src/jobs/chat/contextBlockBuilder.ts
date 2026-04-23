// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Rowan
// Reason: token-context helper text still treated the normal-model path as
//         `deepseek`, which left stale provider wording in the snapshot context
//         after KiKo switched that path to OpenAI.
// Goal: preserve the cached-token-context rules for the normal-model family
//       while removing vendor-specific wording from the active path.
// Owns: token and launchpad context block rendering for chat orchestration.
// Does Not Own: token fetching, skill routing, or provider request shaping.
// Design Language:
// - Cached local-context rules belong to the normal-model family, not a retired vendor name.
// - Grok remains the only path with native-search seed hints in token context.
// - Legacy DeepSeek wording may remain only as a compatibility alias, not the active branch.
// Document Provenance:
// - Kind: product doc
// - Retrieved: 2026-04-23
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

type BuildTokenContextParams = {
    mode: 'deepseek' | 'openai' | 'grok';
    tokenInfo: any | null;
    contractAddress?: string;
    cacheStatusLabel?: string;
    xSeedHandles?: string[];
    officialSites?: string[];
};

export function buildTokenContextBlock(params: BuildTokenContextParams): {
    tokenContextBlock: string;
    tokenContextAvailable: boolean;
} {
    const { mode, tokenInfo, contractAddress } = params;
    const isCachedLocalMode = mode === 'deepseek';
    if (tokenInfo) {
        const base = [
            `[TOKEN_CONTEXT]${isCachedLocalMode && params.cacheStatusLabel ? ` ${params.cacheStatusLabel}` : ''}`,
            `Detected Token: ${tokenInfo.symbol} (${tokenInfo.name})`,
            `Address: ${tokenInfo.address}`,
            `Chain: ${tokenInfo.chainName} (${tokenInfo.chainId})`,
            tokenInfo.price ? `Current Price: $${tokenInfo.price.toFixed(6)}` : '',
            tokenInfo.priceChange24h !== undefined
                ? `24h Change: ${tokenInfo.priceChange24h > 0 ? '+' : ''}${tokenInfo.priceChange24h.toFixed(2)}%`
                : '',
            tokenInfo.volume24h ? `24h Volume: $${tokenInfo.volume24h.toLocaleString()}` : '',
            tokenInfo.marketCap ? `Market Cap: $${tokenInfo.marketCap.toLocaleString()}` : '',
            tokenInfo.launchpad
                ? `🚀 Launchpad: ${tokenInfo.launchpad.provider.toUpperCase()}${isCachedLocalMode ? ' (DO NOT run active security scan on launchpad tokens).' : ' - This token was launched on a launchpad platform.'}`
                : '',
        ];
        if (mode === 'grok') {
            const xSeedHandles = params.xSeedHandles || [];
            const officialSites = params.officialSites || [];
            if (xSeedHandles.length > 0) base.push(`Official X (seed): ${xSeedHandles.join(', ')}`);
            if (officialSites.length > 0) base.push(`Official Sites (seed): ${officialSites.join(', ')}`);
        }
        if (isCachedLocalMode) {
            base.push(`⚡ IMPORTANT: This token data is ALREADY AVAILABLE. DO NOT call get_token_info again for ${tokenInfo.symbol || tokenInfo.address}.`);
        }
        return {
            tokenContextBlock: `\n\n${base.filter(Boolean).join('\n')}\n`,
            tokenContextAvailable: true,
        };
    }

    if (mode === 'grok' && contractAddress) {
        return {
            tokenContextBlock: `\n\n[TOKEN_CONTEXT]
Token metadata unavailable for ${contractAddress}.
Rule: Do not repeatedly query metadata in this turn; proceed with best-effort info.`,
            tokenContextAvailable: false,
        };
    }

    return { tokenContextBlock: '', tokenContextAvailable: false };
}

type BuildLaunchpadContextParams = {
    launchpadInfo?: any | null;
    tokenInfo?: any | null;
    fallbackAddress?: string;
    fallbackChainId?: number;
};

export function buildLaunchpadContextBlock(params: BuildLaunchpadContextParams): {
    launchpadContextBlock: string;
    launchpadContextAvailable: boolean;
} {
    const launchpad = params.launchpadInfo || params.tokenInfo?.launchpad;
    if (!launchpad) return { launchpadContextBlock: '', launchpadContextAvailable: false };

    const provider = launchpad.provider?.toUpperCase?.() || launchpad.provider;
    const chain = launchpad.chainId || params.tokenInfo?.chainId || params.fallbackChainId;
    const address = launchpad.address || params.tokenInfo?.address || params.fallbackAddress;
    return {
        launchpadContextBlock: `\n\n[LAUNCHPAD_CONTEXT]
Token is a launchpad token.
Provider: ${provider}
Chain: ${chain}
Address: ${address}
Rule: Skip check_token_risk for launchpad tokens. Do NOT run active security scans.
If the user has not provided clear trade params, ask one concise follow-up for side/amount.`,
        launchpadContextAvailable: true,
    };
}
