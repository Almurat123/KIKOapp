import React, { useEffect, useMemo, useRef } from 'react';
import { useStrategies, type TradingStrategy } from '../../hooks/useStrategies';
import { extractStrategiesFromMessages } from '../../utils/strategyExtractor';
import type { Message } from '../../hooks/useConversations';

export interface ChatStrategyRuntimeState {
    strategies: TradingStrategy[];
    refreshUserStrategies?: () => Promise<void>;
    deleteStrategy?: (id: string) => Promise<void>;
    toggleStrategyStatus?: (id: string) => Promise<void>;
}

interface ChatStrategyRuntimeProps {
    messages: Message[];
    conversationId: string | null;
    onStateChange: (state: ChatStrategyRuntimeState) => void;
}

// CONTEXT MEMORY
// Updated: 2026-04-10
// Author: Rowan
// Reason: Chat homepage should not eagerly load the full strategy runtime or
//         trigger copy-trade reads before the user has actually entered chat flow.
// Goal: keep strategy syncing available once chat is active, while deferring the
//       heavy strategy owner layer out of the initial homepage render path.
// Owns: bridging chat messages into the shared strategy owner and exposing
//       strategy card actions back to ChatInterface after lazy mount.
// Does Not Own: strategy persistence semantics, copy-trade API policies, or
//       chat message rendering.
// Design Language:
// - strategy runtime should mount only after chat flow becomes active
// - extracted strategy cards must still reconcile against the shared strategy owner
// - forbidden local patch patterns: calling useStrategies directly in the homepage shell
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-chat-home-route-eager-entry.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-chat-home-deferred-runtime.md

export const ChatStrategyRuntime: React.FC<ChatStrategyRuntimeProps> = ({
    messages,
    conversationId,
    onStateChange,
}) => {
    const { strategies, refreshUserStrategies, deleteStrategy, toggleStrategyStatus, createStrategy } = useStrategies();
    const processedStrategyIdsRef = useRef<Set<string>>(new Set());

    const runtimeState = useMemo<ChatStrategyRuntimeState>(() => ({
        strategies,
        refreshUserStrategies,
        deleteStrategy,
        toggleStrategyStatus,
    }), [strategies, refreshUserStrategies, deleteStrategy, toggleStrategyStatus]);

    useEffect(() => {
        onStateChange(runtimeState);
        return () => {
            onStateChange({
                strategies: [],
                refreshUserStrategies: undefined,
                deleteStrategy: undefined,
                toggleStrategyStatus: undefined,
            });
        };
    }, [onStateChange, runtimeState]);

    useEffect(() => {
        if (messages.length === 0 || !conversationId) return;

        const extractedStrategies = extractStrategiesFromMessages(messages, conversationId);

        extractedStrategies.forEach((strategy) => {
            const strategyKey = `${conversationId}-${strategy.name}-${strategy.type}`;
            if (processedStrategyIdsRef.current.has(strategyKey)) {
                return;
            }

            const exists = strategies.some(
                (s) => s.name === strategy.name &&
                    s.type === strategy.type &&
                    s.conversationId === conversationId
            );

            if (!exists) {
                createStrategy(strategy);
            }
            processedStrategyIdsRef.current.add(strategyKey);
        });
    }, [messages, conversationId, createStrategy, strategies]);

    return null;
};

