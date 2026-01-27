import { ArrowUpRight, ArrowDownLeft, ArrowRightLeft, Shield, ExternalLink } from 'lucide-react';
import { Skeleton } from '../Skeleton';
import type { WalletTransaction } from '../../services/walletApi';
import { formatSmartNumber } from '../../utils/format';

// [Logic]: Specific item for trading history with type-based iconography.
// [Ref]: Migrated from WalletPage.tsx:L1344-L1426.
const TradingHistoryItem = ({ tx, styles, walletAddress }: { tx: any; styles: any; walletAddress: string }) => {
    const isIncoming = tx.txType === 'TRANSFER_IN' || (!tx.txType && tx.to?.toLowerCase() === walletAddress?.toLowerCase());
    const Icon = tx.txType === 'SWAP' ? ArrowRightLeft : (tx.txType === 'APPROVE' ? Shield : (isIncoming ? ArrowDownLeft : ArrowUpRight));
    const title = tx.txType === 'SWAP' ? 'Swap' : (tx.txType === 'APPROVE' ? 'Approve' : (isIncoming ? 'Received' : 'Sent'));
    const shorten = (a: string) => a && a.length > 10 ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;
    const date = new Date(tx.timestamp || Date.now());

    return (
        <div className={styles.historyItemNew}>
            <div className={styles.dateBadge}><Icon size={14} style={{ color: '#a1a1aa' }} /></div>
            <div className={styles.historyContent}>
                <div className={styles.historyTitle}>{title} {tx.amount} {tx.symbol || tx.tokenSymbol}</div>
                <div className={styles.historyBadges}>
                    <span className={styles.statusBadge}>{isIncoming ? 'From' : 'To'}: {shorten(isIncoming ? tx.from : tx.to)}</span>
                    <div className={styles.dot} /><span className={styles.statusBadge}>{date.toLocaleString()}</span>
                </div>
            </div>
            <div className={styles.historyResult}>
                <div className={styles.resultAmount}>{isIncoming ? '+' : '-'}{formatSmartNumber(tx.amount || '0')}</div>
                {tx.hash && <button onClick={() => window.open((tx.from?.startsWith('0x') ? 'https://etherscan.io/tx/' : 'https://solscan.io/tx/') + tx.hash)} className={styles.externalLink}><ExternalLink size={12} /></button>}
            </div>
        </div>
    );
};

export const TransactionList = ({ loading, transactions, styles, walletAddress }: { loading: boolean; transactions: WalletTransaction[]; styles: any; walletAddress: string }) => {
    if (loading) return <div className={styles.historyList}>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="rectangular" width="100%" height={64} borderRadius={20} />)}</div>;
    if (transactions.length === 0) return <div className={styles.emptyState}>No transactions found.</div>;
    return <div className={styles.historyList}>{transactions.map((tx, i) => <TradingHistoryItem key={i} tx={tx} styles={styles} walletAddress={walletAddress} />)}</div>;
};
