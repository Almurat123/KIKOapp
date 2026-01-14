import React, { useEffect, useState } from 'react';
import { ArrowRight, CornerDownLeft } from 'lucide-react';
import styles from './Chat.module.css';
import clsx from 'clsx';
import { useThemeContext } from '../../contexts/ThemeContext';

export interface SuggestionItem {
    id: string;
    label: string;
    subLabel?: string;
    icon?: React.ReactNode;
    action: () => void;
    highlight?: boolean;
    matchedIndices?: number[]; // Indices of characters to highlight
    group?: string; // Optional group for flat lists or internal logic
}

export interface SuggestionGroup {
    label: string;
    items: SuggestionItem[];
}

interface ChatInputSuggestionsProps {
    suggestions: SuggestionGroup[] | SuggestionItem[]; // Support both for backward compatibility or transition
    isVisible: boolean;
    onSelect: (item: SuggestionItem) => void;
}

export const ChatInputSuggestions: React.FC<ChatInputSuggestionsProps> = ({
    suggestions,
    isVisible,
    onSelect
}) => {
    const { resolvedTheme } = useThemeContext();
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Flatten items for keyboard navigation
    const flatItems = React.useMemo(() => {
        if (Array.isArray(suggestions) && suggestions.length > 0 && 'items' in suggestions[0]) {
            return (suggestions as SuggestionGroup[]).flatMap(g => g.items);
        }
        return suggestions as SuggestionItem[];
    }, [suggestions]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [suggestions]);

    // Keyboard navigation
    useEffect(() => {
        if (!isVisible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % flatItems.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                // Only capture if suggestions are visible and we have a selection
                if (flatItems[selectedIndex]) {
                    e.preventDefault();
                    onSelect(flatItems[selectedIndex]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, flatItems, selectedIndex, onSelect]);

    if (!isVisible || (Array.isArray(suggestions) && suggestions.length === 0)) return null;

    const renderGroups = () => {
        // Check if we have groups
        const hasGroups = suggestions.length > 0 && 'items' in suggestions[0];

        if (hasGroups) {
            return (suggestions as SuggestionGroup[]).map((group, gIdx) => (
                <div key={group.label || gIdx} className={styles.suggestionGroup}>
                    {group.items.map((item) => renderItem(item))}
                </div>
            ));
        }

        return (suggestions as SuggestionItem[]).map((item) => renderItem(item));
    };

    const renderItem = (item: SuggestionItem) => {
        const isSelected = flatItems[selectedIndex]?.id === item.id;

        return (
            <button
                key={item.id}
                className={clsx(
                    styles.suggestionItem,
                    isSelected && styles.suggestionItemSelected
                )}
                onClick={() => onSelect(item)}
                onMouseEnter={() => {
                    const idx = flatItems.findIndex(i => i.id === item.id);
                    if (idx !== -1) setSelectedIndex(idx);
                }}
            >
                <div className={styles.suggestionContent}>
                    {(() => {
                        // 1. Special rendering for Progressive Paste Prompt
                        if (item.label.includes('[Paste Contract Address]')) {
                            const parts = item.label.split('[Paste Contract Address]');
                            return (
                                <>
                                    <span className={styles.suggestionLabel}>
                                        {parts[0]}
                                        <span style={{ opacity: 0.5, fontStyle: 'italic' }}>[Paste Contract Address]</span>
                                        {parts[1]}
                                    </span>
                                </>
                            );
                        }

                        // 2. Standard Logic (Highlighting or Plain)
                        if (!item.matchedIndices || item.matchedIndices.length === 0) {
                            return (
                                <>
                                    <span className={styles.suggestionLabel}>{item.label}</span>
                                    {item.subLabel && (
                                        <span className={styles.suggestionSubLabel}>{item.subLabel}</span>
                                    )}
                                </>
                            );
                        }

                        // 3. Matched Indices Logic
                        const elements: React.ReactNode[] = [];
                        const sorted = [...item.matchedIndices].sort((a, b) => a - b);
                        let lastIdx = 0;

                        sorted.forEach((idx, i) => {
                            if (idx >= item.label.length) return;
                            if (idx > lastIdx) elements.push(item.label.slice(lastIdx, idx));

                            elements.push(
                                <span key={i} style={{ color: 'var(--accent-primary, #6366f1)', fontWeight: 700 }}>
                                    {item.label[idx]}
                                </span>
                            );
                            lastIdx = idx + 1;
                        });

                        if (lastIdx < item.label.length) elements.push(item.label.slice(lastIdx));

                        return (
                            <>
                                <span className={styles.suggestionLabel}>{elements}</span>
                                {item.subLabel && (
                                    <span className={styles.suggestionSubLabel}>{item.subLabel}</span>
                                )}
                            </>
                        );
                    })()}
                </div>
                <div className={styles.suggestionArrow}>
                    {isSelected ? <CornerDownLeft size={14} /> : <ArrowRight size={14} />}
                </div>
            </button>
        );
    };

    return (
        <div
            className={clsx(styles.suggestionBox, styles[resolvedTheme])}
        >
            <div className={styles.suggestionList}>
                {renderGroups()}
            </div>
        </div>
    );
};
