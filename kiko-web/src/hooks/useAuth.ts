/**
 * useAuth Hook
 * 
 * A unified authentication hook that wraps Privy's usePrivy.
 * 
 * Usage: Replace `usePrivy()` with `useAuth()` for consistency.
 */

import { usePrivy, useWallets } from '@privy-io/react-auth';

export function useAuth() {
    return usePrivy();
}

export function useAuthWallets() {
    return useWallets();
}
