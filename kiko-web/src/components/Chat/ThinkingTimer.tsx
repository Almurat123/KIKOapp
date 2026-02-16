import React, { useState, useEffect, useRef } from 'react';
import styles from './Chat.module.css';
import { ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface ThinkingTimerProps {
    startTime: number;
    status?: 'thinking' | 'complete';
    expanded?: boolean;
    onToggle?: () => void;
    className?: string;
    text?: string;
}

export const ThinkingTimer: React.FC<ThinkingTimerProps> = ({
    startTime,
    status = 'thinking',
    expanded = true,
    onToggle,
    className,
    text = 'Thinking'
}) => {
    const [elapsedTenths, setElapsedTenths] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (status === 'complete') {
            // Final calculation
            setElapsedTenths(Math.max(0, Math.floor((Date.now() - startTime) / 100)));
            return;
        }

        const computeTenths = () => Math.max(0, Math.floor((Date.now() - startTime) / 100));
        setElapsedTenths(computeTenths());

        intervalRef.current = setInterval(() => {
            const nextTenths = computeTenths();
            setElapsedTenths(prev => (prev === nextTenths ? prev : nextTenths));
        }, 100);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [startTime, status]);

    const elapsedTime = (elapsedTenths / 10).toFixed(1);

    if (status === 'complete') {
        return (
            <button
                className={clsx(styles.reasoningToggle, styles.reasoningToggleButton, className)}
                onClick={onToggle}
                title={expanded ? 'Collapse thinking' : 'Expand thinking'}
            >
                <span className={styles.reasoningLabel}>
                    {text} ({elapsedTime}s)
                    {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
            </button>
        );
    }

    return (
        <span className={clsx(styles.reasoningLabel, styles.thinking, className)}>
            {text} ({elapsedTime}s)
        </span>
    );
};
