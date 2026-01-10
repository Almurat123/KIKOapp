/**
 * Safari iOS 26 Keyboard Fix Hook
 * 
 * iOS 26 / Safari 26 doesn't resize viewport when keyboard opens.
 * Instead, it overlays the keyboard. This hook uses the visualViewport API
 * to detect keyboard presence and calculate proper positioning.
 * 
 * Key approach: Use TOP positioning with transform instead of BOTTOM.
 * When keyboard opens, set top = visualViewport.height, then translateY(-100%)
 * to position the input just above the keyboard.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface SafariKeyboardState {
    isKeyboardVisible: boolean;
    inputTop: number | null; // Top position to use when keyboard is open
    viewportHeight: number;
}

export function useSafariKeyboardFix(): SafariKeyboardState {
    const [state, setState] = useState<SafariKeyboardState>({
        isKeyboardVisible: false,
        inputTop: null,
        viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    });

    const initialHeight = useRef<number | null>(null);
    const isIOS = useRef<boolean>(false);

    const updatePosition = useCallback(() => {
        if (!window.visualViewport) return;

        const vv = window.visualViewport;
        const currentHeight = vv.height;
        const offsetTop = vv.offsetTop || 0;

        // Initialize reference height on first call
        if (initialHeight.current === null) {
            initialHeight.current = currentHeight;
        }

        // Keyboard is visible if viewport shrunk by more than 150px
        const heightDiff = initialHeight.current - currentHeight;
        const isKeyboardVisible = heightDiff > 150;

        // Calculate top position: visible viewport height + scroll offset
        // This gives us the bottom of the visible area
        const inputTop = isKeyboardVisible ? currentHeight + offsetTop : null;

        setState({
            isKeyboardVisible,
            inputTop,
            viewportHeight: currentHeight,
        });
    }, []);

    useEffect(() => {
        // Detect iOS Safari
        if (typeof window === 'undefined') return;

        const ua = window.navigator.userAgent;
        isIOS.current = /iPad|iPhone|iPod/.test(ua) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // Only apply on iOS Safari with visualViewport support
        if (!isIOS.current || !window.visualViewport) {
            return;
        }

        // Store initial viewport height
        initialHeight.current = window.visualViewport.height;

        // Listen to visualViewport resize (keyboard open/close)
        window.visualViewport.addEventListener('resize', updatePosition);
        window.visualViewport.addEventListener('scroll', updatePosition);

        // Initial check
        updatePosition();

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', updatePosition);
                window.visualViewport.removeEventListener('scroll', updatePosition);
            }
        };
    }, [updatePosition]);

    return state;
}

export default useSafariKeyboardFix;
