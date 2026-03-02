/**
 * BillingConsentPromptModal
 *
 * Show on first login to request delegated authorization for billing.
 */

import React, { useEffect, useState } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import { ShieldCheck, AlertTriangle, Loader2, X } from 'lucide-react';
import { AutoTradingConfirmModal } from './AutoTradingConfirmModal';
import styles from './AuthorizationPromptModal.module.css';
import { getBillingConsent, grantBillingConsent } from '../../services/billingApi';
import { usePrivyEmbeddedWallets } from '../../hooks/usePrivyEmbeddedWallets';
import { getPrivyAuthorizationConfig } from '../../services/privyAuthConfig';
const DISMISSED_KEY = 'kiko_billing_consent_dismissed';

export const BillingConsentPromptModal: React.FC = () => {
  const { ready, authenticated, user } = usePrivy();
  const { addSessionSigners } = useSessionSigners();
  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authKeyId, setAuthKeyId] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasConsent, setHasConsent] = useState(false);
  const { evmWallet } = usePrivyEmbeddedWallets();

  const evmNeedsAuth = evmWallet && !('delegated' in evmWallet && evmWallet.delegated);

  useEffect(() => {
    if (!authenticated) return;
    const fetchAuthKeyId = async () => {
      try {
        const data = await getPrivyAuthorizationConfig();
        setAuthKeyId(data.authKeyId);
        setPolicyId(data.policies.billing.ethereum || data.policies.autoTrading.ethereum || null);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to fetch auth key ID:', error);
        }
      }
    };
    fetchAuthKeyId();
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    getBillingConsent()
      .then(resp => setHasConsent(resp.active))
      .catch(() => setHasConsent(false));
  }, [authenticated]);

  const getDismissKey = () => {
    const userId = user?.id || 'anonymous';
    return `${DISMISSED_KEY}_${userId}`;
  };

  useEffect(() => {
    if (!ready || !authenticated || !user) {
      setShowModal(false);
      return;
    }

    if (!evmWallet || hasConsent) {
      setShowModal(false);
      return;
    }

    if (!evmNeedsAuth && hasConsent) {
      setShowModal(false);
      return;
    }

    try {
      const dismissKey = getDismissKey();
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed) {
        const dismissedTime = parseInt(dismissed, 10);
        if (Date.now() - dismissedTime < 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch (e) {
      // Ignore localStorage errors
    }

    const timer = setTimeout(() => setShowModal(true), 1500);
    return () => clearTimeout(timer);
  }, [ready, authenticated, user, evmWallet, evmNeedsAuth, hasConsent]);

  const handleAuthorizeClick = () => {
    setError(null);
    setShowConfirmModal(true);
  };

  const handleConfirmAuthorize = async () => {
    if (!authKeyId || !policyId || !evmWallet?.address) {
      setError('Authorization configuration unavailable.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await addSessionSigners({
        address: evmWallet.address,
        signers: [{ signerId: authKeyId, policyIds: [policyId] }]
      });
      await grantBillingConsent('prompt');
      setHasConsent(true);
      setShowConfirmModal(false);
      setShowModal(false);
    } catch (err: any) {
      setError(err?.message || 'Authorization failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(getDismissKey(), Date.now().toString());
    } catch (e) {
      // Ignore
    }
    setShowModal(false);
  };

  // Temporarily disabled since the billing system is not active
  return null;

  if (!showModal) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={handleDismiss}>
          <X size={20} />
        </button>

        <div className={styles.iconWrapper}>
          <ShieldCheck size={40} className={styles.icon} />
        </div>

        <h2 className={styles.title}>Enable Billing Authorization</h2>

        <p className={styles.description}>
          To continue after free usage, please authorize daily billing on Base.
        </p>

        <div className={styles.securityNote}>
          <AlertTriangle size={16} />
          <span>You can revoke this at any time in Wallet Settings.</span>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.actions}>
          <button
            className={styles.authorizeButton}
            onClick={handleAuthorizeClick}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className={styles.spinner} />
                Authorizing...
              </>
            ) : (
              'Authorize Billing'
            )}
          </button>

          <button
            className={styles.skipButton}
            onClick={handleDismiss}
            disabled={isLoading}
          >
            Skip for now
          </button>
        </div>

        <p className={styles.footer}>You can always change this in Wallet Settings</p>
      </div>

      <AutoTradingConfirmModal
        open={showConfirmModal}
        onConfirm={handleConfirmAuthorize}
        onCancel={() => setShowConfirmModal(false)}
        confirming={isLoading}
      />
    </div>
  );
};

export default BillingConsentPromptModal;
