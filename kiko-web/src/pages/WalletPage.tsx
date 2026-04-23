import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom'; // Added useNavigate
import { ReceiveModal } from '../components/Wallet/ReceiveModal';
import { SendModal } from '../components/Wallet/SendModal';
import { SwapCardIntegrated } from '../components/Swap/SwapCardIntegrated';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../components/Toast';
import { useWalletPageData } from '../hooks/useWalletPageData';
import { WalletHeader } from '../components/Wallet/WalletHeader';
import { AssetList } from '../components/Wallet/AssetList';
import { TransactionList } from '../components/Wallet/TransactionList';
import { PolymarketOrderCard, PolymarketHistoryItem } from '../components/Wallet/PolymarketSection';
import { CreditTopUpModal } from '../components/Wallet/CreditTopUpModal';
import { CreditRefundModal } from '../components/Wallet/CreditRefundModal';
import { CreditDepositHistoryModal } from '../components/Wallet/CreditDepositHistoryModal';
import {
  getCreditDeposits,
  getUsageSummary,
  requestCreditRefund,
  type CreditDepositItem,
  type UsageSummary,
} from '../services/billingApi';
import { agentAttrs } from '../agent/attrs';
import styles from './WalletPage.module.css';
import { usePrivyEmbeddedWallets } from '../hooks/usePrivyEmbeddedWallets';

