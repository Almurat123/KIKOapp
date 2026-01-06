import { Tool } from './registry.js';
import * as etherscan from '../services/etherscan.js';
import * as infuraGas from '../services/infuraGas.js';

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
                }
            }
        }
    },
    handler: async (args) => {
        try {
            const chain = args.chain || 'eth';
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

            if (!gasData) {
                return { error: `Failed to fetch gas price for ${chain}.` };
            }

            return {
                source: 'Etherscan/Blockscan',
                chain: chain,
                safe: `${gasData.safeGasPrice} Gwei`,
                standard: `${gasData.proposeGasPrice} Gwei`,
                fast: `${gasData.fastGasPrice} Gwei`,
                baseFee: `${gasData.suggestBaseFee} Gwei`
            };
        } catch (error: any) {
            console.error('[GetGasPrice] Error:', error);
            return { error: 'Failed to fetch gas price' };
        }
    }
};
