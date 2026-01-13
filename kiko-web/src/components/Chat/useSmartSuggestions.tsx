import { useState, useCallback, useRef, useEffect } from 'react';
import type { SuggestionGroup, SuggestionItem } from './ChatInputSuggestions';
import { SuggestionEngine } from './SuggestionEngine';
import { ParamMemory } from './CommandRegistry';

const HISTORY_KEY = 'kiko-recent-items';

export const useSmartSuggestions = (
    _onSend: (text: string) => void,
    onSetInput: (text: string) => void
) => {
    // UI State
    const [suggestions, setSuggestions] = useState<SuggestionGroup[] | SuggestionItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Engine State
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleCommit = useCallback((committedText: string) => {
        // 1. Save parameters from the committed command
        ParamMemory.extractAndSave(committedText);

        // 2. Save to history
        addToHistory(committedText);

        // 3. Update input
        onSetInput(committedText);

        // 4. Hide suggestions
        setShowSuggestions(false);
    }, [onSetInput]);

    // Intent Detection
    const detectIntent = useCallback((text: string) => {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        debounceTimerRef.current = setTimeout(() => {
            if (!text || text.trim().length === 0) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            const results = SuggestionEngine.getSuggestions(text, handleCommit);

            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        }, 50); // Fast response (50ms)
    }, [handleCommit]);

    const openSuggestions = useCallback(() => {
        const results = SuggestionEngine.getSuggestions('', handleCommit, { mode: 'focus' });
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
    }, [handleCommit]);

    // History Management
    const addToHistory = (text: string) => {
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

    // Cleanup
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
        detectIntent,
        openSuggestions
    };
};
