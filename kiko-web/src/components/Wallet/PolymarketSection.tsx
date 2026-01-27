import { ExternalLink } from 'lucide-react';

// [Logic]: Card for active Polymarket positions.
// [Ref]: Migrated from WalletPage.tsx:L1235-L1276.
export const PolymarketOrderCard = ({ order, styles, onSell }: { order: any; styles: any; onSell: () => void }) => {
    const isYes = order.outcome === 'Yes';
    return (
        <div className={styles.orderCard}>
            <div className={styles.orderCardTop}>
                <span className={`${styles.badge} ${isYes ? styles.badgeYes : styles.badgeNo}`}>{order.outcome}</span>
                <button className={styles.moreButton} onClick={() => window.open(`https://polymarket.com/event/${order.market}`, '_blank')}><ExternalLink size={14} /></button>
            </div>
            <h3 className={styles.orderCardTitle}>{order.title}</h3>
            <div className={styles.orderCardStats}>
                <div className={styles.statRow}><span className={styles.statKey}>Value</span><span className={styles.statVal}>${(order.currentValue || 0).toFixed(2)}</span></div>
                <div className={styles.statRow}><span className={styles.statKey}>Avg</span><span className={styles.statVal}>${(order.avgPrice || 0).toFixed(3)}</span></div>
            </div>
            <div className={styles.orderCardFooter}>
                <div className={styles.currentPrice}>${(order.currentPrice || 0).toFixed(2)}</div>
                <div className={`${styles.pnlPercent} ${order.pnl >= 0 ? styles.positive : styles.negative}`}>
                    {order.pnl >= 0 ? '+' : ''}{(order.pnlPercent || 0).toFixed(1)}%
                </div>
                <button className={styles.sellButton} onClick={onSell}>Sell</button>
            </div>
        </div>
    );
};

// [Logic]: List item for past Polymarket trades.
// [Ref]: Migrated from WalletPage.tsx:L1278-L1342.
export const PolymarketHistoryItem = ({ trade, styles }: { trade: any; styles: any }) => {
    const date = new Date(trade.timestamp);
    const isProfit = trade.status === 'WON' || (trade.status === 'SUCCESS' && trade.side === 'SELL');
    return (
        <div className={styles.historyItemNew}>
            <div className={`${styles.dateBadge} ${isProfit ? styles.dateBadge : styles.dateBadgeNeutral}`}>
                <span className={styles.dateMonth}>{date.toLocaleString('en-US', { month: 'short' })}</span>
                <span className={styles.dateDay}>{date.getDate()}</span>
            </div>
            <div className={styles.historyContent}>
                <div className={styles.historyTitle}>{trade.title}</div>
                <div className={styles.historyBadges}><span className={styles.statusBadge}>{trade.side} {trade.outcome}</span></div>
            </div>
            <div className={styles.historyResult}>
                <div className={`${styles.resultAmount} ${isProfit ? styles.positive : styles.negative}`}>${(trade.size * trade.price).toFixed(2)}</div>
                <button className={styles.externalLink} onClick={() => window.open(`https://polymarket.com/event/${trade.market}`, '_blank')}><ExternalLink size={14} /></button>
            </div>
        </div>
    );
};
