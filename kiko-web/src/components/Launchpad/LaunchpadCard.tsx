import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { Search } from 'lucide-react';

const UnifiedChartCardLazy = React.lazy(() =>
    import('../Chart/UnifiedChartCard').then((mod) => ({ default: mod.UnifiedChartCard }))
);
import styles from './LaunchpadCard.module.css';
import { getZoraToken, type ZoraToken } from '../../services/zoraApi';
import { getClankerToken, type ClankerToken } from '../../services/clankerApi';
import { getFourMemeToken, type FourMemeToken } from '../../services/fourMemeApi';
import { getPumpFunToken, type PumpFunToken } from '../../services/pumpFunApi';
import snakeLogo from '../../assets/images/gecko-terminal.png';
import owlLogo from '../../assets/images/dex-screener.png';
import zorbLogo from '../../assets/images/Zorb.svg';
import bonkFunLogo from '../../assets/images/BonkFun.png';

import clankerLogo from '../../assets/images/ClankerOG.png';
import fourMemeLogo from '../../assets/images/FourMeme.png';
import pumpFunLogo from '../../assets/images/PumpFun.png';
import paragraphLogo from '../../assets/images/Paragraph.png';
import { getRaydiumToken, type RaydiumToken } from '../../services/raydiumApi';
import { tokenApi } from '../../services/api';

interface ParagraphToken {
    id: string;
    contractAddress: string;
    symbol: string;
    postId: string;
    name?: string;
    image?: string;
    description?: string;
    createdAt?: number;
}

interface LaunchpadCardProps {
    tokenAddress?: string;
    chainId?: number;
    platformName?: string;
    provider?: 'zora' | 'clanker' | 'paragraph' | 'fourmeme' | 'pumpfun' | 'raydium' | 'bonkfun';
    initialData?: any;
}

