import React, { useEffect, useState } from 'react';
import { usePrivy, useSessionSigners } from '@privy-io/react-auth';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { AutoTradingConfirmModal } from './AutoTradingConfirmModal';
import styles from './SessionSignerButton.module.css';
import { getBillingConsent, grantBillingConsent, revokeBillingConsent } from '../../services/billingApi';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface BillingConsentButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export const BillingConsentButton: React.FC<BillingConsentButtonProps> = ({ onSuccess, onError }) => {
  const { ready, authenticated, user } = usePrivy();
  const { addSessionSigners, removeSessionSigners } = useSessionSigners();
  const [isLoading, setIsLoading] = useState(false);
  const [isDelegated, setIsDelegated] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [authKeyId, setAuthKeyId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const embeddedWallet = user?.linkedAccounts?.find(
    (account): account is WalletWithMetadata =>
      account.type === 'wallet' &&
      account.walletClientType === 'privy' &&
      account.chainType === 'ethereum'
  );

  useEffect(() => {
    if (embeddedWallet && 'delegated' in embeddedWallet) {
      setIsDelegated(embeddedWallet.delegated === true);
    } else {
      setIsDelegated(false);
    }
  }, [embeddedWallet]);

  useEffect(() => {
    const fetchAuthKeyId = async () => {
      try {
        const response = await fetch(`${API_URL}/api/config/auth-key-id`);
        if (response.ok) {
          const data = await response.json();
          setAuthKeyId(data.authKeyId);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to fetch auth key ID:', error);
        }
      }
    };
    fetchAuthKeyId();
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    getBillingConsent()
      .then(resp => setHasConsent(resp.active))
      .catch(() => setHasConsent(false));
  }, [authenticated]);

  const handleAuthorizeClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmAuthorize = async () => {
    if (!embeddedWallet?.address || !authKeyId) return;

    setIsLoading(true);
    try {
      await addSessionSigners({
        address: embeddedWallet.address,
        signers: [{ signerId: authKeyId, policyIds: [] }]
      });
      await grantBillingConsent('settings');
      setHasConsent(true);
      setIsDelegated(true);
      setShowConfirmModal(false);
      onSuccess?.();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to authorize billing consent:', error);
      }
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!embeddedWallet?.address || !authKeyId) return;

    setIsLoading(true);
    try {
      await (removeSessionSigners as any)({
        address: embeddedWallet.address,
        signerIds: [authKeyId]
      });
      await revokeBillingConsent();
      setHasConsent(false);
      setIsDelegated(false);
      onSuccess?.();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to revoke billing consent:', error);
      }
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!ready || !authenticated || !embeddedWallet) {
    return null;
  }

  const active = isDelegated && hasConsent;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>Billing Authorization</span>
        <span className={styles.chainBadge}>BASE</span>
      </div>

      <p className={styles.description}>
        {active
          ? '✅ Server authorized for billing. Daily settlement is enabled.'
          : 'Authorize the server to perform daily billing settlements on your behalf. You can revoke this at any time.'
        }
      </p>

      <button
        className={`${styles.button} ${active ? styles.revokeButton : styles.authorizeButton}`}
        onClick={active ? handleRevoke : handleAuthorizeClick}
        disabled={isLoading || !authKeyId}
      >
        {isLoading ? 'Processing...' : active ? 'Revoke Billing Authorization' : 'Authorize Billing'}
      </button>

      <AutoTradingConfirmModal
        open={showConfirmModal}
        onConfirm={handleConfirmAuthorize}
        onCancel={() => setShowConfirmModal(false)}
        confirming={isLoading}
      />

      {!authKeyId && (
        <p className={styles.error}>
          Unable to fetch authorization configuration. Please try again later.
        </p>
      )}
    </div>
  );
};

export default BillingConsentButton;
