import { Tool } from '../../../tooling/registry.js';
import * as geckoTerminal from '../../../services/geckoTerminal.js';
import * as dexscreener from '../../../services/dexscreener.js';
import { resolveChainInput } from '../../../utils/chainParam.js';
import { findCachedTrendingToken } from '../../../repositories/tokenRepository.js';
import { isTruncatedEvmAddressLike, repairTruncatedEvmAddressFromMessages } from '../../../services/addressRecovery.js';

function isTokenAddressLike(value: string): boolean {
    const raw = String(value || '').trim();
    if (!raw) return false;
    if (/^0x[a-fA-F0-9]{40}$/.test(raw)) return true;
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw);
}

type ResolveTokenInfoLookupDeps = {
    findCachedTrendingToken?: typeof findCachedTrendingToken;
};

export async function resolveTokenInfoLookup(params: {
    identifier: string;
    chain: string;
}, deps: ResolveTokenInfoLookupDeps = {}): Promise<{
    resolvedAddress: string;
    cachedToken: Awaited<ReturnType<typeof findCachedTrendingToken>>;
}> {
    const identifier = String(params.identifier || '').trim();
    if (!identifier) {
        return { resolvedAddress: '', cachedToken: null };
    }

    if (isTokenAddressLike(identifier)) {
        return { resolvedAddress: identifier, cachedToken: null };
    }

    const loadCachedTrendingToken = deps.findCachedTrendingToken || findCachedTrendingToken;
    const cachedToken = await loadCachedTrendingToken(identifier, params.chain).catch(() => null);
    return {
        resolvedAddress: cachedToken?.address || identifier,
        cachedToken,
    };
}

export const GetTokenInfoTool: Tool = {
    definition: {
        name: 'get_token_info',
        description: 'Get current price, volume, and detailed metadata for a specific token on a blockchain.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The token contract address, or a token symbol/name already present in KiKo cached token data for that chain.',
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain network ID (e.g. eth, solana, base, bsc)',
                    enum: ['eth', 'solana', 'base', 'bsc', 'arbitrum', 'polygon', 'optimism', 'avalanche']
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56, 900',
                }
            },
            required: ['address']
        }
    },
    handler: async (args, context) => {
        try {
            const { detectLaunchpadToken } = await import('../../../services/ai/launchpadDetector.js');
            const { chain, chainId, invalidChainId } = resolveChainInput(args, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (invalidChainId) {
                return { error: `Unsupported chain_id: ${String(args.chain_id)}` };
            }
            const resolvedChainId = chainId ?? 1;
            let requestedIdentifier = String(args.address || '').trim();
            if (context?.sessionId && isTruncatedEvmAddressLike(requestedIdentifier)) {
                try {
                    const { getSessionMessages } = await import('../../../repositories/chatRepository.js');
                    const sessionMessages = await getSessionMessages(context.sessionId);
                    requestedIdentifier = repairTruncatedEvmAddressFromMessages(requestedIdentifier, sessionMessages);
                } catch (repairErr: any) {
                    console.warn('[GetTokenInfo] Failed to repair truncated token address from session:', repairErr?.message || repairErr);
                }
            }
            const { cachedToken, resolvedAddress } = await resolveTokenInfoLookup({
                identifier: requestedIdentifier,
                chain,
            });
            const [launchpad, tokenData, dexData] = await Promise.all([
                detectLaunchpadToken(resolvedAddress, resolvedChainId).catch(() => null),
                geckoTerminal.getTokenDetails(chain, resolvedAddress).catch((gtError) => {
                    console.warn('[GetTokenInfo] GeckoTerminal failed', gtError);
                    return null;
                }),
                dexscreener.getTokenDetails(chain, resolvedAddress).catch((dexError) => {
                    console.warn('[GetTokenInfo] DexScreener failed', dexError);
                    return null;
                }),
            ]);

            if (dexData) {
                const launchpadProvider = (launchpad as any)?.provider;
                return {
                    source: 'DexScreener',
                    ...dexData,
                    address: dexData.address || resolvedAddress,
                    symbol: dexData.symbol || cachedToken?.symbol || requestedIdentifier.toUpperCase(),
                    name: dexData.name || cachedToken?.name || requestedIdentifier,
                    imageUrl: dexData.imageUrl || cachedToken?.imageUrl,
                    chainId: resolvedChainId, // Ensure numeric chainId
                    launchpad,
                    isLaunchpad: !!launchpad,
                    launchpadProvider,
                    // Normalized aliases (stable fields for prompts/skills)
                    tokenAddress: dexData.address || resolvedAddress,
                    tokenSymbol: dexData.symbol || cachedToken?.symbol,
                    tokenName: dexData.name || cachedToken?.name,
                    priceUsd: dexData.price,
                    liquidityUsd: dexData.liquidity,
                    fdvUsd: dexData.fdv,
                    volume24hUsd: dexData.volume24h,
                    priceChange24hPct: dexData.priceChange24h,
                    poolAddress: dexData.poolAddress
                };
            }

            if (tokenData) {
                const launchpadProvider = (launchpad as any)?.provider;
                return {
                    ...tokenData,
                    address: (tokenData as any).address || resolvedAddress,
                    symbol: (tokenData as any).symbol || cachedToken?.symbol || requestedIdentifier.toUpperCase(),
                    name: (tokenData as any).name || cachedToken?.name || requestedIdentifier,
                    imageUrl: (tokenData as any).imageUrl || cachedToken?.imageUrl,
                    chainId: resolvedChainId, // Ensure numeric chainId
                    launchpad,
                    isLaunchpad: !!launchpad,
                    launchpadProvider,
                    // Normalized aliases where available (best-effort)
                    tokenAddress: (tokenData as any).address || resolvedAddress,
                    tokenSymbol: (tokenData as any).symbol || cachedToken?.symbol,
                    tokenName: (tokenData as any).name || cachedToken?.name,
                    priceUsd: (tokenData as any).price,
                    liquidityUsd: (tokenData as any).liquidity,
                    fdvUsd: (tokenData as any).fdv,
                    volume24hUsd: (tokenData as any).volume24h,
                    priceChange24hPct: (tokenData as any).priceChange24h,
                    poolAddress: (tokenData as any).poolAddress
                };
            }

            if (launchpad) {
                return {
                    address: resolvedAddress,
                    symbol: cachedToken?.symbol || requestedIdentifier.toUpperCase(),
                    name: cachedToken?.name || requestedIdentifier,
                    imageUrl: cachedToken?.imageUrl,
                    chainId: resolvedChainId,
                    launchpad,
                    isLaunchpad: true,
                    launchpadProvider: (launchpad as any)?.provider,
                    source: 'LaunchpadDetector'
                };
            }

            if (cachedToken) {
                return {
                    source: 'KiKoCachedTrendingTokens',
                    address: cachedToken.address,
                    symbol: cachedToken.symbol,
                    name: cachedToken.name,
                    imageUrl: cachedToken.imageUrl,
                    chainId: resolvedChainId,
                    tokenAddress: cachedToken.address,
                    tokenSymbol: cachedToken.symbol,
                    tokenName: cachedToken.name,
                };
            }

            return { error: 'Token not found on GeckoTerminal or DexScreener' };
        } catch (error: any) {
            return { error: error.message || 'Failed to fetch token info' };
        }
    }
};
