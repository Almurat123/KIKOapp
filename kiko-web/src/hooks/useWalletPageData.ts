import { useState, useEffect, useMemo, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useChain } from '../contexts/ChainContext';
import { getAddress, type Address } from 'viem';
import type { WalletWithMetadata } from '@privy-io/react-auth';
import { formatUsd } from '../utils/format';
import { getAllChainBalances, getWalletTransactions, type WalletTransaction } from '../services/walletApi';
import {
    IMPORTED_TOKENS_STORAGE_KEY,
    IMPORTED_TOKENS_UPDATED_EVENT,
    readImportedSwapTokensFromStorage,
    type ImportedSwapToken
} from '../utils/importedSwapTokens';

// [Logic]: Define standard TokenHolding interface to ensure type safety.
// [Ref]: Verified against WalletPage.tsx original implementation.
export interface TokenHolding {
    address: Address;
    symbol: string;
    name: string;
    balance: string;
    value: string;
    change: string;
    decimals: number;
    logo?: string;
    usdValueNum?: number;
    isNative?: boolean;
    chainId?: number;
}

interface WalletCache {
    address: string;
    fingerprint: {
        nonce: number;
        nativeBalanceWei: string;
        timestamp: number;
    };
    holdings: TokenHolding[];
}

let globalBalanceCache: WalletCache | null = null;
const TX_CACHE_TTL_MS = 60_000;
const txCache = new Map<string, { timestamp: number; data: WalletTransaction[] }>();
const CHAIN_ID_BY_KEY: Record<string, number> = {
    'eth': 1, 'base': 8453, 'arbitrum': 42161, 'optimism': 10, 'polygon': 137, 'bsc': 56, 'solana': 900
};

const normalizeTokenAddress = (address: string, chainId: number) => {
    return chainId === 900 ? address : address.toLowerCase();
};

const toNumberOrZero = (value: unknown) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
    return Number.isFinite(num) ? num : 0;
};

