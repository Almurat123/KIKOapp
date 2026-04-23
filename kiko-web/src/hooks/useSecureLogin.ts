import { useState, useCallback } from 'react';
import { useAppLogin } from './useAppLogin';

interface UseSecureLoginReturn {
    secureLogin: () => void;
    isWarningOpen: boolean;
    closeWarning: () => void;
    confirmLogin: () => void;
}

export const useSecureLogin = (): UseSecureLoginReturn => {
    const { login } = useAppLogin();
    const [isWarningOpen, setIsWarningOpen] = useState(false);

    // This function replaces the standard login call
    const secureLogin = useCallback(() => {
        setIsWarningOpen(true);
    }, []);

    const closeWarning = useCallback(() => {
        setIsWarningOpen(false);
    }, []);

    const confirmLogin = useCallback(() => {
        setIsWarningOpen(false);
        // Proceed with actual Privy login
        login();
    }, [login]);

    return {
        secureLogin,
        isWarningOpen,
        closeWarning,
        confirmLogin,
    };
};
