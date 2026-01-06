import React from 'react';
import { Dialog } from '../Dialog/Dialog';
import { ExportWalletButton } from './ExportWalletButton';
import { SessionSignerButton } from './SessionSignerButton';
import styles from './WalletSettingsModal.module.css';

interface WalletSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisconnect: () => void;
}

export const WalletSettingsModal: React.FC<WalletSettingsModalProps> = ({
  isOpen,
  onClose,
  onDisconnect,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Wallet Settings"
      size="lg"
      className={styles.modal}
    >
      <div className={styles.content}>

        {/* Security Group */}
        <div className={styles.group}>
          <h3 className={styles.groupTitle}>Security & Privacy</h3>
          <div className={styles.groupList}>
            {/* Auto Trading Item */}
            <div className={styles.groupItem}>
              <SessionSignerButton chainType="solana" />
            </div>

            {/* Recovery Phrase Items */}
            <div className={styles.groupItem}>
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>Backup Recovery Phrase</span>
                <p className={styles.itemDescription}>Export your private key to secure your wallet.</p>
              </div>
              <div className={styles.recoveryButtons}>
                <ExportWalletButton chainType="ethereum" asButton />
                <ExportWalletButton chainType="solana" asButton />
              </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className={styles.dangerZone}>
          <button
            onClick={onDisconnect}
            className={styles.disconnectButton}
          >
            Disconnect Wallet
          </button>
        </div>
      </div>
    </Dialog>
  );
};