export default function WalletPage() {
  const navigate = useNavigate(); // Hook for navigation
  const {
    authenticated, user, walletAddress, isSolana, chainId, currentChain,
    holdings, loading, transactions, transactionsLoading,
    orders, pendingOrders, ordersLoading, orderHistory, orderHistoryLoading,
    getAccessToken, portfolioStats, setOrders, setPendingOrders, error,
    refreshData
  } = useWalletPageData();
  const { evmWallet, solanaWallet } = usePrivyEmbeddedWallets();

  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isSwapOpen, setIsSwapOpen] = useState(false);
  const [isSwapExecutionBusy, setIsSwapExecutionBusy] = useState(false);
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'assets' | 'orders'>('assets');
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; order: any | null }>({ isOpen: false, order: null });
  const [billingSummary, setBillingSummary] = useState<UsageSummary | null>(null);
  const [creditDeposits, setCreditDeposits] = useState<CreditDepositItem[]>([]);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isDepositHistoryOpen, setIsDepositHistoryOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [refundModalDeposit, setRefundModalDeposit] = useState<CreditDepositItem | null>(null);
  const [isRefundSubmitting, setIsRefundSubmitting] = useState(false);
  const swapScopedHoldings = holdings.filter(h => h.chainId === chainId);
  const refundableDeposits = creditDeposits.filter((deposit) => deposit.refundEligible);

  const needsAuthorization = (() => {
    const evmNeeds = !!evmWallet && !evmWallet.delegated;
    const solNeeds = !!solanaWallet && !solanaWallet.delegated;
    return evmNeeds || solNeeds;
  })();

  const handleCancelOrder = async (orderId: string) => {
    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await (await fetch(`${apiUrl}/api/polymarket/trading/order/cancel`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })).json();
      if (res.success) { toast.success('Order cancelled'); setPendingOrders(prev => prev.filter(o => o.id !== orderId)); }
      else toast.error(res.error || 'Cancel failed');
    } catch (e) { console.error('Cancel failed', e); }
  };

  const handleClosePosition = async () => {
    const order = confirmDialog.order;
    if (!order) return;
    setConfirmDialog({ isOpen: false, order: null });
    try {
      const token = await getAccessToken();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await (await fetch(`${apiUrl}/api/polymarket/trading/position/close`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: order.assetId, currentPrice: order.currentPrice, shares: order.size })
      })).json();
      if (res.success) { toast.success('Close order submitted'); setOrders(prev => prev.filter(o => o.assetId !== order.assetId)); }
      else toast.error(res.error || 'Close failed');
    } catch (e) { console.error('Close failed', e); toast.error('Close failed'); }
  };

  const loadBillingData = async (forceFresh = false) => {
    if (!authenticated) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const token = await getAccessToken();
      const summary = await getUsageSummary(token, { forceFresh });
      const deposits = await getCreditDeposits(token);
      setBillingSummary(summary);
      setCreditDeposits(deposits);
    } catch (error) {
      console.error('Failed to load billing data', error);
      setBillingError(error instanceof Error ? error.message : 'Failed to load billing data');
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    if (!authenticated) return;
    void loadBillingData();
  }, [authenticated]);

  useEffect(() => {
    if (!isSwapOpen) {
      setIsSwapExecutionBusy(false);
    }
  }, [isSwapOpen]);

  useEffect(() => {
    if (!isSwapOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (isSwapExecutionBusy) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      setIsSwapExecutionBusy(false);
      setIsSwapOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isSwapExecutionBusy, isSwapOpen]);

  const handleRequestRefund = async (depositId: string) => {
    setIsRefundSubmitting(true);
    try {
      const token = await getAccessToken();
      await requestCreditRefund(depositId, token);
      toast.success('Refund request submitted');
      setRefundModalDeposit(null);
      await loadBillingData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Refund request failed');
    } finally {
      setIsRefundSubmitting(false);
    }
  };

  if (!authenticated) return (
    <div className={styles.connectWalletContainer}>
      <div className={styles.connectWalletCard}>
        <Shield size={32} className={styles.connectWalletIcon} />
        <h2 className={styles.connectWalletTitle}>Login to KIKO</h2>
        <p className={styles.connectWalletText}>View your portfolio and manage assets.</p>
      </div>
    </div>
  );

  const closeSwapModal = () => {
    if (isSwapExecutionBusy) return;
    setIsSwapExecutionBusy(false);
    setIsSwapOpen(false);
  };

  return (
    <div className={styles.container}>
      <div className={styles.contentWrapper}>
        <WalletHeader
          user={user} loading={loading} totalValue={portfolioStats.totalValue}
          onSettingsClick={() => navigate('/settings')}
          onSendClick={() => {
            const defaultToken = holdings.find(h => h.isNative && h.chainId === currentChain.id) || holdings.find(h => h.isNative);
            setSelectedToken(defaultToken || null);
            setIsSendOpen(true);
          }}
          onReceiveClick={() => setIsReceiveOpen(true)}
          onSwapClick={() => {
            setIsSwapExecutionBusy(false);
            setIsSwapOpen(true);
          }}
          styles={styles}
        />
        {needsAuthorization && (
          <div className={styles.authorizationBanner}>
            <div className={styles.authorizationText}>
              Enable server authorization to use instant swaps and auto‑trading.
            </div>
            <button
              className={styles.authorizationButton}
              {...agentAttrs({ id: 'wallet.authorization.open_settings', role: 'button', action: 'navigate', page: 'wallet' })}
              onClick={() => navigate('/settings')}
            >
              Authorize
            </button>
          </div>
        )}
        {error && (
          <div style={{
            marginBottom: '12px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(239,68,68,0.4)',
            background: 'rgba(239,68,68,0.08)',
            color: '#ef4444',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}>
            <span>{error}</span>
            <button
              onClick={() => refreshData(true)}
              style={{
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'transparent',
                color: '#ef4444',
                borderRadius: '999px',
                fontSize: '12px',
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}
        <div className={styles.creditsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Credits</div>
          </div>
          {billingError && <div className={styles.creditNoticeError}>{billingError}</div>}
          <div className={styles.creditLedgerCard}>
            <div className={styles.creditLedgerLeft}>
              <div className={styles.creditLedgerTitle}>Credits Balance</div>
              <div className={styles.creditLedgerMeta}>
                <span>1 USD = {billingSummary?.credits.perUsd ?? 10} credits</span>
              </div>
            </div>

            <div className={styles.creditLedgerBalance}>
              <div className={styles.creditMetricBlock}>
                <div className={styles.creditBalanceValue}>{billingSummary ? billingSummary.credits.available.toFixed(2) : '--'}</div>
                <div className={styles.creditBalanceLabel}>Credits balance</div>
              </div>
              {billingSummary && billingSummary.credits.reserved > 0 ? (
                <>
                  <div className={styles.creditMetricDivider} />
                  <div className={styles.creditMetricBlock}>
                    <div className={styles.creditBalanceValueSecondary}>{billingSummary.credits.reserved.toFixed(2)}</div>
                    <div className={styles.creditBalanceLabel}>Pending hold</div>
                  </div>
                </>
              ) : null}
            </div>

            <div className={styles.creditLedgerActions}>
              <button className={styles.creditActionButton} onClick={() => setIsTopUpOpen(true)}>
                Top Up
              </button>
              <button className={styles.creditActionButtonSecondary} onClick={() => setIsDepositHistoryOpen(true)}>
                Deposits
              </button>
              <button
                className={refundableDeposits.length > 0 ? styles.creditActionButton : styles.creditActionButtonSecondary}
                onClick={() => setIsRefundOpen(true)}
              >
                {refundableDeposits.length > 0 ? `Refund (${refundableDeposits.length})` : 'Refund'}
              </button>
              {billingSummary?.admin.canManageRefunds && (
                <button className={styles.creditActionButtonSecondary} onClick={() => navigate('/admin')}>
                  Open Admin
                </button>
              )}
            </div>
          </div>
        </div>
        <div className={styles.assetsSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.toggleContainer}>
              <button
                className={`${styles.toggleButton} ${viewMode === 'assets' ? styles.active : ''}`}
                {...agentAttrs({ id: 'wallet.view.assets', role: 'tab', action: 'select', page: 'wallet' })}
                onClick={() => setViewMode('assets')}
              >
                Assets
              </button>
              <button
                className={`${styles.toggleButton} ${viewMode === 'orders' ? styles.active : ''}`}
                {...agentAttrs({ id: 'wallet.view.orders', role: 'tab', action: 'select', page: 'wallet' })}
                onClick={() => setViewMode('orders')}
              >
                Orders
              </button>
            </div>
          </div>
          {viewMode === 'assets' ? <AssetList loading={loading} displayHoldings={holdings} showAllAssets={showAllAssets} onToggleShowAll={() => setShowAllAssets(!showAllAssets)} styles={styles} /> : (
            <div className={styles.ordersContainer}>
              {ordersLoading ? <div className={styles.emptyState}>Loading orders...</div> : (orders.length === 0 && pendingOrders.length === 0 ? <div className={styles.emptyState}>No positions.</div> : (
                <>
                  {orders.map((o, i) => <PolymarketOrderCard key={i} order={o} styles={styles} onSell={() => setConfirmDialog({ isOpen: true, order: o })} />)}
                  {pendingOrders.map((o, i) => <div key={i} className={styles.historyItemNew}><span>{o.title} (Pending)</span><button className={styles.cancelButton} onClick={() => handleCancelOrder(o.id)}>Cancel</button></div>)}
                </>
              ))}
            </div>
          )}
        </div>
        <div className={styles.historySection}>
          <div className={styles.sectionHeader}><div className={styles.sectionTitle}>{viewMode === 'orders' ? 'Order History' : 'Transaction History'}</div></div>
          {viewMode === 'orders' ? (orderHistoryLoading ? <div>Loading...</div> : orderHistory.map((t, i) => <PolymarketHistoryItem key={i} trade={t} styles={styles} />)) :
            <TransactionList loading={transactionsLoading} transactions={transactions} styles={styles} walletAddress={walletAddress || ''} />}
        </div>
      </div>
      <ReceiveModal isOpen={isReceiveOpen} onClose={() => setIsReceiveOpen(false)} walletAddress={walletAddress || ''} chainName={isSolana ? 'Solana' : currentChain.name} />
      <SendModal
        isOpen={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        walletAddress={walletAddress || ''}
        chainId={chainId}
        tokenAddress={selectedToken?.address}
        tokenSymbol={selectedToken?.symbol}
        tokenDecimals={selectedToken?.decimals}
        tokenBalance={selectedToken?.balance}
        isNative={selectedToken?.isNative}
        isSolana={isSolana}
        holdings={holdings.filter(h => h.chainId === chainId)}
        onSelectToken={(token) => setSelectedToken(token)}
        onSuccess={refreshData}
      />
      <CreditTopUpModal
        isOpen={isTopUpOpen}
        onClose={() => setIsTopUpOpen(false)}
        summary={billingSummary}
        walletAddress={walletAddress}
        holdings={holdings}
        onSuccess={() => {
          void loadBillingData(true);
          void refreshData(true);
        }}
      />
      <CreditDepositHistoryModal
        isOpen={isDepositHistoryOpen}
        onClose={() => setIsDepositHistoryOpen(false)}
        deposits={creditDeposits}
        loading={billingLoading}
        onRefund={(deposit) => {
          setIsDepositHistoryOpen(false);
          setRefundModalDeposit(deposit);
        }}
      />
      <CreditDepositHistoryModal
        isOpen={isRefundOpen}
        onClose={() => setIsRefundOpen(false)}
        deposits={refundableDeposits}
        loading={billingLoading}
        eyebrow="Refund"
        title="Choose a deposit to refund"
        emptyMessage="No deposits can be refunded right now."
        onRefund={(deposit) => {
          setIsRefundOpen(false);
          setRefundModalDeposit(deposit);
        }}
      />
      <CreditRefundModal
        isOpen={!!refundModalDeposit}
        onClose={() => !isRefundSubmitting && setRefundModalDeposit(null)}
        deposit={refundModalDeposit}
        onConfirm={handleRequestRefund}
        isSubmitting={isRefundSubmitting}
      />
      {isSwapOpen && createPortal(
        <div
          className={`${styles.modalOverlay} ${isSwapExecutionBusy ? styles.modalOverlayLocked : ''}`}
          onClick={closeSwapModal}
          aria-busy={isSwapExecutionBusy}
        >
          <div onClick={e => e.stopPropagation()}>
            <SwapCardIntegrated
              userAddress={walletAddress}
              chainId={chainId}
              onClose={closeSwapModal}
              onSwapSuccess={() => refreshData(true)}
              onExecutionBusyChange={setIsSwapExecutionBusy}
              userHoldings={swapScopedHoldings}
            />
          </div>
        </div>,
        document.body
      )}
      <ConfirmDialog isOpen={confirmDialog.isOpen} title="Close Position" message={`Sell shares of "${confirmDialog.order?.title}"?`} onConfirm={handleClosePosition} onCancel={() => setConfirmDialog({ isOpen: false, order: null })} />
    </div>
  );
}
