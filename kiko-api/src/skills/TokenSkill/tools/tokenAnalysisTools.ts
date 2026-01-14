import { Tool } from '../../../tools/registry.js';
import * as tokenAnalysis from '../../../services/tokenAnalysis.js';
import * as creatorAnalysis from '../../../services/creatorAnalysis.js';

/**
 * Tool to get early buyers of a token
 */
export const GetEarlyBuyersTool: Tool = {
    definition: {
        name: 'get_early_buyers',
        description: 'Get the earliest buyers of a token. Useful for analyzing who bought first and potential insider/whale activity. Works on EVM chains and Solana.',
        parameters: {
            type: 'object',
            properties: {
                address: {
                    type: 'string',
                    description: 'The token contract address'
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain (eth, base, bsc, solana, arbitrum, polygon, optimism)',
                    enum: ['eth', 'base', 'bsc', 'solana', 'arbitrum', 'polygon', 'optimism']
                },
                limit: {
                    type: 'number',
                    description: 'Number of early buyers to return (default 10, max 20)',
                    default: 10
                }
            },
            required: ['address', 'chain']
        }
    },
    handler: async ({ address, chain, limit = 10 }) => {
        try {
            const buyers = await tokenAnalysis.getEarlyBuyers(address, chain, Math.min(limit, 20));

            if (!buyers || buyers.length === 0) {
                return {
                    success: false,
                    message: `No early buyers found for ${address} on ${chain}. Token may be too new or not have trading activity yet.`
                };
            }

            return {
                success: true,
                token: address,
                chain,
                buyerCount: buyers.length,
                earlyBuyers: buyers.map((b, i) => ({
                    rank: i + 1,
                    address: b.address,
                    timestamp: b.timestamp?.toISOString(),
                    amount: b.amount,
                    txHash: b.txHash,
                    isSmart: b.isSmart
                }))
            };
        } catch (error: any) {
            console.error('[GetEarlyBuyers] Error:', error);
            return { success: false, error: error.message || 'Failed to fetch early buyers' };
        }
    }
};

/**
 * Tool to analyze the creator/deployer of a token
 */
export const AnalyzeCreatorTool: Tool = {
    definition: {
        name: 'analyze_creator',
        description: 'Analyze the creator/deployer of a token for risk signals. Checks wallet age, transaction history, mixer funding, and generates a risk profile.',
        parameters: {
            type: 'object',
            properties: {
                creatorAddress: {
                    type: 'string',
                    description: 'The wallet address of the token creator/deployer'
                },
                chain: {
                    type: 'string',
                    description: 'The blockchain (eth, base, bsc, arbitrum, polygon, optimism)',
                    enum: ['eth', 'base', 'bsc', 'arbitrum', 'polygon', 'optimism']
                }
            },
            required: ['creatorAddress', 'chain']
        }
    },
    handler: async ({ creatorAddress, chain }) => {
        try {
            const profile = await creatorAnalysis.analyzeDeployer(creatorAddress, chain);

            if (!profile) {
                return {
                    success: false,
                    message: 'Could not analyze creator address. May be invalid or null address.'
                };
            }

            return {
                success: true,
                creatorAddress: profile.address,
                chain,
                riskLevel: profile.riskLevel,
                riskScore: profile.riskScore,
                tags: profile.tags,
                details: {
                    transactionCount: profile.details.txCount,
                    firstTransactionDate: profile.details.firstTxDate,
                    isMixerFunded: profile.details.isMixerFunded,
                    balance: profile.details.deployerBalance
                }
            };
        } catch (error: any) {
            console.error('[AnalyzeCreator] Error:', error);
            return { success: false, error: error.message || 'Failed to analyze creator' };
        }
    }
};