export const LaunchpadCard: React.FC<LaunchpadCardProps> = ({
    tokenAddress,
    chainId,
    platformName = "Zora",
    provider = 'zora',
    initialData
}) => {
    const [token, setToken] = useState<ZoraToken | null>(null);
    const [clankerToken, setClankerToken] = useState<ClankerToken | null>(null);
    const [paragraphToken, setParagraphToken] = useState<ParagraphToken | null>(null);
    const [fourMemeToken, setFourMemeToken] = useState<FourMemeToken | null>(null);
    const [pumpFunToken, setPumpFunToken] = useState<PumpFunToken | null>(null);
    const [raydiumToken, setRaydiumToken] = useState<RaydiumToken | null>(null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<string | null>(null);
    const [isChartExpanded, setIsChartExpanded] = useState(false);
    const [chartTab, setChartTab] = useState<'dex' | 'gecko'>('dex');
    const [shouldRenderChart, setShouldRenderChart] = useState(false);
    // Initialize with initialData if provided
    useEffect(() => {
        if (initialData) {
            if (provider === 'zora') setToken(initialData);
            else if (provider === 'clanker') setClankerToken(initialData);
            else if (provider === 'paragraph') setParagraphToken(initialData);
            else if (provider === 'fourmeme') setFourMemeToken(initialData);
            else if (provider === 'pumpfun') setPumpFunToken(initialData);
            else if (provider === 'raydium' || provider === 'bonkfun') setRaydiumToken(initialData);
            setLoading(false);
        }
    }, [initialData, provider]);

    // Fetch real token data
    useEffect(() => {
        if (!tokenAddress || initialData) return; // Skip fetch if initialData exists

        async function fetchToken() {
            try {
                setLoading(true);
                setError(null);

                if (provider === 'zora') {
                    const data = await getZoraToken(tokenAddress!, chainId);
                    if (data) {
                        setToken(data);
                    } else {
                        setError('Token data not available');
                    }
                } else if (provider === 'clanker') {
                    const data = await getClankerToken(tokenAddress!);
                    if (data) {
                        setClankerToken(data);
                    } else {
                        setError('Clanker token not found');
                    }
                } else if (provider === 'paragraph') {
                    try {
                        const result = await tokenApi.detectParagraphToken(tokenAddress!);
                        if (result && result.provider === 'paragraph' && result.data) {
                            setParagraphToken(result.data as ParagraphToken);
                        } else {
                            setError('Paragraph token not found');
                        }
                    } catch (err: any) {
                        console.error('[LaunchpadCard] Paragraph detection error:', err);
                        setError(err?.message || 'Failed to load Paragraph token');
                    }
                } else if (provider === 'fourmeme') {
                    const data = await getFourMemeToken(tokenAddress!);
                    if (data) {
                        setFourMemeToken(data);
                    } else {
                        setError('Four.meme token not found');
                    }
                } else if (provider === 'pumpfun') {
                    const data = await getPumpFunToken(tokenAddress!);
                    if (data) {
                        setPumpFunToken(data);
                    } else {
                        setError('Pump.fun token not found');
                    }
                } else if (provider === 'raydium' || provider === 'bonkfun') {
                    const data = await getRaydiumToken(tokenAddress!);
                    if (data) {
                        setRaydiumToken(data);
                    } else {
                        setError('Token not found');
                    }
                }

            } catch (err) {
                console.error('Failed to fetch launchpad token:', err);
                setError('Failed to load token');
            } finally {
                setLoading(false);
            }
        }
        fetchToken();
    }, [tokenAddress, chainId, provider]);

    // Helper: Dynamic Platform Links
    const getExplorerUrl = (address: string) => {
        if (chainId === 8453) return `https://basescan.org/address/${address}`;
        if (chainId === 7777777) return `https://explorer.zora.energy/address/${address}`;
        if (provider === 'fourmeme') return `https://bscscan.com/token/${address}`;
        if (provider === 'pumpfun') return `https://solscan.io/token/${address}`;
        if (provider === 'raydium' || provider === 'bonkfun') return `https://solscan.io/token/${address}`;
        return `https://etherscan.io/address/${address}`;
    };

    const getTokenAvatar = (t: ZoraToken | null) => {
        if (!t) return undefined;
        try {
            if (t.mediaContent?.previewImage?.medium) return t.mediaContent.previewImage.medium;
            if (t.mediaContent?.previewImage?.small) return t.mediaContent.previewImage.small;
            if (t.mediaContent?.image?.medium) return t.mediaContent.image.medium;
            if (t.mediaContent?.image?.small) return t.mediaContent.image.small;
        } catch (e) {
            console.warn('Error parsing token avatar', e);
        }
        return `https://api.dicebear.com/7.x/shapes/svg?seed=${t.symbol || 'token'}&backgroundColor=4f46e5,7c3aed&scale=80`;
    };

    const tokenAvatar = getTokenAvatar(token);

    // For Solana launchpads (Pump.fun, Raydium), set SOL as the sell token
    const isSolanaLaunchpad = provider === 'pumpfun' || provider === 'raydium' || provider === 'bonkfun';
    const isBscLaunchpad = provider === 'fourmeme';
    const isBaseLaunchpad = provider === 'clanker' || provider === 'zora' || provider === 'paragraph';

    // Compute effective chain ID based on provider if not provided
    const effectiveChainId = useMemo(() => {
        return chainId
            || (isSolanaLaunchpad ? 900 : (isBscLaunchpad ? 56 : (isBaseLaunchpad ? 8453 : 1)));
    }, [chainId, isBaseLaunchpad, isBscLaunchpad, isSolanaLaunchpad]);

    const [secondaryAvatar, setSecondaryAvatar] = useState<string | null>(null);

    // Effect: Fetch secondary avatar (DexScreener/Gecko) if primary is missing
    useEffect(() => {
        if (!tokenAddress || !effectiveChainId) return;

        // If we already have a good avatar from initialData or provider token, skip fetch
        // (This logic needs to mirror the "avatar" derivation below to be accurate)
        let hasAvatar = false;
        if (initialData && (initialData.image || initialData.data?.image || initialData.data?.img_url || initialData.data?.logoURI || initialData.img_url || initialData.image_url || initialData.image_uri)) hasAvatar = true;
        else if (provider === 'clanker' && clankerToken?.img_url) hasAvatar = true;
        else if (provider === 'paragraph' && paragraphToken?.image) hasAvatar = true;
        else if (provider === 'fourmeme' && fourMemeToken?.image) hasAvatar = true;
        else if (provider === 'pumpfun' && pumpFunToken?.image_uri) hasAvatar = true;
        else if ((provider === 'raydium' || provider === 'bonkfun') && raydiumToken?.image_uri) hasAvatar = true;

        if (hasAvatar) return;

        // Map chainId to API network strings
        const networkMap: Record<number, string> = {
            1: 'eth',
            8453: 'base',
            56: 'bsc',
            900: 'solana', // Internal ID for Solana
            137: 'polygon',
            42161: 'arbitrum',
            10: 'optimism',
            43114: 'avax'
        };

        const network = networkMap[effectiveChainId] || 'eth';

        async function fetchSecondary() {
            try {
                // DexScreener often indexes tokens faster/better for images
                const details = await tokenApi.getDetails(network, tokenAddress!);
                if (details && details.imageUrl) {
                    setSecondaryAvatar(details.imageUrl);
                }
            } catch (_e) {
                // Ignore errors
            }
        }

        fetchSecondary();
    }, [tokenAddress, effectiveChainId, provider, initialData, clankerToken, paragraphToken, fourMemeToken, pumpFunToken, raydiumToken]);







    // --- Renders ---


    // Determine Avatar
    let avatar = tokenAvatar;

    // PRIORITY 1: Check initialData first (Backend source of truth)
    // NOTE: initialData IS the token object directly (passed as message.data.data in MessageBubble)
    // So we check initialData.img_url, NOT initialData.data.img_url
    if (initialData) {
        // Try all possible image field names that different APIs might use
        avatar = initialData.img_url        // Clanker API field
            || initialData.image_url      // Alternative field name
            || initialData.image          // Zora, Paragraph field
            || initialData.image_uri      // PumpFun, Raydium field
            || initialData.logoURI        // Generic token field
            || avatar;                    // Keep fallback
    }

    // PRIORITY 2: Override with provider-specific data ONLY if it exists and has an image
    // This handles cases where we fetch fresh data that might have a better image
    if (provider === 'clanker' && clankerToken) {
        const clankerImg = clankerToken.img_url || (clankerToken as any).image_url || (clankerToken as any).image;
        if (clankerImg) avatar = clankerImg;
    }
    else if (provider === 'paragraph' && paragraphToken) {
        const paraImg = paragraphToken.image || (paragraphToken as any).img_url;
        if (paraImg) avatar = paraImg;
    }
    else if (provider === 'fourmeme' && fourMemeToken) {
        const memeImg = fourMemeToken.image || (fourMemeToken as any).logoURI;
        if (memeImg) avatar = memeImg;
    }
    else if (provider === 'pumpfun' && pumpFunToken) {
        const pumpImg = pumpFunToken.image_uri || (pumpFunToken as any).image;
        if (pumpImg) avatar = pumpImg;
    }
    else if ((provider === 'raydium' || provider === 'bonkfun') && raydiumToken) {
        const rayImg = raydiumToken.image_uri || (raydiumToken as any).logoURI || (raydiumToken as any).image;
        if (rayImg) avatar = rayImg;
    }

    // PRIORITY 3: Secondary Avatar (Fetched asynchronously from DexScreener/Gecko)
    if (!avatar && secondaryAvatar) {
        avatar = secondaryAvatar;
    }


    // Helper for safe access based on provider types via union discrimination (or simple casting)
    let safeSymbol = 'TOKEN';
    let safeName = 'Unknown Token';
    let safeAddress: string | undefined;

    let displayDate = 'Recently';

    if (provider === 'zora' && token) {
        safeSymbol = token.symbol;
        safeName = token.name;
        safeAddress = token.address;

        if (token.createdAt) {
            try { displayDate = new Date(token.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { /* ignore */ }
        }
    } else if (provider === 'clanker' && clankerToken) {
        safeSymbol = clankerToken.symbol;
        safeName = clankerToken.name;
        safeAddress = clankerToken.contract_address;

        if (clankerToken.deployed_at) {
            try { displayDate = new Date(clankerToken.deployed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { /* ignore */ }
        }
    } else if (provider === 'paragraph' && paragraphToken) {
        safeSymbol = paragraphToken.symbol;
        safeName = paragraphToken.name || paragraphToken.symbol;
        safeAddress = paragraphToken.contractAddress;

        if (paragraphToken.createdAt) {
            try { displayDate = new Date(paragraphToken.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { /* ignore */ }
        } else {
            displayDate = 'Recently';
        }
    } else if (provider === 'fourmeme' && fourMemeToken) {
        safeSymbol = fourMemeToken.shortName; // Using shortName as symbol for Four.meme
        safeName = fourMemeToken.name;
        safeAddress = fourMemeToken.address;

        // The API returns createDate, but our backend maps it to createdAt as well for consistency
        const mTime = fourMemeToken.createdAt || (fourMemeToken as any).createDate;
        if (mTime) {
            try { displayDate = new Date(Number(mTime)).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { /* ignore */ }
        }
    } else if (provider === 'pumpfun' && pumpFunToken) {
        safeSymbol = pumpFunToken.symbol;
        safeName = pumpFunToken.name;
        safeAddress = pumpFunToken.mint;

        if (pumpFunToken.created_timestamp) {
            try { displayDate = new Date(pumpFunToken.created_timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { /* ignore */ }
        }
    } else if ((provider === 'raydium' || provider === 'bonkfun') && raydiumToken) {
        safeSymbol = raydiumToken.symbol;
        safeName = raydiumToken.name;
        safeAddress = raydiumToken.mint;

        if (raydiumToken.created_at) {
            try { displayDate = new Date(raydiumToken.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { /* ignore */ }
        }
    }



    // Chart rendering guard to avoid heavy iframe load when address missing or quickly toggled
    useEffect(() => {
        if (isChartExpanded && safeAddress) {
            const timeout = window.setTimeout(() => setShouldRenderChart(true), 80);
            return () => window.clearTimeout(timeout);
        }
        setShouldRenderChart(false);
    }, [isChartExpanded, safeAddress]);

    const chartChain = useMemo(() => {
        if (provider === 'pumpfun' || provider === 'raydium' || provider === 'bonkfun') return 'solana';
        if (provider === 'fourmeme') return 'bsc';
        if (provider === 'clanker' || provider === 'zora' || provider === 'paragraph') return 'base';
        if (chainId === 8453) return 'base';
        if (chainId === 56) return 'bsc';
        if (chainId === 900) return 'solana';
        return 'ethereum';
    }, [chainId, provider]);

    const chartDisabled = !safeAddress;

    // --- Renders ---
    if (error) {
        return (
            <div className={`${styles.card} flex items-center justify-center text-red-400 p-6 text-center text-sm border-red-500/20 bg-red-500/5`}>
                <div className="flex flex-col items-center gap-2">
                    <span>⚠️</span>
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    if (loading || (!token && provider === 'zora') || (!clankerToken && provider === 'clanker') || (!fourMemeToken && provider === 'fourmeme') || (!pumpFunToken && provider === 'pumpfun') || (!raydiumToken && provider === 'raydium')) {
        return (
            <div className={`${styles.card} ${styles.skeletonPulse}`}>
                <div className={styles.avatarContainer}>
                    <div className="w-full h-full rounded-md bg-white/5 animate-pulse" />
                </div>
                <div className={styles.content}>
                    <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse mb-3" />
                    <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
                </div>
            </div>
        );
    }


    // Front Content
    const cardContent = (
        <div className={styles.card}>
            {/* Top-Left Platform Link (Resized) */}
            <a
                href={provider === 'zora' ? "https://zora.co" : (provider === 'clanker' ? "https://clanker.world" : (provider === 'fourmeme' ? "https://four.meme" : (provider === 'pumpfun' ? "https://pump.fun" : (provider === 'raydium' || provider === 'bonkfun' ? "https://bonkfun.com" : "https://paragraph.xyz"))))}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-4 left-4 z-20 transition-transform hover:scale-110"
                style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 20 }}
                title={`Go to ${provider === 'zora' ? 'Zora' : (provider === 'clanker' ? 'Clanker' : (provider === 'fourmeme' ? 'Four.meme' : (provider === 'pumpfun' ? 'Pump.fun' : (provider === 'raydium' || provider === 'bonkfun' ? 'BonkFun' : 'Paragraph'))))}`}
            >
                {provider === 'zora' ? (
                    <img
                        src={zorbLogo}
                        alt="Zora"
                        className="w-7 h-7 rounded-full shadow-lg border border-white/10"
                        style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                ) : provider === 'clanker' ? (
                    <img
                        src={clankerLogo}
                        alt="Clanker"
                        className="w-7 h-7 rounded-full shadow-lg border border-white/10"
                        style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                ) : provider === 'fourmeme' ? (
                    <img
                        src={fourMemeLogo}
                        alt="Four.meme"
                        className="w-7 h-7 rounded-full shadow-lg border border-white/10"
                        style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                ) : provider === 'pumpfun' ? (
                    <img
                        src={pumpFunLogo}
                        alt="Pump.fun"
                        className="w-7 h-7 rounded-full shadow-lg border border-white/10"
                        style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                ) : (provider === 'raydium' || provider === 'bonkfun') ? (
                    <img
                        src={bonkFunLogo}
                        alt="BonkFun"
                        className="w-7 h-7 rounded-full shadow-lg border border-white/10"
                        style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                ) : (
                    <img
                        src={paragraphLogo}
                        alt="Paragraph"
                        className="w-7 h-7 rounded-full shadow-lg border border-white/10"
                        style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                )}
            </a>

            {/* Avatar Section */}
            <div className={styles.avatarContainer}>
                {/* Background Blur */}
                {avatar && (
                    <div
                        className={styles.blurBackground}
                        style={{ backgroundImage: `url(${avatar})` }}
                    />
                )}

                {/* Main Avatar */}
                <div className="relative z-10 group cursor-pointer" style={{ position: 'relative', zIndex: 10 }}>
                    <img
                        src={avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${safeAddress}`}
                        alt={safeName}
                        className={styles.tokenAvatar}
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/shapes/svg?seed=${safeAddress}`;
                        }}
                    />
                </div>
            </div>

            {/* Content Section (Restored) */}
            <div className={styles.content}>
                <div className={styles.mainInfo}>
                    <div className="text-center w-full px-1">
                        <h3 className={styles.tokenName}>${safeSymbol}</h3>

                        {/* Compact Info Row */}
                        <div className="flex flex-col items-center gap-0.5 mt-1">
                            <div className={styles.creatorRow}>
                                <a
                                    href={getExplorerUrl(safeAddress || '')}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={styles.addressLink}
                                    title={safeAddress}
                                >
                                    {safeAddress ? `${safeAddress.slice(0, 6)}...${safeAddress.slice(-4)}` : 'Unknown'}
                                </a>
                            </div>
                            <span className={`${styles.mutedText} text-[10px]`}>Created {displayDate}</span>
                        </div>
                    </div>
                </div>

                {/* Platform Info */}
                <div className="flex items-center justify-center gap-2 mt-4 opacity-70">
                    <span className={`${styles.infoText} text-[11px]`}>
                        Launched on {
                            provider === 'zora' ? 'Zora' :
                                provider === 'clanker' ? 'Clanker' :
                                    provider === 'fourmeme' ? 'Four.meme' :
                                        provider === 'pumpfun' ? 'Pump.fun' :
                                            provider === 'raydium' || provider === 'bonkfun' ? 'BonkFun' :
                                                provider === 'paragraph' ? 'Paragraph' :
                                                    platformName
                        } Network
                    </span>
                </div>

                {/* Actions */}
                <div className={styles.actionContainer}>
                    <div className={styles.chartRow}>
                        <button
                            onClick={() => {
                                if (chartDisabled) return;
                                if (isChartExpanded && chartTab === 'gecko') {
                                    setIsChartExpanded(false);
                                } else {
                                    setChartTab('gecko');
                                    setIsChartExpanded(true);
                                }
                            }}
                            disabled={chartDisabled}
                            aria-disabled={chartDisabled}
                            className={`${styles.chartBtn} ${isChartExpanded && chartTab === 'gecko' ? 'bg-[#5B8DEF] !text-white' : ''} ${chartDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <img
                                src={snakeLogo}
                                alt="GT"
                                className="w-4 h-4 mr-2 rounded-full"
                                style={{ width: 16, height: 16, marginRight: 6, borderRadius: '50%' }}
                            />
                            GeckoTerminal
                        </button>
                        <button
                            onClick={() => {
                                if (chartDisabled) return;
                                if (isChartExpanded && chartTab === 'dex') {
                                    setIsChartExpanded(false);
                                } else {
                                    setChartTab('dex');
                                    setIsChartExpanded(true);
                                }
                            }}
                            disabled={chartDisabled}
                            aria-disabled={chartDisabled}
                            className={`${styles.chartBtn} ${isChartExpanded && chartTab === 'dex' ? 'bg-[#5B8DEF] !text-white' : ''} ${chartDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <img
                                src={owlLogo}
                                alt="DS"
                                className="w-4 h-4 mr-2 rounded-full"
                                style={{ width: 16, height: 16, marginRight: 6, borderRadius: '50%' }}
                            />
                            DexScreener
                        </button>
                    </div>

                    {/* X Search Button */}
                    <a
                        href={`https://x.com/search?q=$${safeSymbol}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.xSearchBtn}
                    >
                        <Search size={16} className={`mr-1.5 ${styles.mutedText}`} />
                        <span className="mr-1.5">Search ${safeSymbol} on</span>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="opacity-90">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                    </a>

                    {/* Swap Button - Triggers AI chat */}
                    <button
                        onClick={() => {
                            setIsChartExpanded(false);
                            // Dispatch custom event to trigger AI chat with token info
                            const event = new CustomEvent('kiko-swap-request', {
                                detail: {
                                    tokenAddress: safeAddress,
                                    tokenSymbol: safeSymbol,
                                    tokenName: safeName,
                                    chainId: effectiveChainId,
                                    provider: provider,
                                }
                            });
                            window.dispatchEvent(event);
                        }}
                        className={styles.swapBtn}
                    >
                        Swap
                    </button>
                </div>
            </div>

            {/* Expandable Chart Section */}
            {isChartExpanded && (
                <div className="mt-3 w-full animate-in fade-in slide-in-from-top-4 duration-300">
                    {!safeAddress ? (
                        <div className="w-full rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                            Token address unavailable; cannot load chart.
                        </div>
                    ) : shouldRenderChart ? (
                        <Suspense fallback={
                            <div className={`w-full rounded-md border border-white/10 p-4 text-center ${styles.mutedText}`}>
                                Loading chart...
                            </div>
                        }>
                            <UnifiedChartCardLazy
                                chain={chartChain}
                                tokenAddress={safeAddress}
                                initialTab={chartTab}
                            />
                        </Suspense>
                    ) : (
                        <div className="w-full rounded-md border border-white/10 bg-black/30 p-4 text-center text-white/70">
                            Preparing chart...
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    return (
        <div className={`${styles.scene} ${isChartExpanded ? styles.sceneExpanded : ''}`}>
            <div className={`${styles.cardInner} ${isChartExpanded ? styles.cardInnerExpanded : ''}`}>
                <div className={`${styles.faceFront} ${isChartExpanded ? styles.faceFrontExpanded : ''} ${styles.faceActive}`}>
                    {cardContent}
                </div>
            </div>
        </div>
    );
};
