import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

export const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useThemeContext();

    const getIcon = () => {
        switch (theme) {
            case 'light': return <Sun size={18} />;
            case 'dark': return <Moon size={18} />;
            case 'system': return <Laptop size={18} />;
        }
    };

    const getLabel = () => {
        switch (theme) {
            case 'light': return 'Light Mode';
            case 'dark': return 'Dark Mode';
            case 'system': return 'System Theme';
        }
    };

    return (
        <button
            className={styles.toggle}
            onClick={toggleTheme}
            aria-label={`Current theme: ${getLabel()}`}
            title={`Theme: ${getLabel()} (Click to cycle)`}
        >
            {getIcon()}
        </button>
    );
};
