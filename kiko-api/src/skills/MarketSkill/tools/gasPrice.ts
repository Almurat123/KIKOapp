import { Tool } from '../../../tooling/registry.js';
import * as etherscan from '../../../services/etherscan.js';
import * as infuraGas from '../../../services/infuraGas.js';
import { chainSlugToId, resolveChainInput } from '../../../utils/chainParam.js';

export const GetGasPriceTool: Tool = {
    definition: {
        name: 'get_gas_price',
        description: 'Get real-time gas prices and transaction fees for a blockchain network. Use this tool when the user asks about "how much is gas", "transaction cost", "gwei", or "fee" for ETH, BSC, Polygon, etc. Returns Safe, Propose, and Fast gas prices.',
        parameters: {
            type: 'object',
            properties: {
                chain: {
                    type: 'string',
                    description: 'Blockchain network (eth, bsc, polygon, arbitrum, optimism, base, avalanche). Default is eth.',
                    default: 'eth'
                },
                chain_id: {
                    type: 'number',
                    description: 'Numeric chain ID (preferred when available), e.g. 1, 8453, 56.',
                }
            }
        }
    },
    handler: async (args, context) => {
        try {
            const resolved = resolveChainInput(args, {
                contextChainId: context?.chainId,
                defaultChain: 'eth',
            });
            if (resolved.invalidChainId) {
                return { error: `Unsupported chain_id: ${String(args.chain_id)}` };
            }
            const chain = resolved.chain;
            console.log(`[GetGasPrice] Fetching gas price for ${chain}...`);

            // 1. Try Infura Gas API first (if configured)
            if (infuraGas.isInfuraConfigured()) {
                const infuraData = await infuraGas.getInfuraGasFees(chain);
                if (infuraData) {
                    console.log(`[GetGasPrice] Using Infura data for ${chain}`);
                    return {
                        source: 'Infura Gas API',
                        chain: chain,
                        baseFee: `${parseFloat(infuraData.estimatedBaseFee).toFixed(2)} Gwei`,
                        low: {
                            maxFee: `${parseFloat(infuraData.low.suggestedMaxFeePerGas).toFixed(2)} Gwei`,
                            priorityFee: `${parseFloat(infuraData.low.suggestedMaxPriorityFeePerGas).toFixed(2)} Gwei`,
                            point: 'Slow 🐢'
                        },
                        medium: {
                            maxFee: `${parseFloat(infuraData.medium.suggestedMaxFeePerGas).toFixed(2)} Gwei`,
                            priorityFee: `${parseFloat(infuraData.medium.suggestedMaxPriorityFeePerGas).toFixed(2)} Gwei`,
                            point: 'Market 🚗'
                        },
                        high: {
                            maxFee: `${parseFloat(infuraData.high.suggestedMaxFeePerGas).toFixed(2)} Gwei`,
                            priorityFee: `${parseFloat(infuraData.high.suggestedMaxPriorityFeePerGas).toFixed(2)} Gwei`,
                            point: 'Fast 🚀'
                        },
                        networkCongestion: `${(infuraData.networkCongestion * 100).toFixed(2)}%`,
                    };
                }
            }

            // 2. Fallback to Etherscan/Blockscan
            console.log(`[GetGasPrice] Falling back to Etherscan/Blockscan for ${chain}`);
            const gasData = await etherscan.getGasPrice(chain);

            if (gasData) {
                return {
                    source: 'Etherscan/Blockscan',
                    chain: chain,
                    safe: `${gasData.safeGasPrice} Gwei`,
                    standard: `${gasData.proposeGasPrice} Gwei`,
                    fast: `${gasData.fastGasPrice} Gwei`,
                    baseFee: `${gasData.suggestBaseFee} Gwei`
                };
            }

            // 3. Fallback to RPC
            console.log(`[GetGasPrice] Etherscan failed, trying RPC fallback for ${chain}`);
            try {
                const { getGasPrice } = await import('../../../services/rpcManager.js');
                const chainId = chainSlugToId(chain);
                if (!chainId) {
                    throw new Error(`Unsupported chain for RPC fallback: ${chain}`);
                }
                const gasPriceWei = await getGasPrice(chainId);
                const gasPriceGwei = (parseInt(gasPriceWei) / 1e9).toFixed(2);

                return {
                    source: 'Public RPC',
                    chain: chain,
                    standard: `${gasPriceGwei} Gwei`,
                    note: 'Estimated from current network gas price.'
                };
            } catch (rpcError: any) {
                console.error('[GetGasPrice] RPC fallback failed:', rpcError.message);

                // 4. Final Fallback (Hardcoded estimation to prevent tool failure)
                console.log(`[GetGasPrice] Using hardcoded fallback for ${chain}`);
                return {
                    source: 'Estimation (Fallback)',
                    chain: chain,
                    standard: '20.00 Gwei',
                    note: 'Could not fetch real-time data. This is a conservative estimate.'
                };
            }

        } catch (error: any) {
            console.error('[GetGasPrice] Error:', error);
            // Even in outer catch, return something safe
            return {
                source: 'Emergency Fallback',
                chain: resolveChainInput(args, { contextChainId: context?.chainId, defaultChain: 'eth' }).chain,
                standard: 'Unknown',
                error: 'Service temporarily unavailable'
            };
        }
    }
};
