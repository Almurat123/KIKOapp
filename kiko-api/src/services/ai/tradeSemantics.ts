export const STABLE_SYMBOLS = new Set(['USDC', 'USDT', 'DAI', 'FDUSD', 'BUSD', 'USD1']);
export const NATIVE_SYMBOLS = new Set(['ETH', 'WETH', 'BNB', 'WBNB', 'SOL', 'WSOL', 'POL', 'MATIC', 'WMATIC']);

const CHAIN_DEFAULT_NATIVE: Record<number, string> = {
    1: 'ETH',
    10: 'ETH',
    56: 'BNB',
    137: 'POL',
    42161: 'ETH',
    8453: 'ETH',
    900: 'SOL',
};

const EVM_ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;
const SOL_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const SYMBOL_RE = /\b[A-Za-z][A-Za-z0-9._-]{1,23}\b/g;
const ASSET_CAPTURE = '([A-Za-z0-9$._\\-\\u4e00-\\u9fff]{2,32})';
const EN_STOP_WORDS = new Set([
    'BUY', 'SELL', 'SWAP', 'TRADE', 'GET', 'ALL', 'WITH', 'USING', 'USE', 'SPEND', 'FOR', 'TO', 'INTO',
    'RECEIVE', 'VALUE', 'WORTH', 'ABOUT', 'AROUND', 'USD', 'DOLLAR', 'DOLLARS', 'BUCK', 'BUCKS',
    'THE', 'A', 'AN', 'OF', 'ON', 'CHAIN', 'TOKEN', 'TOKENS', 'HOT', 'TRENDING', 'VALUE', 'PLEASE',
    'CHECK',
]);

export type TradeAction = 'buy' | 'sell' | 'swap' | 'unknown';
export type TradeAmountKind = 'all' | 'percent' | 'quantity' | 'fiat_value' | 'unspecified';
export type TradeAmountSemantic = 'input' | 'output' | 'fiat_value' | 'all' | 'percent' | 'unspecified';

export interface TradeAmountSpec {
    raw?: string;
    value?: string;
    kind: TradeAmountKind;
    semantic: TradeAmountSemantic;
    currency?: 'USD';
    asset?: string;
}

export interface TradeSemantics {
    action: TradeAction;
    explicitTradeVerb: boolean;
    tokenIn?: string;
    tokenOut?: string;
    amount: TradeAmountSpec;
    referencedAddresses: string[];
    referencedSymbols: string[];
    sourceAsset?: string;
    destinationAsset?: string;
    targetAsset?: string;
    chainId?: number;
    needsAmountResolution: boolean;
}

export interface TradeSemanticInput {
    text: string;
    chainId?: number;
    requestedTokenAddresses?: string[];
    requestedTokenSymbols?: string[];
    canonicalTokenAddresses?: string[];
    canonicalTokenSymbols?: string[];
    preferredTokenAddress?: string;
    preferredTokenSymbol?: string;
}

function unique<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

