import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { resolveCoreApiBase } from '../utils/coreApiBase';
import { logger } from '../utils/logger';

export type OnboardingStep = 'idle' | 'farcaster' | 'complete';

export function useOnboardingFlow() {
    const { ready, authenticated, user } = usePrivy();
    const [step, setStep] = useState<OnboardingStep>('idle');

    useEffect(() => {
        if (!ready || !authenticated || !user) return;

        // A small delay before starting onboarding to let the UI settle
        const timer = setTimeout(() => {
            evaluateNextStep('idle');
        }, 1500);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, authenticated, user]);

    const evaluateNextStep = async (current: OnboardingStep) => {
        // 1. Check Farcaster
        if (current === 'idle') {
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
                            setStep('farcaster');
                            return;
                        }
                    } catch (e) {
                        logger.warn('Failed to check Farcaster follow status:', e);
                    }
                }
            }
        }

        // We are skipping the Billing step here because the billing system is not yet active.

        // 2. Complete
        setStep('complete');
    };

    const dismissCurrentStep = () => {
        if (step === 'farcaster') {
            localStorage.setItem(`kiko-farcaster-follow-dismissed-${user?.id}`, 'true');
            setStep('idle');
            evaluateNextStep('idle');
        }
    };

    return { currentStep: step, dismissCurrentStep };
}
