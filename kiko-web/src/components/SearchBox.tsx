import React from 'react';
import { Search } from 'lucide-react';
import styles from './SearchBox.module.css';

interface SearchBoxProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const SearchBox: React.FC<SearchBoxProps> = ({
    value,
    onChange,
    placeholder = 'Search...',
    className
}) => {
    return (
        <div className={`${styles.container} ${className || ''}`}>
            <Search size={16} className={styles.icon} />
            <input
                type="text"
                className={styles.input}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </div>
    );
};