function normalizeAsset(value: string | null | undefined): string | undefined {
    const trimmed = String(value || '')
        .replace(/^[\s"'`“”‘’$]+/, '')
        .replace(/[，。！？、,.!?;:：；）)\]】"'`“”‘’吗呢吧啊呀啦]+$/g, '')
        .trim();
    if (!trimmed) return undefined;
    if (/^0x[a-fA-F0-9]{40}$/.test(trimmed) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
        return trimmed;
    }
    if (/^[A-Za-z][A-Za-z0-9._-]{1,23}$/.test(trimmed)) {
        return trimmed.toUpperCase();
    }
    return trimmed;
}

function detectTradeAction(text: string): TradeAction {
    const raw = String(text || '');
    if (/\b(sell|dump|exit|liquidate)\b/i.test(raw) || /卖|卖出|清仓|卖光|出掉/.test(raw)) {
        return 'sell';
    }
    if (/\b(buy|get|receive|purchase|ape)\b/i.test(raw) || /买|买入|购买|收|拿/.test(raw)) {
        return 'buy';
    }
    if (/\b(swap|trade|exchange|convert)\b/i.test(raw) || /换|兑换|交易|转成/.test(raw)) {
        return 'swap';
    }
    return 'unknown';
}

export function extractTradeAssetCandidates(text: string): string[] {
    const raw = String(text || '');
    const candidates: string[] = [];
    const action = detectTradeAction(raw);

    for (const match of raw.match(EVM_ADDRESS_RE) || []) {
        candidates.push(match.toLowerCase());
    }
    for (const match of raw.match(SOL_ADDRESS_RE) || []) {
        candidates.push(match);
    }
    for (const match of raw.matchAll(SYMBOL_RE)) {
        const normalized = normalizeAsset(match[0]);
        if (!normalized) continue;
        if (EN_STOP_WORDS.has(normalized)) continue;
        if (/^\d/.test(normalized)) continue;
        if (match[0] === match[0].toLowerCase()) continue;
        candidates.push(normalized);
    }
    for (const match of raw.matchAll(/\$([A-Za-z][A-Za-z0-9._-]{1,23})/g)) {
        const normalized = normalizeAsset(match[1]);
        if (normalized && !EN_STOP_WORDS.has(normalized)) {
            candidates.push(normalized);
        }
    }
    if (action !== 'unknown') {
        const targeted = [
            extractSourceAsset(raw),
            extractDestinationAsset(raw),
            extractVerbTargetAsset(raw, action),
        ].map(normalizeAsset).filter(Boolean) as string[];
        candidates.push(...targeted);
    }

    return unique(candidates);
}

function matchFirstAsset(text: string, patterns: RegExp[]): string | undefined {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        const normalized = normalizeAsset(match?.[1]);
        if (normalized) return normalized;
    }
    return undefined;
}

function extractSourceAsset(text: string): string | undefined {
    return matchFirstAsset(text, [
        new RegExp(`\\b(?:with|using|use|spend)\\s*(?:\\$?\\d+(?:\\.\\d+)?\\s*)?${ASSET_CAPTURE}`, 'i'),
        new RegExp(`用\\s*(?:\\$?\\d+(?:\\.\\d+)?\\s*)?${ASSET_CAPTURE}`),
    ]);
}

function extractDestinationAsset(text: string): string | undefined {
    return matchFirstAsset(text, [
        new RegExp(`\\b(?:to|into|for|receive)\\s+${ASSET_CAPTURE}`, 'i'),
        new RegExp(`(?:卖成|换成|兑换成|转成|到)\\s*${ASSET_CAPTURE}`),
    ]);
}

function extractVerbTargetAsset(text: string, action: TradeAction): string | undefined {
    if (action === 'buy') {
        return matchFirstAsset(text, [
            new RegExp(`\\b(?:buy|get|purchase|ape)\\s*(?:worth\\s+)?(?:\\$?\\d+(?:\\.\\d+)?(?:\\s*(?:usd|dollars?|bucks?))?\\s*)?(?:of\\s+)?${ASSET_CAPTURE}`, 'i'),
            new RegExp(`(?:买|买入|购买)\\s*(?:价值|值)?\\s*(?:\\$?\\d+(?:\\.\\d+)?(?:\\s*(?:美元|美金|刀))?\\s*)?(?:的)?\\s*${ASSET_CAPTURE}`),
        ]);
    }
    if (action === 'sell') {
        return matchFirstAsset(text, [
            new RegExp(`\\b(?:sell|dump|liquidate|convert)\\s*(?:all\\s+|max\\s+)?(?:worth\\s+)?(?:\\$?\\d+(?:\\.\\d+)?(?:\\s*(?:usd|dollars?|bucks?))?\\s*)?(?:of\\s+)?${ASSET_CAPTURE}`, 'i'),
            new RegExp(`(?:卖|卖出|清仓|卖光)\\s*(?:全部|全卖|卖光|清仓)?\\s*(?:价值|值)?\\s*(?:\\$?\\d+(?:\\.\\d+)?(?:\\s*(?:美元|美金|刀))?\\s*)?(?:的)?\\s*${ASSET_CAPTURE}`),
        ]);
    }
    return undefined;
}

function parseAmount(text: string, action: TradeAction, tokenIn?: string, tokenOut?: string): TradeAmountSpec {
    const raw = String(text || '');
    if (/\b(all|max|entire|everything)\b/i.test(raw) || /全部|全卖|卖光|清仓|满仓|所有|最大/.test(raw)) {
        return { raw: 'all', value: 'all', kind: 'all', semantic: 'all' };
    }

    const percentMatch = raw.match(/\b(\d+(?:\.\d+)?)\s*%/i);
    if (percentMatch) {
        return { raw: percentMatch[0], value: percentMatch[1], kind: 'percent', semantic: 'percent' };
    }

    const usdMatch = raw.match(/(?:\bworth\b|\bvalue\b|价值|值)\s*\$?\s*(\d+(?:\.\d+)?)(?:\s*(?:usd|dollars?|bucks?|美元|美金|刀))?/i)
        || raw.match(/\$\s*(\d+(?:\.\d+)?)/i)
        || raw.match(/(\d+(?:\.\d+)?)\s*(?:usd|dollars?|bucks?|美元|美金|刀)/i);
    if (usdMatch) {
        return {
            raw: usdMatch[0],
            value: usdMatch[1],
            kind: 'fiat_value',
            semantic: 'fiat_value',
            currency: 'USD',
        };
    }

    const quantityWithAsset = raw.match(/\b(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9._-]{1,23})\b/i);
    if (quantityWithAsset) {
        const value = quantityWithAsset[1];
        const asset = normalizeAsset(quantityWithAsset[2]);
        const semantic = asset && tokenOut && asset === normalizeAsset(tokenOut)
            ? 'output'
            : asset && tokenIn && asset === normalizeAsset(tokenIn)
                ? 'input'
                : action === 'buy'
                    ? 'output'
                    : 'input';
        return {
            raw: quantityWithAsset[0],
            value,
            kind: 'quantity',
            semantic,
            asset,
        };
    }

    const plainNumber = raw.match(/\b(\d+(?:\.\d+)?)\b/);
    if (plainNumber) {
        return {
            raw: plainNumber[0],
            value: plainNumber[1],
            kind: 'quantity',
            semantic: action === 'buy' ? 'output' : 'input',
        };
    }

    return {
        kind: 'unspecified',
        semantic: 'unspecified',
    };
}

