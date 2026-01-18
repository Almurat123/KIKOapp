import { useState, useCallback, useRef, useEffect } from 'react';
import type { SuggestionGroup, SuggestionItem } from './ChatInputSuggestions';
import { SuggestionEngine } from './SuggestionEngine';
import { ParamMemory } from './CommandRegistry';

const HISTORY_KEY = 'kiko-recent-items';

export const useSmartSuggestions = (
    _onSend: (text: string) => void,
    onSetInput: (text: string) => void,
    chainId?: number
) => {
    // UI State
    const [suggestions, setSuggestions] = useState<SuggestionGroup[] | SuggestionItem[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Engine State
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleCommit = useCallback((committedText: string) => {
        console.log('[useSmartSuggestions] handleCommit called with:', committedText);

        // 1. Save parameters from the committed command
        ParamMemory.extractAndSave(committedText);

        // 2. Save to history
        addToHistory(committedText);

        // 3. Update input
        onSetInput(committedText);

        // 4. DIRECTLY trigger next suggestions after a small delay
        // (bypassing useEffect which isn't firing reliably)
        console.log('[useSmartSuggestions] Scheduling direct detectIntent for:', committedText);
        setTimeout(() => {
            console.log('[useSmartSuggestions] Direct detectIntent firing for:', committedText);
            if (!committedText || committedText.trim().length === 0) {
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }
            // Re-fetch suggestions for the new input
            const results = SuggestionEngine.getSuggestions(committedText, handleCommit, { chainId });
            console.log('[useSmartSuggestions] Direct got results:', results);
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
        }, 100);
    }, [onSetInput]);

    // Intent Detection
    const detectIntent = useCallback((text: string) => {
        console.log('[useSmartSuggestions] detectIntent called with:', text);

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        debounceTimerRef.current = setTimeout(() => {
            console.log('[useSmartSuggestions] Debounce timeout fired for:', text);

            if (!text || text.trim().length === 0) {
                console.log('[useSmartSuggestions] Empty text, clearing suggestions');
                setSuggestions([]);
                setShowSuggestions(false);
                return;
            }

            const results = SuggestionEngine.getSuggestions(text, handleCommit, { chainId });
            console.log('[useSmartSuggestions] Got results:', results);

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

    const closeSuggestions = useCallback(() => {
        setShowSuggestions(false);
    }, []);

    return {
        suggestions,
        showSuggestions,
        setSuggestions,
        setShowSuggestions,
        detectIntent,
        openSuggestions,
        closeSuggestions
    };
};
