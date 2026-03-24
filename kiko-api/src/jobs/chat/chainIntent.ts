export interface RequestedChainHint {
    chainId: number;
    chainName: string;
    source: 'explicit_query' | 'address_shape' | 'native_symbol';
}

const CHAIN_SWITCH_PATTERNS = [
    /\bswitch\s+(?:wallet\s+)?chain\b/i,
    /\bswitch\s+to\s+(?:ethereum|eth|base|bnb|bsc|bnb chain|binance smart chain|polygon|matic|pol|arbitrum|arb|optimism|op|solana|sol)\b/i,
    /\bchange\s+(?:wallet\s+)?chain\b/i,
    /\bmove\s+to\s+(?:ethereum|eth|base|bnb|bsc|bnb chain|binance smart chain|polygon|matic|pol|arbitrum|arb|optimism|op|solana|sol)\b/i,
    /切换(?:到|至)?(?:钱包)?链/,
    /切到(?:以太坊|eth|base|bnb|bsc|币安|polygon|matic|pol|arbitrum|optimism|solana|sol)/,
];

const CHAIN_QUERY_PATTERNS: Array<{ chainId: number; chainName: string; patterns: RegExp[] }> = [
    {
        chainId: 1,
        chainName: 'Ethereum',
        patterns: [
            /\bon\s+(?:ethereum|eth)\b/i,
            /\b(?:ethereum|eth)\s+(?:mainnet|chain)\b/i,
        ],
    },
    {
        chainId: 8453,
        chainName: 'Base',
        patterns: [
            /\bon\s+base\b/i,
            /\bbase\s+(?:mainnet|chain)\b/i,
        ],
    },
    {
        chainId: 56,
        chainName: 'BNB Chain',
        patterns: [
            /\bon\s+(?:bnb|bsc|bnb chain|binance smart chain)\b/i,
            /\b(?:bsc|bnb|bnb smart chain|binance smart chain)\s+chain\b/i,
            /\bbep-?20\b/i,
        ],
    },
    {
        chainId: 137,
        chainName: 'Polygon',
        patterns: [
            /\bon\s+(?:polygon|matic|pol)\b/i,
            /\b(?:polygon|matic|pol)\s+chain\b/i,
        ],
    },
    {
        chainId: 42161,
        chainName: 'Arbitrum',
        patterns: [
            /\bon\s+(?:arbitrum|arb)\b/i,
            /\b(?:arbitrum|arb)\s+(?:one|chain)\b/i,
        ],
    },
    {
        chainId: 10,
        chainName: 'Optimism',
        patterns: [
            /\bon\s+optimism\b/i,
            /\boptimism\s+(?:mainnet|chain)\b/i,
            /\bop\s+mainnet\b/i,
        ],
    },
    {
        chainId: 900,
        chainName: 'Solana',
        patterns: [
            /\bon\s+(?:solana|sol)\b/i,
            /\bsolana\s+chain\b/i,
        ],
    },
];

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function resolveRequestedChainHint(params: {
    text: string;
    requestedTokenAddresses?: string[];
    requestedTokenSymbols?: string[];
}): RequestedChainHint | null {
    const raw = String(params.text || '');
    for (const candidate of CHAIN_QUERY_PATTERNS) {
        if (candidate.patterns.some((pattern) => pattern.test(raw))) {
            return {
                chainId: candidate.chainId,
                chainName: candidate.chainName,
                source: 'explicit_query',
            };
        }
    }

    for (const address of params.requestedTokenAddresses || []) {
        const value = String(address || '').trim();
        if (value && !value.startsWith('0x') && SOLANA_ADDRESS_RE.test(value)) {
            return {
                chainId: 900,
                chainName: 'Solana',
                source: 'address_shape',
            };
        }
    }

    const upperSymbols = (params.requestedTokenSymbols || []).map((symbol) => String(symbol || '').toUpperCase());
    if (upperSymbols.some((symbol) => symbol === 'BNB' || symbol === 'WBNB')) {
        return {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'native_symbol',
        };
    }
    if (upperSymbols.some((symbol) => symbol === 'POL' || symbol === 'MATIC' || symbol === 'WMATIC')) {
        return {
            chainId: 137,
            chainName: 'Polygon',
            source: 'native_symbol',
        };
    }
    if (upperSymbols.some((symbol) => symbol === 'SOL' || symbol === 'WSOL')) {
        return {
            chainId: 900,
            chainName: 'Solana',
            source: 'native_symbol',
        };
    }

    return null;
}

export function isExplicitChainSwitchRequest(text: string): boolean {
    const raw = String(text || '');
    if (!raw.trim()) return false;
    return CHAIN_SWITCH_PATTERNS.some((pattern) => pattern.test(raw));
}
