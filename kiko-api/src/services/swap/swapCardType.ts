export type SwapCardType = 'buy' | 'sell' | 'swap';

const NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const NATIVE_SYMBOLS_BY_CHAIN: Record<number, string> = {
    1: 'ETH',
    10: 'ETH',
    56: 'BNB',
    137: 'POL',
    42161: 'ETH',
    8453: 'ETH',
    900: 'SOL',
};

const QUOTE_ASSET_SYMBOLS = new Set([
    'ETH',
    'WETH',
    'USDC',
    'USDC.E',
    'USDCE',
    'USDT',
    'DAI',
    'USDE',
    'USDS',
    'BTC',
    'WBTC',
    'BNB',
    'WBNB',
    'POL',
    'MATIC',
    'SOL',
]);

const QUOTE_ASSET_ADDRESSES_BY_CHAIN: Record<number, Set<string>> = {
    1: new Set([
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
        '0xdac17f958d2ee523a2206206994597c13d831ec7',
        '0x6b175474e89094c44da98b954eedeac495271d0f',
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    ]),
    10: new Set([
        '0x4200000000000000000000000000000000000006',
        '0x0b2c639c533813f4aa9d7837caf62653d097ff85',
        '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58',
    ]),
    56: new Set([
        '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        '0x55d398326f99059ff775485246999027b3197955',
    ]),
    137: new Set([
        '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
        '0x2791bca1f2de4661ed88a30c99a7a9449aa84174',
        '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
        '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
    ]),
    42161: new Set([
        '0x82af49447d8a07e3bd95bd0d56f35241523fbab1',
        '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
    ]),
    8453: new Set([
        '0x4200000000000000000000000000000000000006',
        '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    ]),
};

function normalizeSymbol(value: string | null | undefined): string {
    return String(value || '').trim().toUpperCase();
}

function isQuoteAsset(params: {
    token?: string | null;
    symbol?: string | null;
    chainId?: number | null;
}): boolean {
    const chainId = Number(params.chainId || 0);
    const rawToken = String(params.token || '').trim();
    const tokenLower = rawToken.toLowerCase();
    const symbol = normalizeSymbol(params.symbol);
    const tokenAsSymbol = normalizeSymbol(rawToken);
    const nativeSymbol = normalizeSymbol(NATIVE_SYMBOLS_BY_CHAIN[chainId]);

    if (tokenLower === NATIVE_PLACEHOLDER) return true;
    if (symbol && QUOTE_ASSET_SYMBOLS.has(symbol)) return true;
    if (tokenAsSymbol && QUOTE_ASSET_SYMBOLS.has(tokenAsSymbol)) return true;
    if (nativeSymbol && (symbol === nativeSymbol || tokenAsSymbol === nativeSymbol)) return true;
    return Boolean(tokenLower && QUOTE_ASSET_ADDRESSES_BY_CHAIN[chainId]?.has(tokenLower));
}

export function inferSwapCardType(params: {
    tokenIn?: string | null;
    tokenOut?: string | null;
    tokenInSymbol?: string | null;
    tokenOutSymbol?: string | null;
    chainId?: number | null;
}): SwapCardType {
    const tokenInIsQuote = isQuoteAsset({
        token: params.tokenIn,
        symbol: params.tokenInSymbol,
        chainId: params.chainId,
    });
    const tokenOutIsQuote = isQuoteAsset({
        token: params.tokenOut,
        symbol: params.tokenOutSymbol,
        chainId: params.chainId,
    });

    if (tokenInIsQuote && !tokenOutIsQuote) return 'buy';
    if (!tokenInIsQuote && tokenOutIsQuote) return 'sell';
    return 'swap';
}
