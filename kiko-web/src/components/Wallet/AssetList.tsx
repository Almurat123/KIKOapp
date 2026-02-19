import React from 'react';
import { Skeleton } from '../Skeleton';
import type { TokenHolding } from '../../hooks/useWalletPageData';
import { formatSmartNumber } from '../../utils/format';

// [Logic]: Component to handle image loading errors for token icons.
// [Ref]: Migrated from WalletPage.tsx:L117-L136.
const TokenIcon = ({ src, alt, symbol, chainId, styles }: { src?: string, alt: string, symbol: string, chainId?: number, styles: any }) => {
    const [error, setError] = React.useState(false);
    React.useEffect(() => setError(false), [src]);

    const chainIcons: Record<number, string> = {
        1: '/assets/tokens/eth.png',
        56: '/assets/tokens/bsc.png',
        137: '/assets/tokens/polygon.png',
        8453: '/assets/tokens/base.png',
        42161: '/assets/tokens/arbitrum.png',
        10: '/assets/tokens/optimism.png',
        900: '/assets/tokens/sol.png',
    };

    const renderMainIcon = () => {
        if (!src || error) return <div className={styles.tokenIcon}>{symbol?.[0] || '?'}</div>;
        return <img className={styles.tokenLogo} src={src} alt={alt} onError={() => setError(true)} />;
    };

    return (
        <div className={styles.tokenLogoWrapper}>
            {renderMainIcon()}
            {chainId && chainIcons[chainId] && (
                <img className={styles.chainBadge} src={chainIcons[chainId]} alt="chain" />
            )}
        </div>
    );
};

interface AssetListProps {
    loading: boolean;
    displayHoldings: TokenHolding[];
    showAllAssets: boolean;
    onToggleShowAll?: () => void;
    styles: any;
}

// [Logic]: Separated AssetList to manage complex grid/loading states.
// [Ref]: Migrated from WalletPage.tsx:L1005-L1062.
export const AssetList: React.FC<AssetListProps> = ({ loading, displayHoldings, showAllAssets, onToggleShowAll, styles }) => {
    if (loading) return (
        <div className={styles.cardsGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={styles.assetCard}>
                    <div className={styles.assetTop}><Skeleton variant="circular" width={40} height={40} />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Skeleton variant="text" width="70%" /><Skeleton variant="text" width="50%" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
    if (!loading && displayHoldings.length === 0) return <div className={styles.emptyState}>No assets found.</div>;
    const visible = showAllAssets ? displayHoldings : displayHoldings.slice(0, 10);
    const hasMore = displayHoldings.length > 10;
    return (
        <>
            <div className={styles.cardsGrid}>
                {visible.map((asset, i) => (
                    <div className={styles.assetCard} key={i}>
                        <div className={styles.assetTop}>
                            <TokenIcon
                                src={asset.logo}
                                alt={asset.symbol}
                                symbol={asset.symbol}
                                chainId={asset.chainId}
                                styles={styles}
                            />
                            <div className={styles.tokenInfo}>
                                <div className={styles.tokenName}>{asset.name}</div>
                                <div className={styles.assetBalance}>{formatSmartNumber(asset.balance)} {asset.symbol}</div>
                            </div>
                        </div>
                        <div className={styles.assetRight}>
                            <div className={styles.assetValue}>{asset.value}</div>
                            <div className={styles.assetChange}>{asset.change}</div>
                        </div>
                    </div>
                ))}
            </div>
            {hasMore && (
                <button className={styles.showAllButton} onClick={onToggleShowAll}>
                    {showAllAssets ? 'Show less' : `Show all (${displayHoldings.length})`}
                </button>
            )}
        </>
    );
};
