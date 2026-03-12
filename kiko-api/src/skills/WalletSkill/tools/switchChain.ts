import { Tool } from '../../../tooling/registry.js';
import { chainIdToSlug } from '../../../utils/chainParam.js';

export const SwitchChainTool: Tool = {
    definition: {
        name: 'switch_wallet_chain',
        description: 'Switch KiKo to a different blockchain network context (e.g., from Base to BSC). Use this immediately when an active task requires a different target chain.',
        parameters: {
            type: 'object',
            properties: {
                chain_id: {
                    type: 'number',
                    description: 'The target Chain ID to switch to (e.g., 8453 for Base, 56 for BSC, 1 for Ethereum, 900 for Solana).'
                },
                chain_name: {
                    type: 'string',
                    description: 'The name of the chain to switch to (e.g., "base", "bsc", "ethereum", "solana").'
                }
            },
            required: ['chain_id']
        }
    },
    handler: async (args, _context) => {
        const chainId = args.chain_id;
        const chainName = args.chain_name || chainIdToSlug(chainId) || `Chain ${chainId}`;

        return {
            summary: `Switching KiKo to ${chainName} (Chain ID: ${chainId})...`,
            __client_action: {
                type: 'switch_chain',
                payload: {
                    chainId: chainId,
                    chainName: chainName
                }
            }
        };
    }
};
