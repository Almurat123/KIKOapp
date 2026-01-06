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
        const saved = localStorage.getItem('kiko-theme');
        if (saved === 'light' || saved === 'dark' || saved === 'system') return saved as Theme;
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
        localStorage.setItem('kiko-theme', theme);
        document.documentElement.setAttribute('data-theme', resolvedTheme);
        document.body.classList.toggle('dark', resolvedTheme === 'dark');
        document.body.classList.toggle('light', resolvedTheme === 'light');
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
