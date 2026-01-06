import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light' | 'system';

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as Theme) || 'dark';
        }
        return 'dark';
    });

    const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

    useEffect(() => {
        const root = window.document.documentElement;
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const effectiveTheme = theme === 'system' ? systemTheme : theme;

        setResolvedTheme(effectiveTheme);

        root.classList.remove('light', 'dark');
        root.classList.add(effectiveTheme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Listen for system changes if mode is system
    useEffect(() => {
        if (theme !== 'system') return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            const newTheme = mediaQuery.matches ? 'dark' : 'light';
            setResolvedTheme(newTheme);
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add(newTheme);
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    return { theme, setTheme, resolvedTheme };
}
