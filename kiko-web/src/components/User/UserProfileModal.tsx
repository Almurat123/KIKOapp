import React, { useState } from 'react';
import { X, Wallet, Network, Copy, Check, LogOut, LogIn, Zap } from 'lucide-react';
import { usePrivy, useWallets, useLinkAccount } from '@privy-io/react-auth';
import { useChainId, useSwitchChain, useAccount } from 'wagmi';
import { isWalletConnected, getConnectedWalletAddress } from '../../utils/walletUtils';
import styles from './UserProfileModal.module.css';

const SUPPORTED_CHAINS = [
  { id: 1, name: 'Ethereum Mainnet', symbol: 'ETH' },
  { id: 8453, name: 'Base', symbol: 'BASE' },
  { id: 42161, name: 'Arbitrum One', symbol: 'ARB' },
  { id: 10, name: 'Optimism', symbol: 'OP' },
  { id: 137, name: 'Polygon', symbol: 'MATIC' },
];

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

import { PreLoginWarningModal } from '../Privy/PreLoginWarningModal';
import { useSecureLogin } from '../../hooks/useSecureLogin';

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, authenticated, logout, ready, getAccessToken } = usePrivy();
  const { secureLogin, isWarningOpen, closeWarning, confirmLogin } = useSecureLogin();
  const { wallets } = useWallets();
  const { linkWallet } = useLinkAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { address: wagmiAddress, isConnected: wagmiIsConnected } = useAccount();

  const [copied, setCopied] = useState(false);
  const [isSniperActive, setIsSniperActive] = useState(false);
  const [sniperLoading, setSniperLoading] = useState(false);

  const isConnected = isWalletConnected({
    authenticated,
    ready,
    wallets,
    wagmiAddress,
    wagmiIsConnected,
  });

  const walletAddress = getConnectedWalletAddress({
    authenticated,
    ready,
    wallets,
    wagmiAddress,
    wagmiIsConnected,
  });

  if (!isOpen) return null;

  const emailAddress = user?.email && typeof user.email === 'object' && 'address' in user.email
    ? (user.email as { address: string }).address
    : (typeof user?.email === 'string' ? user.email : null);
  const userName = (emailAddress ? emailAddress.split('@')[0] : null) || user?.farcaster?.username || 'User';
  const currentChain = SUPPORTED_CHAINS.find(chain => chain.id === chainId) || SUPPORTED_CHAINS[0];
  const hasWallet = isConnected && !!walletAddress;

  const handleCopyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConnect = () => {
    try {
      if (!authenticated) {
        secureLogin();
      } else {
        if (linkWallet) {
          linkWallet();
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error in handleConnect:', error);
      }
    }
  };

  const handleDisconnect = async () => {
    try {
      await logout();
      onClose();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error in handleDisconnect:', error);
      }
      onClose();
    }
  };

  const handleSwitchChain = (targetChainId: number) => {
    if (switchChain && hasWallet) {
      try {
        switchChain({ chainId: targetChainId });
      } catch (error) {
        console.error('Failed to switch chain:', error);
      }
    }
  };

  const toggleSniperMode = async () => {
    if (sniperLoading) return;
    setSniperLoading(true);

    try {
      const token = await getAccessToken();
      const endpoint = isSniperActive ? '/api/zora/sniper/stop' : '/api/zora/sniper/start';
      const body = isSniperActive ? {} : { buyAmountEth: '0.001', maxSlippage: 0.1 };

      const res = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (data.success) {
        setIsSniperActive(!isSniperActive);
      }
    } catch (error) {
      console.error('Failed to toggle sniper:', error);
    } finally {
      setSniperLoading(false);
    }
  };

  return (
    <>
      <PreLoginWarningModal
        isOpen={isWarningOpen}
        onConfirm={confirmLogin}
        onCancel={closeWarning}
      />
      <div className={styles.overlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.header}>
            <h3>User Profile</h3>
            <button onClick={onClose} className={styles.closeBtn}>
              <X size={20} />
            </button>
          </div>

          <div className={styles.content}>
            {!isConnected ? (
              <div className={styles.connectSection}>
                <div className={styles.connectHeader}>
                  <Wallet size={32} className={styles.connectIcon} />
                  <h3>Connect Wallet</h3>
                  <p>Connect your wallet to get started</p>
                </div>
                <button className={styles.connectButton} onClick={handleConnect}>
                  <LogIn size={18} />
                  <span>Connect Wallet</span>
                </button>
              </div>
            ) : (
              <>
                <div className={styles.userHeader}>
                  <div className={styles.avatar} />
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{userName}</span>
                    {walletAddress && (
                      <div className={styles.walletAddressRow}>
                        <span className={styles.userWallet}>
                          {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                        </span>
                        <button
                          className={styles.copyButton}
                          onClick={handleCopyAddress}
                          title="Copy Address"
                        >
                          {copied ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Network Selection */}
                {hasWallet && (
                  <div className={styles.section}>
                    <h4>
                      <Network size={16} style={{ display: 'inline', marginRight: '8px' }} />
                      Network
                    </h4>
                    <div className={styles.networkList}>
                      {SUPPORTED_CHAINS.map((chain) => (
                        <button
                          key={chain.id}
                          className={`${styles.networkButton} ${chainId === chain.id ? styles.networkButtonActive : ''}`}
                          onClick={() => handleSwitchChain(chain.id)}
                        >
                          <div className={styles.networkInfo}>
                            <span className={styles.networkName}>{chain.name}</span>
                            {chainId === chain.id && <span className={styles.activeBadge}>Active</span>}
                          </div>
                          {chainId === chain.id && <Check size={16} className={styles.checkIcon} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sniper Mode (Base Only) */}
                {hasWallet && chainId === 8453 && (
                  <div className={styles.section}>
                    <h4>
                      <Zap size={16} className={`${styles.icon} ${isSniperActive ? styles.iconActive : ''}`} style={{ marginRight: '8px', display: 'inline' }} />
                      Sniper Mode
                    </h4>
                    <div className={styles.sniperCard}>
                      <div className={styles.sniperInfo}>
                        <span className={styles.sniperTitle}>Zora Auto-Snipe</span>
                        <span className={styles.sniperDesc}>Automatically buy new Zora coins instantly upon deployment.</span>
                        {isSniperActive && <span className={styles.sniperBadge}>Running</span>}
                      </div>
                      <button
                        className={`${styles.toggleButton} ${isSniperActive ? styles.toggleOn : ''}`}
                        onClick={toggleSniperMode}
                        disabled={sniperLoading}
                      >
                        <div className={styles.toggleHandle} />
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.footer}>
                  <button className={styles.disconnectButton} onClick={handleDisconnect}>
                    <LogOut size={16} />
                    <span>Disconnect</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
