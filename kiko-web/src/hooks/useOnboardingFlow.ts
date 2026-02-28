import { useState, useEffect, useRef } from 'react';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { resolveCoreApiBase } from '../utils/coreApiBase';
import { logger } from '../utils/logger';

export type OnboardingStep = 'idle' | 'funding' | 'farcaster' | 'complete';

export function useOnboardingFlow() {
    const { ready, authenticated, user } = usePrivy();
    const [step, setStep] = useState<OnboardingStep>('idle');
    const isEvaluatingRef = useRef(false);

    // Using simple React state to ensure it fires ONCE per login session without refreshing issues
    const [hasTriggeredFunding, setHasTriggeredFunding] = useState(false);
    const prevAuthRef = useRef(authenticated);

    const { fundWallet } = useFundWallet({
        onUserExited: () => {
            // User closed the funding modal manually
            dismissCurrentStep('funding');
        }
    });

    // Reset flow when user logs out
    useEffect(() => {
        if (!authenticated && prevAuthRef.current) {
            setHasTriggeredFunding(false);
            setStep('idle');
        }
        prevAuthRef.current = authenticated;
    }, [authenticated]);

    useEffect(() => {
        if (!ready || !authenticated || !user) return;

        // Run evaluation whenever `user` changes. 
        // This is important because Privy provisions the Embedded Wallet asynchronously.
        // It might take 1-2 seconds after login for `user.linkedAccounts` to contain the wallet.
        evaluateNextStep();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, authenticated, user]);

    const evaluateNextStep = async () => {
        if (isEvaluatingRef.current) return;
        isEvaluatingRef.current = true;

        try {
            logger.log(`[Onboarding] Running evaluation for user: ${user?.id}`);

            // --- STEP 1: FUNDING CHECK ---
            const fundingSessionKey = `kiko-funding-session-${user?.id}`;
            const promptedThisSession = sessionStorage.getItem(fundingSessionKey) === 'true';

            if (!hasTriggeredFunding && !promptedThisSession) {
                const evmWallet = user?.linkedAccounts?.find(
                    (acc): acc is WalletWithMetadata => acc.type === 'wallet' && acc.chainType === 'ethereum'
                );
                const addressToFund = evmWallet?.address;

                if (addressToFund) {
                    logger.log(`[Onboarding] Triggering fundWallet for EVM address: ${addressToFund}`);
                    setStep('funding');

                    // Mark as triggered in state so we don't spam
                    setHasTriggeredFunding(true);
                    // Mark in sessionStorage so we don't trigger on page reloads
                    sessionStorage.setItem(fundingSessionKey, 'true');

                    fundWallet({ address: addressToFund });
                    isEvaluatingRef.current = false;
                    return;
                } else {
                    // Wallet not yet provisioned. We exit and wait for `user` dependency to trigger useEffect again.
                    logger.log(`[Onboarding] No EVM wallet found yet for user: ${user?.id}. Waiting for Privy...`);
                    isEvaluatingRef.current = false;
                    return;
                }
            }

            // --- STEP 2: FARCASTER CHECK ---
            const farcasterDismissKey = `kiko-farcaster-follow-dismissed-${user?.id}`;
            const dismissedFarcaster = localStorage.getItem(farcasterDismissKey) === 'true';

            if (!dismissedFarcaster) {
                const farcasterAccount = user?.linkedAccounts?.find(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (acc: any) => acc.type === 'farcaster' || (acc.type === 'wallet' && acc.chainType === 'farcaster')
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fid = (farcasterAccount as any)?.fid || (user as any)?.farcaster?.fid;

                if (fid) {
                    try {
                        const CORE_API_BASE_URL = resolveCoreApiBase();
                        const response = await fetch(`${CORE_API_BASE_URL}/api/social/is-following/${fid}`);
                        const data = await response.json();
                        if (data.success && data.data.isFollowing) {
                            localStorage.setItem(farcasterDismissKey, 'true');
                        } else {
                            logger.log('[Onboarding] Triggering Farcaster Modal');
                            setStep('farcaster');
                            isEvaluatingRef.current = false;
                            return;
                        }
                    } catch (e) {
                        logger.warn('Failed to check Farcaster follow status:', e);
                    }
                } else {
                    // User has no Farcaster linked account, prompt them to follow
                    logger.log('[Onboarding] Triggering Farcaster Modal (no fid found yet)');
                    setStep('farcaster');
                    isEvaluatingRef.current = false;
                    return;
                }
            }

            // --- COMPLETE ---
            logger.log('[Onboarding] All steps complete.');
            setStep('complete');
        } finally {
            isEvaluatingRef.current = false;
        }
    };

    const dismissCurrentStep = (targetStep?: OnboardingStep) => {
        setStep(current => {
            // Use targetStep if provided (like from onUserExited callback), otherwise use current state
            const stepToDismiss = targetStep || current;

            if (stepToDismiss === 'funding') {
                logger.log('[Onboarding] Manual dismissal of funding modal.');
                // We rely entirely on the React state `hasTriggeredFunding` now, no storage needed for funding.
                setTimeout(() => evaluateNextStep(), 100);
                return 'idle'; // Transient state
            } else if (stepToDismiss === 'farcaster') {
                logger.log('[Onboarding] Manual dismissal of farcaster modal.');
                localStorage.setItem(`kiko-farcaster-follow-dismissed-${user?.id}`, 'true');
                setTimeout(() => evaluateNextStep(), 100);
                return 'idle';
            }
            return current;
        });
    };

    return { currentStep: step, dismissCurrentStep };
}
