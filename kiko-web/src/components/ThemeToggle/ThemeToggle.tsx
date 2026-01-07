import React, { useMemo } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

export const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useThemeContext();

    const { icon, label } = useMemo(() => {
        switch (theme) {
            case 'light':
                return { icon: <Sun size={18} />, label: 'Light Mode' };
            case 'dark':
                return { icon: <Moon size={18} />, label: 'Dark Mode' };
            case 'system':
                return { icon: <Laptop size={18} />, label: 'System Theme' };
            default:
                // TypeScript exhaustive check - should never reach here
                return { icon: <Laptop size={18} />, label: 'System Theme' };
        }
    }, [theme]);

    return (
        <button
            className={styles.toggle}
            onClick={toggleTheme}
            aria-label={`Current theme: ${label}`}
            title={`Theme: ${label} (Click to cycle)`}
        >
            {icon}
        </button>
    );
};
