/**
 * Safari iOS 26 Keyboard Fix Hook (Improved Version)
 * 
 * iOS 26 / Safari 26 doesn't resize viewport when keyboard opens.
 * Instead, it overlays the keyboard. This hook uses the visualViewport API
 * to detect keyboard presence and calculate proper positioning.
 * 
 * IMPROVEMENTS:
 * - Use window.innerHeight as stable reference instead of initial viewport
 * - Add debouncing to prevent flickering
 * - Reset reference when keyboard closes completely
 * - Check if input is focused to confirm keyboard state
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface SafariKeyboardState {
    isKeyboardVisible: boolean;
    inputTop: number | null;
    keyboardHeight: number;
}

export function useSafariKeyboardFix(): SafariKeyboardState {
    const [state, setState] = useState<SafariKeyboardState>({
        isKeyboardVisible: false,
        inputTop: null,
        keyboardHeight: 0,
    });

    const isIOS = useRef<boolean>(false);
    const rafId = useRef<number | null>(null);
    const lastUpdate = useRef<number>(0);

    const updatePosition = useCallback(() => {
        // Cancel any pending RAF to avoid stacking
        if (rafId.current) {
            cancelAnimationFrame(rafId.current);
        }

        rafId.current = requestAnimationFrame(() => {
            if (!window.visualViewport) return;

            const now = Date.now();
            // Debounce: minimum 50ms between updates
            if (now - lastUpdate.current < 50) return;
            lastUpdate.current = now;

            const vv = window.visualViewport;

            // Use window.innerHeight as stable reference (full screen height)
            // This is more reliable than storing initial viewport height
            const fullHeight = window.innerHeight;
            const visibleHeight = vv.height;
            const offsetTop = vv.offsetTop || 0;

            // Calculate keyboard height
            const keyboardHeight = fullHeight - visibleHeight;

            // Keyboard is visible if it takes up more than 200px
            // Using higher threshold because Safari toolbar can cause small changes
            const isKeyboardVisible = keyboardHeight > 200;

            // Calculate top position for the input
            // When keyboard is open: position at the top of the keyboard
            // top = offsetTop + visibleHeight (bottom of visible area)
            // Then use transform: translateY(-100%) in CSS to position input above this point
            const inputTop = isKeyboardVisible ? offsetTop + visibleHeight : null;

            setState(prev => {
                // Only update if values actually changed
                if (prev.isKeyboardVisible === isKeyboardVisible &&
                    prev.inputTop === inputTop &&
                    prev.keyboardHeight === keyboardHeight) {
                    return prev;
                }
                return {
                    isKeyboardVisible,
                    inputTop,
                    keyboardHeight,
                };
            });
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Detect iOS Safari (including iPad with Safari)
        const ua = window.navigator.userAgent;
        const isIPad = /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isIPhone = /iPhone|iPod/.test(ua);
        isIOS.current = isIPad || isIPhone;

        // Only apply on iOS Safari with visualViewport support
        if (!isIOS.current || !window.visualViewport) {
            return;
        }

        // Listen to visualViewport events
        window.visualViewport.addEventListener('resize', updatePosition);
        window.visualViewport.addEventListener('scroll', updatePosition);

        // Also listen to focus events for reliability
        const handleFocus = () => {
            // Delay slightly to let keyboard animate
            setTimeout(updatePosition, 100);
            setTimeout(updatePosition, 300);
        };

        const handleBlur = () => {
            // Reset when input loses focus
            setTimeout(() => {
                setState({
                    isKeyboardVisible: false,
                    inputTop: null,
                    keyboardHeight: 0,
                });
            }, 100);
        };

        document.addEventListener('focusin', handleFocus);
        document.addEventListener('focusout', handleBlur);

        // Initial check
        updatePosition();

        return () => {
            if (rafId.current) {
                cancelAnimationFrame(rafId.current);
            }
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', updatePosition);
                window.visualViewport.removeEventListener('scroll', updatePosition);
            }
            document.removeEventListener('focusin', handleFocus);
            document.removeEventListener('focusout', handleBlur);
        };
    }, [updatePosition]);

    return state;
}

export default useSafariKeyboardFix;
