import { useState, useEffect, useRef } from 'react';
import { usePrivy, useFundWallet } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { logger } from '../utils/logger';
import { useFarcasterContext } from '../contexts/FarcasterContext';
import { useMiniAppContext } from '../contexts/MiniAppContext';

export type OnboardingStep = 'idle' | 'funding' | 'farcaster' | 'complete';

// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Codex
// Reason: Farcaster Mini App auth uses Farcaster/social login plus Privy
//         embedded wallets; the automatic funding prompt can open Privy
//         external funding surfaces that are outside the Mini App product
//         scope and may trigger WalletConnect CSP failures.
// Goal: Preserve normal browser onboarding while preventing Mini App launches
//       from showing external funding/wallet connection UI.
// Owns: Post-login onboarding step ordering and Mini App-specific suppression
//       of optional funding prompts.
// Does Not Own: Privy provider configuration, Farcaster manifest metadata,
//               swap execution, or wallet transaction signing.
// Design Language:
// - Keep Farcaster Mini App onboarding focused on social identity and embedded
//   wallets.
// - Do not auto-open funding or external wallet surfaces inside Mini App hosts.
// - Preserve browser funding onboarding outside Mini App unless product policy
//   changes.
// Document Provenance:
// - Source: Farcaster Mini Apps loading guide
// - Kind: official API doc
// - Retrieved: 2026-04-12
// - Applied To: Avoid opening optional third-party UI during Mini App startup
//   and ready flow.
// - Verification: verified in code; runtime effect to be rechecked after deploy
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/farcaster-miniapp-support.md
// - /Users/almurat/KiKo/system-journal/design-language/farcaster-miniapp-shell.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-farcaster-miniapp-onboarding-external-wallet-suppression.md
export function useOnboardingFlow() {
    const { ready, authenticated, user } = usePrivy();
    const { isMiniApp } = useMiniAppContext();
    const { fid, followsKiko, followStatus, loading: farcasterLoading } = useFarcasterContext();
    const [step, setStep] = useState<OnboardingStep>('idle');
    const isEvaluatingRef = useRef(false);

    // Using simple React state to ensure it fires ONCE per login session without refreshing issues
    const [hasTriggeredFunding, setHasTriggeredFunding] = useState(false);
    const [hasTriggeredFarcaster, setHasTriggeredFarcaster] = useState(false);

    // We want to detect a *manual* login during this browser session vs an *auto-login* on page load.
    const [isInteractiveLogin, setIsInteractiveLogin] = useState(false);
    const prevReadyRef = useRef(false);

    const prevAuthRef = useRef(authenticated);
    const lastUserIdRef = useRef<string | undefined>(undefined);

    const { fundWallet } = useFundWallet({
        onUserExited: () => {
            // User closed the funding modal manually
            dismissCurrentStep('funding');
        }
    });

    useEffect(() => {
        if (user?.id) {
            lastUserIdRef.current = user.id;
        }
    }, [user?.id]);

    const currentStepRef = useRef(step);
    useEffect(() => {
        currentStepRef.current = step;
    }, [step]);

    // Consolidated Auth State Monitor
    useEffect(() => {
        // Core robust detection for manual logins:
        // Privy sets `ready` = true only *after* its initial auth check on page load completes.
        // Thus, if `authenticated` goes from `false` to `true` *after* `ready` is already `true`,
        // it strictly means the user explicitly logged in during this active browser session!
        if (ready && prevReadyRef.current) {
            if (!prevAuthRef.current && authenticated) {
                logger.log('[Onboarding] Detected interactive login session.');
                setIsInteractiveLogin(true);
            }
        }

        // Reset flow when user logs out
        if (!authenticated && prevAuthRef.current) {
            setHasTriggeredFunding(false);
            setHasTriggeredFarcaster(false);
            hasDismissedFundingRef.current = false;
            setIsInteractiveLogin(false);
            setStep('idle');
            // We do not remove the permanent localStorage key on logout
            // so we don't annoy the user if they log back in.
        }

        prevReadyRef.current = ready;
        prevAuthRef.current = authenticated;
    }, [ready, authenticated]);

    useEffect(() => {
        if (!ready || !authenticated || !user) return;

        // Run evaluation whenever `user` changes. 
        // This is important because Privy provisions the Embedded Wallet asynchronously.
        // It might take 1-2 seconds after login for `user.linkedAccounts` to contain the wallet.
        evaluateNextStep();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, authenticated, user, fid, followsKiko, followStatus, farcasterLoading, isMiniApp]);

    const evaluateNextStep = async () => {
        if (isEvaluatingRef.current) return;

        // If we are currently showing a modal, DO NOT re-evaluate and accidentally overwrite it
        if (currentStepRef.current !== 'idle' && currentStepRef.current !== 'complete') {
            return;
        }

        isEvaluatingRef.current = true;

        try {
            logger.log(`[Onboarding] Running evaluation for user: ${user?.id}`);

            // --- STEP 1: FUNDING CHECK ---
            // Shows ONLY on Welcome screen (root path) and ONLY after a fresh login event
            const isWelcomeScreen = window.location.pathname === '/';

            // We do NOT use localStorage here because the user wants it to trigger on EVERY fresh login.
            if (!isMiniApp && !hasTriggeredFunding && isWelcomeScreen && isInteractiveLogin) {
                const evmWallet = user?.linkedAccounts?.find(
                    (acc): acc is WalletWithMetadata => acc.type === 'wallet' && acc.chainType === 'ethereum'
                );
                const addressToFund = evmWallet?.address;

                if (addressToFund) {
                    logger.log(`[Onboarding] Triggering fundWallet for EVM address: ${addressToFund}`);
                    setStep('funding');

                    // Mark as triggered in state so we don't spam
                    setHasTriggeredFunding(true);

                    // Consume the interactive login flag
                    setIsInteractiveLogin(false);

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
            // Shows on EVERY page load unless user permanently dismissed via "Do not show this again"
            const farcasterPermanentKey = `kiko-farcaster-follow-permanent-dismissed-${user?.id}`;
            const permanentDismissedFarcaster = localStorage.getItem(farcasterPermanentKey) === 'true';

            if (!permanentDismissedFarcaster && !hasTriggeredFarcaster) {
                if (fid) {
                    if (farcasterLoading && followStatus === 'unknown' && followsKiko === null) {
                        isEvaluatingRef.current = false;
                        return;
                    }

                    if (followsKiko === true) {
                        localStorage.setItem(farcasterPermanentKey, 'true');
                    } else if (followStatus === 'not_following') {
                        logger.log('[Onboarding] Triggering Farcaster Modal');
                        setStep('farcaster');
                        setHasTriggeredFarcaster(true);
                        isEvaluatingRef.current = false;
                        return;
                    }
                } else {
                    // User has no Farcaster linked account, prompt them to follow
                    logger.log('[Onboarding] Triggering Farcaster Modal (no fid found yet)');
                    setStep('farcaster');
                    setHasTriggeredFarcaster(true);
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

    const dismissTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
    const hasDismissedFundingRef = useRef(false);

    const dismissCurrentStep = (targetStep?: OnboardingStep, neverShowAgain?: boolean) => {
        const stepToDismiss = targetStep || currentStepRef.current;

        if (stepToDismiss === 'funding') {
            // Privy's onUserExited fires many times. Only honor the FIRST call.
            if (hasDismissedFundingRef.current) {
                return;
            }
            hasDismissedFundingRef.current = true;
            logger.log('[Onboarding] Manual dismissal of funding modal.');
            setStep('idle');
            if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current as number);
            dismissTimeoutRef.current = setTimeout(() => evaluateNextStep(), 200);
        } else if (stepToDismiss === 'farcaster') {
            logger.log(`[Onboarding] Manual dismissal of farcaster modal. Permanent: ${neverShowAgain}`);
            if (neverShowAgain) {
                localStorage.setItem(`kiko-farcaster-follow-permanent-dismissed-${user?.id}`, 'true');
            }
            setStep('idle');
            if (dismissTimeoutRef.current) clearTimeout(dismissTimeoutRef.current as number);
            dismissTimeoutRef.current = setTimeout(() => evaluateNextStep(), 200);
        }
    };

    return { currentStep: step, dismissCurrentStep };
}
