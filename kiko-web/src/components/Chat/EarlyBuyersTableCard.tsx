import React from 'react';
import styles from './EarlyBuyersTableCard.module.css';

type TradeRow = {
  txHash?: string | null;
  timestamp?: string | null;
  amount?: string | null;
  tokenSymbol?: string | null;
};

type TradeProgression = {
  totalTrades?: number | null;
  buyCount?: number | null;
  sellCount?: number | null;
  firstBuy?: TradeRow | null;
  firstSell?: TradeRow | null;
  recentTrades?: TradeRow[] | null;
};

type EarlyBuyerRow = {
  rank?: number | null;
  address?: string | null;
  timestamp?: string | null;
  amount?: string | null;
  txHash?: string | null;
  estimatedBuyUsd?: number | null;
  qualityTier?: string | null;
  transferCount?: number | null;
  walletTxCount?: number | null;
  tradeProgression?: TradeProgression | null;
};

interface EarlyBuyersTableCardProps {
  data: {
    kind?: string;
    title?: string;
    token?: string;
    chain?: string;
    buyerCount?: number;
    outputMode?: string;
    includeTradeProgression?: boolean;
    tradeHistoryLimit?: number;
    earlyBuyers?: EarlyBuyerRow[];
    rows?: EarlyBuyerRow[];
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatUsd(value?: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatAmount(value?: string | null): string {
  if (!value) return '—';
  return value;
}

function formatProgression(tp?: TradeProgression | null): string {
  if (!tp) return '—';
  const parts = [
    tp.totalTrades !== null && tp.totalTrades !== undefined ? `T${tp.totalTrades}` : null,
    tp.buyCount !== null && tp.buyCount !== undefined ? `B${tp.buyCount}` : null,
    tp.sellCount !== null && tp.sellCount !== undefined ? `S${tp.sellCount}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

function renderTradeCell(trade?: TradeRow | null): React.ReactNode {
  if (!trade) return <span className={styles.emptyCell}>—</span>;
  return (
    <div className={styles.tradeCell}>
      <div className={styles.tradeTime}>{formatDate(trade.timestamp)}</div>
      <div className={styles.tradeMeta}>
        {formatAmount(trade.amount)}
        {trade.tokenSymbol ? ` ${trade.tokenSymbol}` : ''}
      </div>
      {trade.txHash ? <div className={styles.tradeHash}>{trade.txHash}</div> : null}
    </div>
  );
}

export const EarlyBuyersTableCard: React.FC<EarlyBuyersTableCardProps> = ({ data }) => {
  const rows = Array.isArray(data.earlyBuyers) && data.earlyBuyers.length > 0
    ? data.earlyBuyers
    : Array.isArray(data.rows)
      ? data.rows
      : [];

  const chainLabel = data.chain ? String(data.chain).toUpperCase() : 'UNKNOWN';
  const title = data.title || 'Early buyers export';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerCopy}>
          <div className={styles.kicker}>{title}</div>
          <div className={styles.subtitle}>
            {rows.length} rows · {chainLabel}
            {data.includeTradeProgression ? ' · trade progression attached' : ''}
          </div>
        </div>
        <div className={styles.badge}>
          {data.outputMode || 'full_table'}
        </div>
      </div>

      <div className={styles.tableShell}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Wallet Address</th>
              <th>Discovery</th>
              <th>First Buy</th>
              <th>First Sell</th>
              <th>Estimated Buy USD</th>
              <th>Progression</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const progression = row.tradeProgression || null;
              return (
                <tr key={`${row.address || 'row'}-${row.txHash || index}`}>
                  <td className={styles.rank}>{row.rank ?? index + 1}</td>
                  <td>
                    <div className={styles.address}>{row.address || '—'}</div>
                  </td>
                  <td>{renderTradeCell({
                    timestamp: row.timestamp,
                    amount: row.amount,
                    txHash: row.txHash,
                  })}</td>
                  <td>{renderTradeCell(progression?.firstBuy || null)}</td>
                  <td>{renderTradeCell(progression?.firstSell || null)}</td>
                  <td className={styles.amount}>{formatUsd(row.estimatedBuyUsd)}</td>
                  <td className={styles.progression}>{formatProgression(progression)}</td>
                  <td className={styles.tier}>{row.qualityTier || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
