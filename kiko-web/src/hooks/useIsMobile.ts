import { useState, useEffect } from 'react';

/**
 * Debounce function for performance optimization
 */
function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Global isMobile hook - uses single resize listener shared across components
 * Replaces per-component resize listeners to reduce memory usage
 */
export function useIsMobile(breakpoint: number = 640): boolean {
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = debounce(() => {
            setIsMobile(window.innerWidth < breakpoint);
        }, 150);

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
}

/**
 * Hook for detecting tablet breakpoint
 */
export function useIsTablet(breakpoint: number = 1024): boolean {
    const [isTablet, setIsTablet] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = debounce(() => {
            setIsTablet(window.innerWidth < breakpoint);
        }, 150);

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isTablet;
}

/**
 * Combined responsive hook for common breakpoints
 */
export function useResponsive() {
    const isMobile = useIsMobile(640);
    const isTablet = useIsTablet(1024);

    return {
        isMobile,
        isTablet,
        isDesktop: !isMobile && !isTablet,
    };
}