function choosePrimaryTarget(params: {
    canonicalTokenAddresses?: string[];
    canonicalTokenSymbols?: string[];
    requestedTokenAddresses?: string[];
    requestedTokenSymbols?: string[];
    preferredTokenAddress?: string;
    preferredTokenSymbol?: string;
    verbTarget?: string;
    destinationAsset?: string;
    sourceAsset?: string;
    chainId?: number;
    extractedAssets: string[];
}): string | undefined {
    const nativeSymbol = CHAIN_DEFAULT_NATIVE[Number(params.chainId || 8453)] || 'ETH';
    const ordered = [
        params.preferredTokenAddress,
        params.preferredTokenSymbol,
        ...(params.canonicalTokenAddresses || []),
        ...(params.canonicalTokenSymbols || []),
        ...(params.requestedTokenAddresses || []),
        ...(params.requestedTokenSymbols || []),
        params.verbTarget,
        ...params.extractedAssets,
    ].map(normalizeAsset).filter(Boolean) as string[];

    for (const candidate of ordered) {
        if (candidate === params.destinationAsset || candidate === params.sourceAsset) continue;
        if (STABLE_SYMBOLS.has(candidate) || NATIVE_SYMBOLS.has(candidate) || candidate === nativeSymbol) continue;
        return candidate;
    }
    for (const candidate of ordered) {
        if (candidate === params.destinationAsset || candidate === params.sourceAsset) continue;
        return candidate;
    }
    return undefined;
}

