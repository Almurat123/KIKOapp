type BuildTokenContextParams = {
    mode: 'deepseek' | 'grok';
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
    if (tokenInfo) {
        const base = [
            `[TOKEN_CONTEXT]${mode === 'deepseek' && params.cacheStatusLabel ? ` ${params.cacheStatusLabel}` : ''}`,
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
                ? `🚀 Launchpad: ${tokenInfo.launchpad.provider.toUpperCase()}${mode === 'deepseek' ? ' (DO NOT run active security scan on launchpad tokens).' : ' - This token was launched on a launchpad platform.'}`
                : '',
        ];
        if (mode === 'grok') {
            const xSeedHandles = params.xSeedHandles || [];
            const officialSites = params.officialSites || [];
            if (xSeedHandles.length > 0) base.push(`Official X (seed): ${xSeedHandles.join(', ')}`);
            if (officialSites.length > 0) base.push(`Official Sites (seed): ${officialSites.join(', ')}`);
        }
        if (mode === 'deepseek') {
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

