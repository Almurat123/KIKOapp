import { Tool } from '../../../tooling/registry.js';
import { chainIdToSlug } from '../../../utils/chainParam.js';
import { markPendingToolContextChainSwitch } from '../../../jobs/chat/toolContextChainState.js';

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
    handler: async (args, context) => {
        const chainId = args.chain_id;
        const chainName = args.chain_name || chainIdToSlug(chainId) || `Chain ${chainId}`;
        let evmWalletAddress = context?.evmWalletAddress || context?.walletAddress || context?.userAddress;
        let solanaWalletAddress = context?.solanaWalletAddress || context?.solanaAddress || context?.userSolanaAddress;

        if (context?.userId) {
            try {
                const { getEmbeddedWalletAddress, getSolanaEmbeddedWalletAddress } = await import('../../../services/privyWallet.js');
                if (chainId === 900 && !solanaWalletAddress) {
                    solanaWalletAddress = (await getSolanaEmbeddedWalletAddress(context.userId)) || solanaWalletAddress;
                }
                if (chainId !== 900 && !evmWalletAddress) {
                    evmWalletAddress = (await getEmbeddedWalletAddress(context.userId)) || evmWalletAddress;
                }
            } catch {
                // Keep the existing context if wallet lookup fails.
            }
        }

        if (context && typeof context === 'object') {
            const nextContext = markPendingToolContextChainSwitch({
                toolContext: context,
                chainId,
                chainName,
                evmWalletAddress,
                solanaWalletAddress,
            });
            for (const key of Object.keys(context)) {
                delete (context as Record<string, any>)[key];
            }
            Object.assign(context, nextContext);

            const taskId = context.__snapshot?.taskId || context.taskId;
            if (taskId) {
                try {
                    const chatRepo = await import('../../../repositories/chatRepository.js');
                    await chatRepo.updateTaskToolContext(taskId, nextContext);
                } catch {
                    // In-memory context is still updated for the current turn.
                }
            }
        }

        return {
            summary: `Requested wallet switch to ${chainName} (Chain ID: ${chainId}). Wait for wallet confirmation before executing trades on that chain.`,
            __client_action: {
                type: 'switch_chain',
                payload: {
                    chainId: chainId,
                    chainName: chainName,
                    taskId: context?.__snapshot?.taskId || context?.taskId,
                }
            }
        };
    }
};