export function resolveTradeSemantics(input: TradeSemanticInput): TradeSemantics {
    const text = String(input.text || '').trim();
    const action = detectTradeAction(text);
    const explicitTradeVerb = action !== 'unknown';
    const extractedAssets = extractTradeAssetCandidates(text);
    const referencedAddresses = unique([
        ...(input.canonicalTokenAddresses || []).map((value) => String(value).toLowerCase()),
        ...(input.requestedTokenAddresses || []).map((value) => String(value).toLowerCase()),
        ...extractedAssets.filter((value) => /^0x[a-fA-F0-9]{40}$/.test(value)).map((value) => value.toLowerCase()),
        ...extractedAssets.filter((value) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)),
    ]);
    const referencedSymbols = unique([
        ...(input.canonicalTokenSymbols || []).map((value) => normalizeAsset(value)).filter(Boolean) as string[],
        ...(input.requestedTokenSymbols || []).map((value) => normalizeAsset(value)).filter(Boolean) as string[],
        ...extractedAssets.filter((value) => !/^0x[a-fA-F0-9]{40}$/.test(value) && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)),
    ]);
    const sourceAsset = extractSourceAsset(text);
    const destinationAsset = extractDestinationAsset(text);
    const verbTarget = extractVerbTargetAsset(text, action);
    const chainId = Number(input.chainId || 0) || undefined;
    const nativeSymbol = CHAIN_DEFAULT_NATIVE[chainId || 8453] || 'ETH';
    const targetAsset = choosePrimaryTarget({
        canonicalTokenAddresses: input.canonicalTokenAddresses,
        canonicalTokenSymbols: input.canonicalTokenSymbols,
        requestedTokenAddresses: input.requestedTokenAddresses,
        requestedTokenSymbols: input.requestedTokenSymbols,
        preferredTokenAddress: input.preferredTokenAddress,
        preferredTokenSymbol: input.preferredTokenSymbol,
        verbTarget,
        destinationAsset,
        sourceAsset,
        chainId,
        extractedAssets: [...referencedAddresses, ...referencedSymbols],
    });

    let tokenIn: string | undefined;
    let tokenOut: string | undefined;
    if (action === 'sell') {
        tokenIn = targetAsset || sourceAsset;
        tokenOut = destinationAsset || nativeSymbol;
    } else if (action === 'buy') {
        tokenOut = targetAsset || destinationAsset;
        tokenIn = sourceAsset || (destinationAsset && destinationAsset !== tokenOut ? destinationAsset : nativeSymbol);
    } else if (action === 'swap') {
        if (sourceAsset && destinationAsset) {
            tokenIn = sourceAsset;
            tokenOut = destinationAsset;
        } else if (destinationAsset) {
            tokenOut = destinationAsset;
            tokenIn = targetAsset && targetAsset !== destinationAsset ? targetAsset : sourceAsset || nativeSymbol;
        } else if (targetAsset) {
            tokenOut = targetAsset;
            tokenIn = sourceAsset || nativeSymbol;
        } else {
            tokenIn = sourceAsset;
            tokenOut = destinationAsset;
        }
    }

    const amount = parseAmount(text, action, tokenIn, tokenOut);
    const needsAmountResolution =
        amount.kind === 'fiat_value'
        || amount.semantic === 'output'
        || (action === 'buy' && amount.kind === 'quantity');

    return {
        action,
        explicitTradeVerb,
        tokenIn,
        tokenOut,
        amount,
        referencedAddresses,
        referencedSymbols,
        sourceAsset,
        destinationAsset,
        targetAsset,
        chainId,
        needsAmountResolution,
    };
}

export function defaultNativeSymbolForChain(chainId?: number): string {
    return CHAIN_DEFAULT_NATIVE[Number(chainId || 8453)] || 'ETH';
}

export function isKnownTradeVerb(text: string): boolean {
    return detectTradeAction(text) !== 'unknown';
}
