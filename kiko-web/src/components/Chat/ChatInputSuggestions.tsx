import React from 'react';
import { Command, ArrowRight } from 'lucide-react';
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
}

interface ChatInputSuggestionsProps {
    suggestions: SuggestionItem[];
    isVisible: boolean;
    onSelect: (item: SuggestionItem) => void;
}

export const ChatInputSuggestions: React.FC<ChatInputSuggestionsProps> = ({
    suggestions,
    isVisible,
    onSelect
}) => {
    const { resolvedTheme } = useThemeContext();

    if (!isVisible || suggestions.length === 0) return null;

    return (
        <div
            className={clsx(styles.suggestionBox, styles[resolvedTheme])}
        >
            <div className={styles.suggestionList}>
                {suggestions.map((item) => (
                    <button
                        key={item.id}
                        className={clsx(styles.suggestionItem, item.highlight && styles.suggestionItemHighlight)}
                        onClick={() => onSelect(item)}
                    >
                        <div className={styles.suggestionIconWrapper}>
                            {item.icon || <Command size={16} />}
                        </div>
                        <div className={styles.suggestionContent}>
                            <span className={styles.suggestionLabel}>{item.label}</span>
                            {item.subLabel && (
                                <span className={styles.suggestionSubLabel}>
                                    {item.subLabel.split(/(<em>.*?<\/em>)/g).map((part, i) => {
                                        if (part.startsWith('<em>') && part.endsWith('</em>')) {
                                            return <em key={i}>{part.slice(4, -5)}</em>;
                                        }
                                        return part;
                                    })}
                                </span>
                            )}
                        </div>
                        <div className={styles.suggestionArrow}>
                            <ArrowRight size={14} />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
