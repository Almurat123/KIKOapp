import { useState, useCallback, useRef, useEffect } from 'react';
import type { SuggestionItem } from './ChatInputSuggestions';
// Use the engine (tsx for icon support)
import { SuggestionEngine, type SuggestionContext } from './SuggestionEngine.tsx';
import { loadFromCache } from '../../services/trendingService';

const HISTORY_KEY = 'kiko-recent-items';

export const useSmartSuggestions = (
    onSend: (text: string) => void,
    onSetInput: (text: string) => void
) => {
    const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 1. Context Gathering (History & Trending)
    const getContext = useCallback((): SuggestionContext => {
        // Load history from localStorage
        let history: string[] = [];
        try {
            history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        } catch (e) {
            console.warn('Failed to parse history from localStorage', e);
        }

        // Load trending from cache (aggregator)
        const chains = ['eth', 'solana', 'base', 'bsc'];
        const trending: { symbol: string; address?: string }[] = [];
        chains.forEach(chain => {
            const cached = loadFromCache(chain);
            if (cached) {
                cached.slice(0, 3).forEach(t => {
                    if (!trending.find(ex => ex.symbol === t.symbol)) {
                        trending.push({ symbol: t.symbol, address: t.address });
                    }
                });
            }
        });

        return { history, trending: trending.slice(0, 10) };
    }, []);

    // 2. Intent Detection with Debounce (100ms)
    const detectIntent = useCallback((text: string) => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        debounceTimerRef.current = setTimeout(() => {
            if (!text || text.trim().length === 0) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            const context = getContext();
            const results = SuggestionEngine.getSuggestions(
                text,
                (t) => {
                    addToHistory(t);
                    onSend(t);
                },
                onSetInput,
                context
            );

            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        }, 100);
    }, [onSend, onSetInput, getContext]);

    // 3. History Management
    const addToHistory = (text: string) => {
        // Simple address/symbol extractor for history
        const addrMatch = text.match(/0x[a-fA-F0-9]{40}/i) || text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
        if (addrMatch) {
            try {
                const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
                const newHistory = [addrMatch[0], ...history.filter((a: string) => a !== addrMatch[0])].slice(0, 10);
                localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            } catch (e) {
                console.warn('Failed to save to history', e);
            }
        }
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        };
    }, []);

    return {
        suggestions,
        showSuggestions,
        setSuggestions,
        setShowSuggestions,
        detectIntent
    };
};
