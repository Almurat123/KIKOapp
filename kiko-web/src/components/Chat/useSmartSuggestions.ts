import { useState, useCallback } from 'react';
import type { SuggestionItem } from './ChatInputSuggestions';

export const useSmartSuggestions = (
    onSend: (text: string) => void,
    onSetInput: (text: string) => void
) => {
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const detectIntent = useCallback((text: string) => {
        if (!text || text.trim().length === 0) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const lowerText = text.toLowerCase().trim();
        const newSuggestions: SuggestionItem[] = [];

        // 1. Address Detection (EVM or Solana)
        const evmAddressMatch = text.match(/0x[a-fA-F0-9]{40}/);
        const solanaAddressMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);

        if (evmAddressMatch) {
            const address = evmAddressMatch[0];
            const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

            newSuggestions.push({
                id: 'check-evm',
                label: `Check Token Analysis`,
                subLabel: `Run risk & safety check for ${shortAddr}`,
                action: () => onSend(`Check ${address}`),
                highlight: true
            });
            newSuggestions.push({
                id: 'swap-evm',
                label: `Swap Token`,
                subLabel: `Buy/Sell ${shortAddr}`,
                action: () => onSend(`Swap ${address}`),
            });
            newSuggestions.push({
                id: 'buyers-evm',
                label: `Check Early Buyers`,
                subLabel: `Analyze top holders/snipers for ${shortAddr}`,
                action: () => onSend(`Check early buyers for ${address}`),
            });
        } else if (solanaAddressMatch) {
            const address = solanaAddressMatch[0];
            // Filter out common non-address base58 strings if needed (simplified check logic)
            if (address.length > 30) {
                const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

                newSuggestions.push({
                    id: 'check-sol',
                    label: `Check Solana Token`,
                    subLabel: `Run deep analysis for ${shortAddr}`,
                    action: () => onSend(`Check ${address}`),
                    highlight: true
                });
                newSuggestions.push({
                    id: 'swap-sol',
                    label: `Swap on Solana`,
                    subLabel: `Trade ${shortAddr}`,
                    action: () => onSend(`Swap ${address}`),
                });
                newSuggestions.push({
                    id: 'dev-sol',
                    label: `Check Developer`,
                    subLabel: `Analyze dev wallet history for ${shortAddr}`,
                    action: () => onSend(`Check developer of ${address}`),
                });
            }
        }

        // 2. Keyword Detection
        if (newSuggestions.length === 0) {
            if (lowerText.startsWith('swap')) {
                newSuggestions.push({
                    id: 'swap-generic',
                    label: 'Swap Tokens',
                    subLabel: 'I want to swap [Token] for [Token]',
                    action: () => onSetInput('[SWAP] I want to swap '), // Pre-fill
                });
                newSuggestions.push({
                    id: 'swap-eth-usdc',
                    label: 'Quick Swap: ETH -> USDC',
                    subLabel: 'Swap 0.1 ETH to USDC',
                    action: () => onSend('Swap 0.1 ETH to USDC'),
                });
                newSuggestions.push({
                    id: 'swap-sol-usdc',
                    label: 'Quick Swap: SOL -> USDC',
                    subLabel: 'Swap 1 SOL to USDC',
                    action: () => onSend('Swap 1 SOL to USDC on Solana'),
                });
            } else if (lowerText.startsWith('check') || lowerText.startsWith('analyze')) {
                newSuggestions.push({
                    id: 'check-generic',
                    label: 'Analyze Token',
                    subLabel: 'Paste a contract address to check safety',
                    action: () => onSetInput('Check '), // Pre-fill
                });
                newSuggestions.push({
                    id: 'check-wallet',
                    label: 'Check Wallet',
                    subLabel: 'Analyze a wallet address PnL',
                    action: () => onSetInput('Analyze wallet '),
                });
                newSuggestions.push({
                    id: 'check-trending',
                    label: 'Check Trending Tokens',
                    subLabel: 'See what is hot on Base/Solana',
                    action: () => onSend('What are the trending tokens right now?'),
                });
            } else if (lowerText.startsWith('copy')) {
                newSuggestions.push({
                    id: 'copy-trade',
                    label: 'Copy Trade Setup',
                    subLabel: 'I want to copy trade a wallet',
                    action: () => onSend('I want to copy trade a wallet'),
                });
                newSuggestions.push({
                    id: 'copy-list',
                    label: 'List My Tasks',
                    subLabel: 'Show my active copy trade tasks',
                    action: () => onSend('Show my copy trade tasks'),
                });
            }
        }

        // Limit to 5 suggestions max
        const limitedSuggestions = newSuggestions.slice(0, 5);
        setSuggestions(limitedSuggestions);
        setShowSuggestions(limitedSuggestions.length > 0);
    }, [onSend, onSetInput]);

    return {
        suggestions,
        showSuggestions,
        setSuggestions,     // Export setter in case we need to clear manually
        setShowSuggestions, // Export setter
        detectIntent
    };
};
