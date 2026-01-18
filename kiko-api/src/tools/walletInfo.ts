import { Tool } from './registry.js';
import * as alchemy from '../services/alchemy.js';
import * as quicknode from '../services/quicknode.js';
import * as coinbaseCdp from '../services/coinbaseCdp.js';

export const GetWalletInfoTool: Tool = {
    definition: {
        name: 'get_wallet_info',
        description: 'Get wallet information including ETH balance, token holdings, and recent transaction history. Can check the user\'s connected wallet or any specific address.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The wallet address to check. If not provided, will try to use the connected user\'s address if authentication context exists.',
                },
                chain: {
                    type: 'string',
                    description: 'Blockchain network (eth, base, arbitrum, optimism, polygon, bsc). If not specified, defaults to the user\'s currently connected chain.',
                },
                includeHistory: {
                    type: 'boolean',
                    description: 'Whether to include recent transaction history. Default is false (balances only).',
                    default: false
                }
            }
        }
    },
    handler: async (args, context) => {
        try {
            // Determine address to check
            let targetAddress = args.address;

            // If no address provided, try to get from context (user's connected wallet)
            if (!targetAddress && context?.userAddress) {
                targetAddress = context.userAddress;
            }

            if (!targetAddress) {
                return { error: 'No wallet address provided and no connected wallet found.' };
            }

            // Map chainId to name if available
            let contextChain = 'eth';
            if (context?.chainId) {
                const chainMap: Record<number, string> = {
                    1: 'eth',
                    8453: 'base',
                    56: 'bsc',
                    42161: 'arbitrum',
                    10: 'optimism',
                    137: 'polygon',
                    900: 'solana',
                    43114: 'avalanche',
                    250: 'fantom',
                };
                contextChain = chainMap[context.chainId] || 'eth';
            }

            const chain = args.chain || contextChain;
            if ((chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol') && context?.solanaAddress) {
                if (!targetAddress || targetAddress.startsWith('0x')) {
                    targetAddress = context.solanaAddress;
                }
            }

            // Fallback Logic: Alchemy -> QuickNode
            let balanceData;

            try {
                // 1. Try Alchemy
                console.log('[GetWalletInfo] Attempting Alchemy...');
                balanceData = await alchemy.getWalletBalance(targetAddress, chain);
            } catch (alchemyError) {
                console.warn('[GetWalletInfo] Alchemy failed, trying fallback...', alchemyError);

                // 2. Try QuickNode (Only supports ETH/Mainnet well with single URL config, but let's try)
                if (quicknode.isQuickNodeConfigured()) {
                    console.log('[GetWalletInfo] Attempting QuickNode...');

                    // Fetch Token Balances
                    const qnTokens = await quicknode.getWalletTokenBalances(targetAddress, chain);

                    // Fetch Native Balance (ETH/MATIC/BNB)
                    // Note: QuickNode endpoint in env might be chain specific.
                    // If it points to ETH Mainnet, this only works for ETH. 
                    // This is a known limitation of single-key fallback for multi-chain without dynamic endpoints.
                    const nativeBalanceHex = await quicknode.getNativeBalance(targetAddress, chain);

                    const isSolana = chain.toLowerCase() === 'solana' || chain.toLowerCase() === 'sol';
                    const nativeDecimals = isSolana ? 1e9 : 1e18;
                    const nativeBalanceWei = BigInt(nativeBalanceHex);
                    const nativeBalanceFormatted = Number(nativeBalanceWei) / nativeDecimals;

                    // Transformation is done in two steps to satisfy type checker
                    const rawTokens = qnTokens.map(t => ({
                        symbol: t.symbol,
                        tokenBalance: t.totalBalance,
                        contractAddress: t.address,
                        decimals: parseInt(t.decimals),
                    }));

                    // Format balances
                    balanceData = {
                        ethBalance: nativeBalanceHex,
                        ethBalanceFormatted: nativeBalanceFormatted,
                        tokens: rawTokens.map(t => {
                            const raw = BigInt(t.tokenBalance);
                            const div = BigInt(10 ** (t.decimals || 18));
                            const whole = raw / div;
                            const rem = raw % div;
                            return {
                                symbol: t.symbol,
                                tokenBalance: `${whole}.${rem.toString().padStart(t.decimals || 18, '0')}`,
                                contractAddress: t.contractAddress
                            };
                        })
                    };

                } else {
                    throw alchemyError; // No fallback available
                }
            }

            // If we still have no data (and no error thrown above), use what we have or empty
            if (!balanceData) throw new Error("All data sources failed.");

            const result: any = {
                address: targetAddress,
                chain: chain,
                // Use Alchemy data primarily
                ethBalance: balanceData.ethBalance ? `${balanceData.ethBalanceFormatted.toFixed(4)} ${chain.toUpperCase() === 'ETH' ? 'ETH' : 'Native Token'}` : '0.0000 ETH',
                tokens: balanceData.tokens.map((t: any) => ({
                    symbol: t.symbol,
                    balance: t.balance || t.tokenBalance, // Handle both formats
                    contract: t.contract || t.contractAddress,
                    valueUsd: t.valueUsd ?? (() => {
                        const balance = parseFloat(t.balance || t.tokenBalance || '0');
                        return t.price ? balance * t.price : undefined;
                    })()
                }))
            };

            const nativePriceUsd = balanceData.ethPrice ?? null;
            const nativeValueUsd = nativePriceUsd
                ? balanceData.ethBalanceFormatted * nativePriceUsd
                : null;
            const tokenValueSum = result.tokens.reduce((sum: number, token: any) => {
                return sum + (token.valueUsd ?? 0);
            }, 0);
            result.nativePriceUsd = nativePriceUsd;
            result.nativeValueUsd = nativeValueUsd;
            result.totalValueUsd = (nativeValueUsd ?? 0) + tokenValueSum;

            // Fetch history if requested
            if (args.includeHistory) {
                const history = await alchemy.getWalletTransactions(targetAddress, chain, 10);
                result.recentTransactions = history.map(tx => ({
                    type: tx.txType,
                    hash: tx.txHash,
                    token: tx.tokenSymbol || 'ETH',
                    amount: tx.amount,
                    time: tx.blockTimestamp.toISOString()
                }));
            }

            return result;

        } catch (error: any) {
            console.error('[GetWalletInfo] Error:', error);
            return { error: `Failed to fetch wallet info: ${error.message}` };
        }
    }
};
