import { useState, useEffect } from 'react';

/**
 * Hook to detect page visibility (document.hidden)
 * Returns an object with isVisible boolean
 */
export const usePageVisibility = () => {
    const [isVisible, setIsVisible] = useState(!document.hidden);

    useEffect(() => {
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Return object for destructuring compatibility
    return { isVisible };
};

/**
 * Hook to detect if this browser tab is currently visible/focused
 * Combines document visibility + window focus
 */
export const useTabVisibility = () => {
    const [isTabVisible, setIsTabVisible] = useState(
        !document.hidden && document.hasFocus()
    );

    useEffect(() => {
        const update = () => {
            setIsTabVisible(!document.hidden && document.hasFocus());
        };

        document.addEventListener('visibilitychange', update);
        window.addEventListener('focus', update);
        window.addEventListener('blur', update);

        return () => {
            document.removeEventListener('visibilitychange', update);
            window.removeEventListener('focus', update);
            window.removeEventListener('blur', update);
        };
    }, []);

    return isTabVisible;
};

export default usePageVisibility;
