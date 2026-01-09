import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: 'light' | 'dark';
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        try {
            const saved = localStorage.getItem('kiko-theme');
            if (saved === 'light' || saved === 'dark' || saved === 'system') return saved as Theme;
        } catch (e) {
            console.warn('[ThemeContext] Failed to access localStorage:', e);
        }
        return 'system'; // Default to system
    });

    const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('dark'); // Default fallback

    // Listen to system preference
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

        const handler = (e: MediaQueryListEvent) => {
            setSystemTheme(e.matches ? 'dark' : 'light');
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    const resolvedTheme = theme === 'system' ? systemTheme : theme;

    useEffect(() => {
        try {
            localStorage.setItem('kiko-theme', theme);
        } catch (e) {
            // Silently fail or log in dev
        }
        const root = document.documentElement;

        // Update data-theme attribute
        root.setAttribute('data-theme', resolvedTheme);

        // Update classList for Tailwind/CSS selectors
        root.classList.remove('light', 'dark');
        root.classList.add(resolvedTheme);

        // Also sync body for safety/legacy styles
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(resolvedTheme);

    }, [theme, resolvedTheme]);

    const toggleTheme = () => {
        // Cycle: system -> light -> dark -> system
        setTheme(prev => {
            if (prev === 'system') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    };

    return (
        <ThemeContext.Provider value={{
            theme,
            resolvedTheme,
            setTheme,
            toggleTheme,
            isDark: resolvedTheme === 'dark'
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const useThemeContext = useTheme;

export default ThemeContext;