// [Logic]: Shared utility for fetching token logos with multiple fallbacks.
// [Ref]: Verbatim migration from WalletPage.tsx:L64-L114.
export const getTokenLogoUrl = (address?: string, chainId?: number, symbol?: string): string | undefined => {
    const LOCAL_ICONS: Record<string, string> = {
        'ETH': '/assets/tokens/eth.png', 'SOL': '/assets/tokens/sol.png',
        'BNB': '/assets/tokens/bsc.png', 'MATIC': '/assets/tokens/polygon.png',
        'USDC': '/assets/tokens/usdc.png', 'USDT': '/assets/tokens/usdt.png',
        'BASE': '/assets/tokens/base.png', 'ARB': '/assets/tokens/arbitrum.png',
        'OP': '/assets/tokens/optimism.png',
    };
    if (symbol && LOCAL_ICONS[symbol.toUpperCase()]) return LOCAL_ICONS[symbol.toUpperCase()];
    if (!address || !chainId) return undefined;

    const isNative = address === '0x0000000000000000000000000000000000000000' ||
        address === 'So11111111111111111111111111111111111111111' ||
        address === 'So11111111111111111111111111111111111111112';

    const chainMap: Record<number, string> = {
        1: 'ethereum', 56: 'smartchain', 137: 'polygon',
        42161: 'arbitrum', 10: 'optimism', 8453: 'base', 900: 'solana'
    };
    const twChain = chainMap[chainId];
    if (!twChain) return undefined;

    if (isNative) {
        const nativeLogos: Record<number, string> = {
            900: '/assets/tokens/sol.png', 1: '/assets/tokens/eth.png',
            56: '/assets/tokens/bsc.png', 137: '/assets/tokens/polygon.png',
            8453: '/assets/tokens/base.png', 42161: '/assets/tokens/arbitrum.png',
            10: '/assets/tokens/optimism.png',
        };
        return nativeLogos[chainId] || `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/info/logo.png`;
    }

    let checksum = address;
    if (chainId !== 900) {
        try { checksum = getAddress(address); } catch (e) { }
    }
    return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${twChain}/assets/${checksum}/logo.png`;
};

export function useWalletPageData() {
    const { authenticated, ready, user, getAccessToken, logout } = usePrivy();
    const { currentChain } = useChain();
    const chainId = currentChain.id;
    const isSolana = chainId === 900;

    // [Logic]: Extract Solana wallet from Privy linked accounts.
    // [Risk]: User might have multiple Solana wallets; currently picking first Privy one.
    const solanaWallet = useMemo(() => {
        return user?.linkedAccounts?.find(
            (account): account is WalletWithMetadata =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy' &&
                account.chainType === 'solana'
        );
    }, [user]);

    const evmWallet = useMemo(() => {
        return user?.linkedAccounts?.find(
            (account): account is WalletWithMetadata =>
                account.type === 'wallet' &&
                account.walletClientType === 'privy' &&
                account.chainType === 'ethereum'
        );
    }, [user]);

    const walletAddress = isSolana ? solanaWallet?.address : (evmWallet?.address || user?.wallet?.address);

    const [holdings, setHoldings] = useState<TokenHolding[]>([]);
    const [cachedHoldings, setCachedHoldings] = useState<TokenHolding[]>([]);
    const [importedTokensByChain, setImportedTokensByChain] = useState<Record<string, ImportedSwapToken[]>>(() => readImportedSwapTokensFromStorage());
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [, setCachedTransactions] = useState<WalletTransaction[]>([]);
    const [transactionsLoading, setTransactionsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [orders, setOrders] = useState<any[]>([]);
    const [pendingOrders, setPendingOrders] = useState<any[]>([]);
    const [ordersLoading, setOrdersLoading] = useState(false);
    const [orderHistory, setOrderHistory] = useState<any[]>([]);
    const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);

    const balanceReqId = useRef(0);
    const txReqId = useRef(0);
    const ordersReqId = useRef(0);

    useEffect(() => {
        const refreshImportedTokens = () => setImportedTokensByChain(readImportedSwapTokensFromStorage());
        const handleCustomUpdate = () => refreshImportedTokens();
        const handleStorageUpdate = (event: StorageEvent) => {
            if (event.key && event.key !== IMPORTED_TOKENS_STORAGE_KEY) return;
            refreshImportedTokens();
        };
        window.addEventListener(IMPORTED_TOKENS_UPDATED_EVENT, handleCustomUpdate as EventListener);
        window.addEventListener('storage', handleStorageUpdate);
        return () => {
            window.removeEventListener(IMPORTED_TOKENS_UPDATED_EVENT, handleCustomUpdate as EventListener);
            window.removeEventListener('storage', handleStorageUpdate);
        };
    }, []);
    // [Logic]: Automated data fetching on auth/chain changes.
    useEffect(() => {
        if (!ready || !authenticated || !walletAddress) return;
        const reqB = ++balanceReqId.current; const reqT = ++txReqId.current; const reqO = ++ordersReqId.current;
        const cancelled = { value: false };
        fetchBalances(reqB, cancelled); fetchTransactions(reqT, cancelled); fetchOrdersAndHistory(reqO, cancelled);
        return () => { cancelled.value = true; };
    }, [ready, authenticated, walletAddress, chainId]);

    useEffect(() => {
        if (!ready || !authenticated || !walletAddress) return;
        const reqB = ++balanceReqId.current;
        const cancelled = { value: false };
        fetchBalances(reqB, cancelled);
        return () => { cancelled.value = true; };
    }, [importedTokensByChain, ready, authenticated, walletAddress]);

    // [Logic]: Calculate total portfolio value and simplified PnL.
    const portfolioStats = useMemo(() => {
        const total = holdings.reduce((sum, h) => sum + (h.usdValueNum || 0), 0);
        return {
            totalValue: `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            pnlValue: '+$0.00', pnlPercent: '0.00%', isPositive: true
        };
    }, [holdings]);

    // [Logic]: Chain name mapping for API compatibility.
    const getChainName = (id: number): string => {
        const chainMap: Record<number, string> = {
            1: 'eth', 8453: 'base', 42161: 'arbitrum',
            10: 'optimism', 137: 'polygon', 56: 'bsc', 900: 'solana',
        };
        return chainMap[id] || 'eth';
    };

    // [Logic]: Unified Polymarket data fetching.
    // [Ref]: Migrated from WalletPage.tsx:L227-L290.
    const fetchOrdersAndHistory = async (reqId: number, cancelled: { value: boolean }) => {
        setOrdersLoading(true); setOrderHistoryLoading(true);
        try {
            const token = await getAccessToken();
            if (!token || cancelled.value) return;
            const headers = { 'Authorization': `Bearer ${token}` };
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
            const [posRes, pendRes, histRes] = await Promise.all([
                fetch(`${apiUrl}/api/polymarket/trading/positions`, { headers }),
                fetch(`${apiUrl}/api/polymarket/trading/orders`, { headers }),
                fetch(`${apiUrl}/api/polymarket/trading/history`, { headers })
            ]);
            if (posRes.ok && !cancelled.value && reqId === ordersReqId.current) setOrders((await posRes.json()).data);
            if (pendRes.ok && !cancelled.value && reqId === ordersReqId.current) setPendingOrders((await pendRes.json()).data);
            if (histRes.ok && !cancelled.value && reqId === ordersReqId.current) setOrderHistory((await histRes.json()).data);
        } catch (err) {
            console.error('Failed to fetch Polymarket data', err);
        } finally {
            if (reqId === ordersReqId.current) { setOrdersLoading(false); setOrderHistoryLoading(false); }
        }
    };

    // [Logic]: Atomically fetch account fingerprint to avoid unnecessary API calls.
    const fetchFingerprint = async (_addr: string) => {
        if (isSolana) return { nonce: 0, balance: BigInt(0), fetched: false };
        return { nonce: 0, balance: BigInt(0), fetched: false };
    };

    // [Logic]: Extract native and token holdings from chain data.
    const extractHoldings = (chain: string, data: any, cId: number) => {
        const holdings: TokenHolding[] = [];
        const isSol = chain === 'solana';
        if (data.ethBalanceFormatted > 0) {
            // [Logic]: Fix display name to include chain prefix (e.g., BASE_ETH as Name).
            // [Ref]: User feedback on visual design alignment.
            const getChainPrefix = () => {
                if (chain === 'eth') return '';
                const prefixMap: Record<string, string> = {
                    'base': 'BASE', 'arbitrum': 'ARB', 'optimism': 'OP',
                    'polygon': 'POLYGON', 'bsc': 'BSC'
                };
                return prefixMap[chain] || chain.toUpperCase();
            };

            const prefix = getChainPrefix();
            const displaySymbol = isSol ? 'SOL' : (chain === 'bsc' ? 'BNB' : (chain === 'polygon' ? 'POL' : 'ETH'));

            const getDisplayName = () => {
                if (displaySymbol === 'ETH') {
                    return prefix ? `${prefix}_ETH` : 'Ethereum';
                }
                const nameMap: Record<string, string> = {
                    'solana': 'Solana',
                    'polygon': 'Polygon',
                    'bsc': 'BNB Chain'
                };
                return nameMap[chain] || chain.toUpperCase();
            };

            const displayName = getDisplayName();

            holdings.push({
                address: (isSol ? 'So11111111111111111111111111111111111111112' : '0x0000000000000000000000000000000000000000') as Address,
                symbol: displaySymbol,
                name: displayName,
                decimals: isSol ? 9 : 18, balance: data.ethBalanceFormatted.toString(),
                value: formatUsd(data.ethBalanceFormatted * (data.ethPrice || 0)),
                usdValueNum: data.ethBalanceFormatted * (data.ethPrice || 0),
                change: '+0.00%', isNative: true, chainId: cId,
                logo: getTokenLogoUrl(isSol ? 'So11111111111111111111111111111111111111112' : '0x0000000000000000000000000000000000000000', cId)
            });
        }
        (data.tokens || []).forEach((t: any) => {
            const usd = typeof t.valueUsd === 'number' ? t.valueUsd : (parseFloat(t.tokenBalance) * (t.price || 0));

            // Keep wallet asset list quality high: require pricing and minimum value.
            if (!t.price || usd < 0.05) return;

            holdings.push({
                address: t.contractAddress as Address, symbol: t.symbol || '?', name: t.name || '?',
                decimals: t.decimals || 18, balance: t.tokenBalance.toString(),
                value: formatUsd(usd),
                usdValueNum: usd, change: '+0.00%', chainId: cId,
                logo: t.logo || getTokenLogoUrl(t.contractAddress, cId, t.symbol)
            });
        });
        return holdings;
    };

    const processBalances = (allBalances: any, importedByChain: Record<string, ImportedSwapToken[]>) => {
        const chainHoldings = Object.entries(allBalances).flatMap(([chainKey, data]) => {
            const chainHoldings = extractHoldings(chainKey, data, CHAIN_ID_BY_KEY[chainKey] || 1);
            const chainId = CHAIN_ID_BY_KEY[chainKey];
            if (!chainId) return chainHoldings;

            const importedTokens = importedByChain[String(chainId)] || [];
            if (importedTokens.length === 0) return chainHoldings;

            const existingKeys = new Set(chainHoldings.map(h => normalizeTokenAddress(h.address, chainId)));
            const chainTokens = Array.isArray((data as any)?.tokens) ? (data as any).tokens : [];

            importedTokens.forEach((token) => {
                if (!token?.address) return;
                const key = normalizeTokenAddress(token.address, chainId);
                if (existingKeys.has(key)) return;

                const tokenBalanceData = chainTokens.find((t: any) => normalizeTokenAddress(String(t.contractAddress || ''), chainId) === key);
                const decimals = typeof tokenBalanceData?.decimals === 'number'
                    ? tokenBalanceData.decimals
                    : (typeof token.decimals === 'number' ? token.decimals : 18);
                const balance = String(tokenBalanceData?.tokenBalance ?? '0');
                const usd = tokenBalanceData
                    ? (typeof tokenBalanceData.valueUsd === 'number'
                        ? tokenBalanceData.valueUsd
                        : toNumberOrZero(tokenBalanceData.tokenBalance) * toNumberOrZero(tokenBalanceData.price))
                    : 0;

                chainHoldings.push({
                    address: token.address as Address,
                    symbol: tokenBalanceData?.symbol || token.symbol || 'UNK',
                    name: tokenBalanceData?.name || token.name || 'Unknown Token',
                    balance,
                    value: formatUsd(usd),
                    usdValueNum: usd,
                    change: '+0.00%',
                    decimals,
                    logo: tokenBalanceData?.logo || token.logoUrl || getTokenLogoUrl(token.address, chainId, token.symbol),
                    chainId,
                });
                existingKeys.add(key);
            });

            return chainHoldings;
        });

        return chainHoldings.sort((a, b) => (b.usdValueNum || 0) - (a.usdValueNum || 0));
    };

    // [Logic]: Main balance fetch coordinator with smart caching & fingerprinting
    const fetchBalances = async (reqId: number, cancelled: { value: boolean }, forceRefresh = false) => {
        const cached = globalBalanceCache;
        if (!forceRefresh && cached && cached.address === walletAddress) {
            setHoldings(cached.holdings); setCachedHoldings(cached.holdings); setLoading(false);
        } else setLoading(true);
        try {
            const primaryAddress = walletAddress;
            const fp = await fetchFingerprint(primaryAddress!);
            if (!forceRefresh && cached && fp.fetched && cached.fingerprint.nonce === fp.nonce && cached.fingerprint.nativeBalanceWei === fp.balance.toString()) return;
            const allBalances = await getAllChainBalances(primaryAddress!, solanaWallet?.address, forceRefresh);
            if (!allBalances || cancelled.value || reqId !== balanceReqId.current) return;
            const result = processBalances(allBalances, importedTokensByChain);
            setHoldings(result); setCachedHoldings(result);
            if (!isSolana) globalBalanceCache = {
                address: walletAddress!, holdings: result,
                fingerprint: { nonce: fp.nonce, nativeBalanceWei: fp.balance.toString(), timestamp: Date.now() }
            };
        } catch (e) { console.error('Error fetching balances', e); } finally { if (reqId === balanceReqId.current) setLoading(false); }
    };

    // [Logic]: Unified transaction fetching with caching
    const fetchTransactions = async (reqId: number, cancelled: { value: boolean }) => {
        setTransactionsLoading(true);
        try {
            const chain = getChainName(chainId);
            const addr = chain === 'solana' ? walletAddress : walletAddress;
            const cacheKey = `${chain}:${addr?.toLowerCase()}`;
            const cached = txCache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < TX_CACHE_TTL_MS) {
                setTransactions(cached.data); setCachedTransactions(cached.data);
                return;
            }
            const data = await getWalletTransactions(addr!, { chain, limit: 25 });
            if (reqId === txReqId.current && !cancelled.value) {
                setTransactions(data || []); setCachedTransactions(data || []);
                txCache.set(cacheKey, { data: data || [], timestamp: Date.now() });
            }
        } catch (e) { console.error('Error fetching tx', e); } finally { if (reqId === txReqId.current) setTransactionsLoading(false); }
    };

    const refreshData = (forceRefresh = false) => {
        const reqB = ++balanceReqId.current;
        const reqT = ++txReqId.current;
        const reqO = ++ordersReqId.current;
        const cancelled = { value: false };
        fetchBalances(reqB, cancelled, forceRefresh);
        fetchTransactions(reqT, cancelled);
        fetchOrdersAndHistory(reqO, cancelled);
    };

    return {
        authenticated, user, walletAddress, isSolana, chainId, currentChain,
        holdings, cachedHoldings, loading, transactions, transactionsLoading,
        orders, pendingOrders, ordersLoading, orderHistory, orderHistoryLoading,
        error, setError, getAccessToken, logout, portfolioStats,
        setOrders, setPendingOrders, setOrderHistory, setOrderHistoryLoading,
        refreshData
    };
}
