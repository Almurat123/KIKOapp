import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { PageContainer } from '../components/Layout/PageContainer';
import { toast } from '../components/Toast';
import {
  approveAdminCreditRefund,
  getAdminCreditRefunds,
  getCreditWatcherMonitor,
  getUsageSummary,
  rejectAdminCreditRefund,
  settleAdminCreditRefund,
  type AdminCreditRefundItem,
  type CreditWatcherStatus,
  type UsageSummary,
} from '../services/billingApi';
import styles from './AdminPage.module.css';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function shortenHash(value?: string | null) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length <= 14 ? text : `${text.slice(0, 8)}...${text.slice(-6)}`;
}

export default function AdminPage() {
  const { authenticated, ready, getAccessToken, login } = usePrivy();
  const [summary, setSummary] = React.useState<UsageSummary | null>(null);
  const [refunds, setRefunds] = React.useState<AdminCreditRefundItem[]>([]);
  const [watcherStatus, setWatcherStatus] = React.useState<CreditWatcherStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<'pending' | 'approved' | 'settled' | 'rejected' | ''>('pending');

  const watcherStatsEntries = React.useMemo(() => (
    Object.entries((watcherStatus?.stats || {}) as Record<string, number>)
      .filter(([, value]) => Number.isFinite(value) && value > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  ), [watcherStatus]);

  const loadAdminData = React.useCallback(async (forceFresh = false) => {
    if (!authenticated) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const nextSummary = await getUsageSummary(token, { forceFresh });
      setSummary(nextSummary);

      if (!nextSummary.admin.canManageRefunds) {
        setRefunds([]);
        setWatcherStatus(null);
        return;
      }

      const [nextRefunds, nextWatcher] = await Promise.all([
        getAdminCreditRefunds(statusFilter, token),
        getCreditWatcherMonitor(token),
      ]);
      setRefunds(nextRefunds);
      setWatcherStatus(nextWatcher);
    } catch (nextError) {
      console.error('Failed to load admin billing data', nextError);
      setError(nextError instanceof Error ? nextError.message : 'Failed to load admin billing data');
    } finally {
      setLoading(false);
    }
  }, [authenticated, getAccessToken, statusFilter]);

  React.useEffect(() => {
    if (!authenticated || !ready) return;
    void loadAdminData();
  }, [authenticated, ready, loadAdminData]);

  const handleApprove = async (refundRequestId: string) => {
    try {
      const token = await getAccessToken();
      const note = window.prompt('Approval note (optional)') || undefined;
      await approveAdminCreditRefund(refundRequestId, note, token);
      toast.success('Refund approved');
      await loadAdminData(true);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Refund approval failed');
    }
  };

  const handleSettle = async (refundRequestId: string) => {
    const payoutTxHash = window.prompt('Payout transaction hash');
    if (!payoutTxHash) return;
    try {
      const token = await getAccessToken();
      const note = window.prompt('Settlement note (optional)') || undefined;
      await settleAdminCreditRefund(refundRequestId, payoutTxHash, note, token);
      toast.success('Refund settled');
      await loadAdminData(true);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Refund settlement failed');
    }
  };

  const handleReject = async (refundRequestId: string) => {
    const failureReason = window.prompt('Rejection reason', 'REFUND_REJECTED');
    if (!failureReason) return;
    try {
      const token = await getAccessToken();
      const note = window.prompt('Rejection note (optional)') || undefined;
      await rejectAdminCreditRefund(refundRequestId, failureReason, note, token);
      toast.success('Refund rejected');
      await loadAdminData(true);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Refund rejection failed');
    }
  };

  if (!ready) {
    return (
      <PageContainer title="Admin" subtitle="Loading admin surface...">
        <div className={styles.emptyState}>Loading...</div>
      </PageContainer>
    );
  }

  if (!authenticated) {
    return (
      <PageContainer title="Admin" subtitle="Sign in to access billing operations.">
        <div className={styles.emptyState}>
          <button className={styles.primaryButton} onClick={() => login()}>
            Sign In
          </button>
        </div>
      </PageContainer>
    );
  }

  if (summary && !summary.admin.canManageRefunds) {
    return (
      <PageContainer title="Admin" subtitle="Restricted operations surface.">
        <div className={styles.restrictedCard}>
          <ShieldAlert size={28} />
          <div>
            <div className={styles.restrictedTitle}>Admin access required</div>
            <div className={styles.restrictedText}>
              Your current account does not have permission to manage credits refunds.
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Admin"
      subtitle="Credits refund operations and Base deposit watcher status."
      actions={(
        <div className={styles.headerActions}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="settled">Settled</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
          <button className={styles.primaryButton} onClick={() => loadAdminData(true)} disabled={loading}>
            Refresh
          </button>
        </div>
      )}
      fullWidth
    >
      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardTitle}>Watcher</div>
          <div className={styles.metaRow}>
            <span>Cursor: {watcherStatus?.cursorBlock || '—'}</span>
            <span>Last webhook: {formatDate(watcherStatus?.lastWebhookAt)}</span>
          </div>
          <div className={styles.metaRow}>
            <span>Last reconciled: {formatDate(watcherStatus?.lastReconciledAt)}</span>
            <span>Address: {shortenHash(watcherStatus?.paymentAddress)}</span>
          </div>
          {watcherStatsEntries.length > 0 ? (
            <div className={styles.chipRow}>
              {watcherStatsEntries.map(([key, value]) => (
                <span key={key} className={styles.chip}>
                  {key}: {value}
                </span>
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>No watcher stats yet.</div>
          )}
        </section>

        <section className={`${styles.card} ${styles.wideCard}`}>
          <div className={styles.cardTitle}>Refund Queue</div>
          <div className={styles.list}>
            {refunds.length === 0 ? (
              <div className={styles.emptyState}>
                {loading ? 'Loading refunds...' : 'No refund requests for this filter.'}
              </div>
            ) : refunds.map((refund) => (
              <div key={refund.id} className={styles.row}>
                <div className={styles.rowBody}>
                  <div className={styles.rowTitle}>
                    {refund.userId} · {refund.assetSymbol} {refund.refundAmountHuman}
                  </div>
                  <div className={styles.rowMeta}>
                    deposit {shortenHash(refund.deposit.txHash)} · to {shortenHash(refund.refundToAddress)}
                  </div>
                  <div className={styles.rowMeta}>
                    status {refund.status} · requested {formatDate(refund.requestedAt)}
                  </div>
                  <div className={styles.rowMeta}>
                    paid {refund.requestedPaidCredits.toFixed(2)} · reclaimed bonus {refund.reclaimedBonusCredits.toFixed(2)}
                  </div>
                </div>
                <div className={styles.actionRow}>
                  {refund.status === 'pending' && (
                    <button className={styles.primaryButton} onClick={() => handleApprove(refund.id)} disabled={loading}>
                      Approve
                    </button>
                  )}
                  {(refund.status === 'pending' || refund.status === 'approved') && (
                    <>
                      <button className={styles.primaryButton} onClick={() => handleSettle(refund.id)} disabled={loading}>
                        Settle
                      </button>
                      <button className={styles.secondaryButton} onClick={() => handleReject(refund.id)} disabled={loading}>
                        Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
