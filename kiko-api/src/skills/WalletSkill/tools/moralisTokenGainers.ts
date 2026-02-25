import { Tool } from '../../../tooling/registry.js';
import { resolveChainInput } from '../../../utils/chainParam.js';
import { getTokenTopProfitableWallets } from '../../../services/moralisService.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';

function parseOptionalDays(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = Math.trunc(Number(value));
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return Math.min(3650, parsed);
}

/**
 * Moralis Token Gainers Tool
 * Returns top profitable wallets for a token.
 */
export const GetTokenTopGainersTool: Tool = {
    definition: {
        name: 'get_token_top_gainers',
        description: 'Get top profitable wallets (gainers) for a token using Moralis token profitability data. Useful for smart-wallet discovery and winner analysis.',
        parameters: {
            type: 'object',
            properties: {
                token_address: {
                    type: 'string',
                    description: 'ERC20 token contract address (0x...).'
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (eth, base, bsc, polygon, arbitrum, optimism, fantom, avalanche).'
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56.'
                },
                days: {
                    type: 'number',
                    description: 'Optional lookback window in days. If no data for that window, tool can fall back to all-time.'
                },
                limit: {
                    type: 'number',
                    description: 'Number of addresses to return (default 50, max 100).',
                    default: 50
                }
            },
            required: ['token_address']
        }
    },
    handler: async ({ token_address, chain, chain_id, days, limit }, context) => {
        try {
            const tokenAddress = String(token_address || '').trim();
            if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
                return { success: false, error: `Invalid token address: ${tokenAddress}` };
            }

            const resolved = resolveChainInput({ chain, chain_id }, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (resolved.invalidChainId) {
                return { success: false, error: `Unsupported chain_id: ${String(chain_id)}` };
            }

            const parsedDays = parseOptionalDays(days);
            const parsedLimit = Math.max(1, Math.min(100, Math.trunc(Number(limit ?? 50) || 50)));

            logger.info(LogCode.AI_TOOL_USED, 'Fetching token top gainers via Moralis', {
                tokenAddress: tokenAddress.toLowerCase(),
                chain: resolved.chain,
                days: parsedDays,
                limit: parsedLimit
            });

            const result = await getTokenTopProfitableWallets(tokenAddress, resolved.chain, {
                days: parsedDays,
                limit: parsedLimit,
                fallbackToAllTime: true,
            });

            if (!result) {
                return {
                    success: false,
                    error: `No Moralis top-gainers result for ${tokenAddress} on ${resolved.chain}.`
                };
            }

            return {
                success: true,
                token: {
                    address: result.tokenAddress,
                    symbol: result.tokenSymbol,
                    name: result.tokenName,
                    decimals: result.tokenDecimals,
                    logo: result.tokenLogo,
                    possibleSpam: result.possibleSpam,
                },
                chain: result.chain,
                chainId: result.chainId,
                requestedDays: result.requestedDays,
                appliedDays: result.appliedDays,
                usedAllTimeFallback: result.usedAllTimeFallback,
                walletCount: result.wallets.length,
                topGainers: result.wallets.map((wallet, index) => ({
                    rank: index + 1,
                    address: wallet.address,
                    realizedProfitUsd: wallet.realizedProfitUsd,
                    realizedProfitPercentage: wallet.realizedProfitPercentage,
                    countOfTrades: wallet.countOfTrades,
                    totalUsdInvested: wallet.totalUsdInvested,
                    totalSoldUsd: wallet.totalSoldUsd,
                    avgBuyPriceUsd: wallet.avgBuyPriceUsd,
                    avgSellPriceUsd: wallet.avgSellPriceUsd,
                    totalTokensBought: wallet.totalTokensBought,
                    totalTokensSold: wallet.totalTokensSold,
                }))
            };
        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'GetTokenTopGainersTool error', {
                error: error?.message || String(error)
            });
            return { success: false, error: `Failed to fetch token top gainers: ${error?.message || 'unknown error'}` };
        }
    }
};

