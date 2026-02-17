import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LaunchpadCapsule } from '../components/Launchpad/LaunchpadCapsule';

import { Activity, ChevronDown, ChevronUp, Droplets, Search, TrendingUp, X } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { tokenApi, type TokenSearchResult } from '../services/api';
import { favoriteApi } from '../services/favoriteService';
import { PageContainer } from '../components/Layout/PageContainer';
import { Skeleton } from '../components/Skeleton';
import styles from './TokensPage.module.css';
import { usePageVisibility, useTabVisibility } from '../hooks/usePageVisibility';
import { requestManager } from '../utils/requestManager';
import { proxyImageUrl } from '../utils/imageProxy';
import {
  calculateTrendingScore,
  clearTrendingLocalCache,
  type TrendingTimeframe
} from '../services/trendingService';
import dexScreenerLogo from '../assets/images/dex-screener.png';

// --- Types ---

interface Token {
  id: number;
  name: string;
  symbol: string;
  chain: string;
  imageUrl?: string; // Token logo/avatar URL
  poolCreatedAt?: string; // Pool creation timestamp
  isNew: boolean; // Is token less than 24h old
  isHot: boolean; // Is token hot (high volume/activity in 24h)
  price: string;
  age: string;
  txns: number;
  buys: number;
  sells: number;
  volume: string;
  makers: number;
  c5m: string;
  c1h: string;
  c6h: string;
  c24h: string;
  liquidity: string;
  fdv: string;
  holders?: number;
  address?: string; // Token address for API calls
  poolAddress?: string; // Pool address for GeckoTerminal charts
  network?: string; // Network for API calls
  trendingScore: number; // Calculated trending score (0-100)
  launchpad?: string; // Originating launchpad
  creatorAddress?: string; // Launchpad creator/deployer when available
  creatorUrl?: string; // Preferred creator profile/social URL
  creatorLabel?: string; // Preferred creator label (e.g. @handle)
  launchMultipleRaw?: number; // Current price multiple vs launch/open reference

  // Raw numeric fields for fast sorting
  priceRaw: number;
  volumeRaw: number;
  liquidityRaw: number;
  fdvRaw: number;
  c5mRaw: number;
  c1hRaw: number;
  c6hRaw: number;
  c24hRaw: number;
  ageRaw: number; // timestamp

  socialLinks?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

interface TokenSignal {
  key: string;
  label: string;
  detail: string;
  offDetail: string;
  active: boolean;
  kind: 'dex' | 'spike' | 'depth' | 'activity' | 'multiple';
  tier?: 'x10' | 'x50' | 'x100' | 'x1000' | 'green' | 'yellow' | 'red';
}

// --- Helper Functions ---

function logScore(n: number): number {
  return Math.log10(Math.max(0, n) + 1);
}

function momentumScore(pct: number): number {
  const safe = Number.isFinite(pct) ? pct : 0;
  return Math.tanh(safe / 50);
}

function getTimeframeChangeValue(t: Token, timeframe: TrendingTimeframe): string {
  if (timeframe === '1h') return t.c1h;
  if (timeframe === '24h') return t.c24h;
  return t.c5m;
}

function getTimeframeChangeLabel(timeframe: TrendingTimeframe): string {
  if (timeframe === '1h') return '1H';
  if (timeframe === '24h') return '24H';
  return '5M';
}

function getTimeframeChangeColumn(timeframe: TrendingTimeframe): keyof Token {
  if (timeframe === '1h') return 'c1h';
  if (timeframe === '24h') return 'c24h';
  return 'c5m';
}

function computeTimeframeScore(t: Token, timeframe: TrendingTimeframe): number {
  const volume = logScore(t.volumeRaw || 0);
  const txns = logScore(t.txns || 0);
  const liquidity = logScore(t.liquidityRaw || 0);

  // "5m" 模式更偏新币/爆发：新池加成（但很小，避免刷子占满榜单）
  const isNewBonus =
    t.isNew ? 0.40 :
      (t.ageRaw > 0 && (Date.now() - t.ageRaw) < 6 * 60 * 60 * 1000) ? 0.20 :
        0;

  if (timeframe === '5m') {
    // 成交密度：偏好“交易活跃，但流动性还没那么大”的爆发盘（用24h数据做近似）。
    const density =
      (0.7 * txns + 0.3 * volume) -
      (0.55 * liquidity);

    // 年龄衰减：5m 榜单强烈偏新币；越老衰减越大（缺失时间按“偏老”处理）
    const ageHours = t.ageRaw > 0 ? (Date.now() - t.ageRaw) / (60 * 60 * 1000) : Number.POSITIVE_INFINITY;
    const baseAgeFactor = Number.isFinite(ageHours)
      ? (0.15 + 0.85 * Math.exp(-ageHours / 72))
      : 0.35;
    const ageFactor = Math.min(1.25, baseAgeFactor * (t.isNew ? 1.15 : 1));

    const rawScore = (
      0.40 * momentumScore(t.c5mRaw || 0) +
      0.30 * density +
      0.18 * txns +
      0.07 * volume +
      0.05 * liquidity +
      0.12 * isNewBonus
    );
    return rawScore * ageFactor;
  }

  if (timeframe === '1h') {
    return (
      0.40 * momentumScore(t.c1hRaw || 0) +
      0.10 * momentumScore(t.c5mRaw || 0) +
      0.25 * txns +
      0.20 * volume +
      0.05 * liquidity
    );
  }

  // 24h
  return (
    0.35 * momentumScore(t.c24hRaw || 0) +
    0.30 * volume +
    0.20 * txns +
    0.15 * liquidity
  );
}

function capDuplicateSymbols(tokens: Token[], maxPerSymbol: number): Token[] {
  if (maxPerSymbol <= 0) return tokens;

  const seen = new Map<string, number>();
  const preferred: Token[] = [];
  const overflow: Token[] = [];

  for (const token of tokens) {
    const key = (token.symbol || '').trim().toLowerCase();
    if (!key) {
      preferred.push(token);
      continue;
    }

    const count = seen.get(key) || 0;
    if (count < maxPerSymbol) {
      preferred.push(token);
      seen.set(key, count + 1);
    } else {
      overflow.push(token);
    }
  }

  // Keep deterministic order while ensuring the list remains full-length.
  return [...preferred, ...overflow];
}

function getTokenSignals(token: Token): TokenSignal[] {
  const hasImage = Boolean(token.imageUrl && token.imageUrl.trim().length > 0);
  const hasDexScreenerProfile = hasImage;

  const turnover = token.liquidityRaw > 0 ? token.volumeRaw / token.liquidityRaw : 0;
  const volumeSpikeTier: TokenSignal['tier'] =
    (turnover >= 4 && token.txns >= 800) ? 'red' :
      (turnover >= 2 && token.txns >= 300) ? 'yellow' :
        (turnover >= 1 && token.txns >= 120) ? 'green' :
          undefined;

  const poolDepthTier: TokenSignal['tier'] =
    token.liquidityRaw >= 1_000_000 ? 'red' :
      token.liquidityRaw >= 500_000 ? 'yellow' :
        token.liquidityRaw >= 100_000 ? 'green' :
          undefined;

  const tradingTier: TokenSignal['tier'] =
    token.txns >= 3000 ? 'red' :
      token.txns >= 1200 ? 'yellow' :
        token.txns >= 400 ? 'green' :
          undefined;

  const multipleRaw = Number(token.launchMultipleRaw || 0);
  const multiple = Number.isFinite(multipleRaw) && multipleRaw > 0 ? multipleRaw : 0;

  let multipleTier: TokenSignal['tier'];
  if (multiple >= 1000) multipleTier = 'x1000';
  else if (multiple >= 100) multipleTier = 'x100';
  else if (multiple >= 50) multipleTier = 'x50';
  else if (multiple >= 10) multipleTier = 'x10';

  return [
    { key: 'dex', label: 'DexScreener', detail: 'Metadata claimed', offDetail: 'Metadata not claimed', active: hasDexScreenerProfile, kind: 'dex' },
    { key: 'multiple', label: 'Since Launch', detail: `${multiple > 0 ? `x${multiple.toFixed(1)}` : 'N/A'}`, offDetail: `${multiple > 0 ? `x${multiple.toFixed(1)}` : 'N/A'}`, active: multiple >= 10, kind: 'multiple', tier: multipleTier },
    { key: 'depth', label: 'Pool Depth', detail: `${formatCurrency(token.liquidityRaw)} liquidity`, offDetail: `${formatCurrency(token.liquidityRaw)} liquidity`, active: !!poolDepthTier, kind: 'depth', tier: poolDepthTier },
    { key: 'activity', label: 'Trading Activity', detail: `${token.txns} txns/24h`, offDetail: `${token.txns} txns/24h`, active: !!tradingTier, kind: 'activity', tier: tradingTier },
    { key: 'spike', label: 'Volume Surge', detail: `${turnover.toFixed(2)}x turnover`, offDetail: `${turnover.toFixed(2)}x turnover`, active: !!volumeSpikeTier, kind: 'spike', tier: volumeSpikeTier },
  ];
}

function shortAddress(address?: string): string {
  if (!address) return '';
  const trimmed = address.trim();
  if (trimmed.length <= 10) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function extractXHandleFromUrl(raw?: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (!host.includes('x.com') && !host.includes('twitter.com')) return null;
    const parts = u.pathname.split('/').filter(Boolean);
    const user = (parts[0] || '').replace(/^@/, '');
    if (!user) return null;
    const reserved = new Set([
      'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
      'notifications', 'settings', 'tos', 'privacy', 'status'
    ]);
    if (reserved.has(user.toLowerCase())) return null;
    return user.replace(/^@/, '');
  } catch {
    return null;
  }
}

function isLowQualityCreatorLabelValue(raw?: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const value = raw.trim();
  if (!value) return false;
  return /^fid:\d+$/i.test(value) || /^@?\d+$/.test(value) || /^@?(i|status)$/i.test(value);
}

function isAddressLikeValue(v?: string): boolean {
  return !!v && (/^0x[a-fA-F0-9]{40}$/.test(v.trim()) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.trim()));
}

function parseCreatorUrlLabel(raw?: string): string {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const parts = u.pathname.split('/').filter(Boolean);
    const isX = host.includes('x.com') || host.includes('twitter.com');
    if (isX) {
      const xUser = (parts[0] || '').replace(/^@/, '');
      const reserved = new Set([
        'i', 'intent', 'share', 'home', 'explore', 'search', 'messages',
        'notifications', 'settings', 'tos', 'privacy', 'status'
      ]);
      if (xUser && !reserved.has(xUser.toLowerCase())) return `@${xUser}`;
      return 'X post';
    }
    if (host.includes('warpcast.com')) {
      if (parts.length >= 3 && parts[0] === '~' && parts[1] === 'profiles') return 'Farcaster';
      const handle = (parts[0] || '').replace(/^@/, '');
      if (handle && handle !== '~') return `@${handle}`;
      return 'Farcaster';
    }
    return host || '';
  } catch {
    return '';
  }
}

function creatorText(label?: string, address?: string, url?: string, website?: string): string {
  const isDigits = (v?: string) => !!v && /^\d+$/.test(v.trim());
  const isZeroEvmAddress = (v?: string) => !!v && /^0x0{40}$/i.test(v.trim());
  const byUrl = parseCreatorUrlLabel(url);
  if (byUrl) return byUrl;

  const cleanLabel = (label || '').trim();
  if (cleanLabel) {
    if (isAddressLikeValue(cleanLabel)) {
      if (isZeroEvmAddress(cleanLabel)) return '';
      return shortAddress(cleanLabel);
    }
    if ((cleanLabel.startsWith('http://') || cleanLabel.startsWith('https://'))) {
      const byLabelUrl = parseCreatorUrlLabel(cleanLabel);
      if (byLabelUrl) return byLabelUrl;
    }
    if (/^@?\d+$/i.test(cleanLabel)) {
      const platformFromUrl = parseCreatorUrlLabel(url);
      if (platformFromUrl) return platformFromUrl;
      return address ? shortAddress(address) : '';
    }
    if (/^@?(i|status)$/i.test(cleanLabel)) {
      return 'X post';
    }
    if (cleanLabel.startsWith('@')) return cleanLabel;
    if (/^fid:\d+$/i.test(cleanLabel)) {
      const platformFromUrl = parseCreatorUrlLabel(url);
      if (platformFromUrl === 'X post') return platformFromUrl;
      return 'Farcaster';
    }
    if (isDigits(cleanLabel) && address) return shortAddress(address);
    return cleanLabel;
  }

  const byWebsite = parseCreatorUrlLabel(website);
  if (byWebsite) return byWebsite;

  if (address && address.trim() && !isZeroEvmAddress(address)) return shortAddress(address);
  return parseCreatorUrlLabel(url);
}

function chainExplorerAddressUrl(chain: string, address?: string): string | undefined {
  if (!address) return undefined;
  const normalized = address.trim();
  if (!normalized) return undefined;
  const chainUpper = String(chain || '').toUpperCase();

  if (!normalized.startsWith('0x')) {
    return `https://solscan.io/account/${normalized}`;
  }

  switch (chainUpper) {
    case 'ETH':
      return `https://etherscan.io/address/${normalized}`;
    case 'BASE':
      return `https://basescan.org/address/${normalized}`;
    case 'BSC':
      return `https://bscscan.com/address/${normalized}`;
    case 'ARB':
      return `https://arbiscan.io/address/${normalized}`;
    case 'OP':
      return `https://optimistic.etherscan.io/address/${normalized}`;
    case 'MATIC':
      return `https://polygonscan.com/address/${normalized}`;
    case 'AVAX':
      return `https://snowtrace.io/address/${normalized}`;
    default:
      return `https://etherscan.io/address/${normalized}`;
  }
}

// Subscript digits for displaying zero count
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

function toSubscript(num: number): string {
  return num.toString().split('').map(d => SUBSCRIPT_DIGITS[parseInt(d)]).join('');
}

/**
 * Format price with subscript zero count for very small numbers
 * Example: 0.00000464 -> $0.0₄464 (4 zeros between 0. and first non-zero digit)
 * The first 0 after decimal point is the base, we count the additional zeros
 */
function formatPrice(value: number | undefined | null | string): string {
  // Convert to number if it's a string
  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0.00';
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return '$0.00';
  }

  if (!numValue || numValue === 0 || isNaN(numValue)) return '$0.00';

  // For very small numbers, count leading zeros after decimal point
  // Format: $0.0{n}xxxx where n is the count of additional zeros after "0.0"
  if (numValue < 0.001 && numValue > 0) {
    const str = numValue.toFixed(20); // Get enough precision
    const match = str.match(/^0\.0+/);
    if (match && match[0].length > 3) { // More than "0.0"
      // Subtract "0." (2 chars) to get the count of zeros after decimal point
      const zeroCount = match[0].length - 2;
      const significantDigits = str.slice(match[0].length, match[0].length + 4);
      return `$0.0${toSubscript(zeroCount)}${significantDigits}`;
    }
  }

  if (numValue < 0.01) {
    return `$${numValue.toFixed(6)}`;
  } else if (numValue < 1) {
    return `$${numValue.toFixed(4)}`;
  } else if (numValue < 100) {
    return `$${numValue.toFixed(2)}`;
  } else {
    return `$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/**
 * Calculate and format age from creation timestamp
 * Returns formatted string like "1h", "2d", "3mo", "1y"
 */
function formatAge(createdAt: string | undefined): string {
  if (!createdAt) return '-';

  try {
    const createdMs = Date.parse(createdAt);
    if (!Number.isFinite(createdMs)) return '-';
    const nowMs = Date.now();
    if (createdMs > nowMs + 5 * 60 * 1000) return '-';
    const diffMs = nowMs - createdMs;

    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}y`;
    if (months > 0) return `${months}mo`;
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return 'now';
  } catch {
    return '-';
  }
}

/**
 * Check if token is new (less than 24 hours old)
 */
function isNewToken(createdAt: string | undefined): boolean {
  if (!createdAt) return false;

  try {
    const createdMs = Date.parse(createdAt);
    if (!Number.isFinite(createdMs)) return false;
    const nowMs = Date.now();
    if (createdMs > nowMs) return false;
    const diffMs = nowMs - createdMs;
    const hours = diffMs / (1000 * 60 * 60);
    return hours < 24;
  } catch {
    return false;
  }
}

/**
 * Check if token is hot (high volume/activity in 24h)
 * Criteria: volume > $500K OR txns > 1000 OR price change > +50%
 */
function isHotToken(volume24h: number | undefined, txns24h: number | undefined, priceChange24h: number | undefined): boolean {
  // High volume (> $500K)
  if (volume24h && volume24h > 500000) return true;
  // High transaction count (> 1000)
  if (txns24h && txns24h > 1000) return true;
  // High price increase (> +50%)
  if (priceChange24h && priceChange24h > 50) return true;
  return false;
}

function formatCurrency(value: number | undefined | null | string): string {
  // Convert to number if it's a string
  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseFloat(value);
    if (isNaN(numValue)) return '$0';
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return '$0';
  }

  if (!numValue || numValue === 0 || isNaN(numValue)) return '$0';
  if (numValue > 0 && numValue < 1) return '<$1';
  if (numValue >= 1e9) {
    return `$${(numValue / 1e9).toFixed(2)}B`;
  } else if (numValue >= 1e6) {
    return `$${(numValue / 1e6).toFixed(1)}M`;
  } else if (numValue >= 1e3) {
    return `$${(numValue / 1e3).toFixed(0)}K`;
  }
  return `$${numValue.toFixed(0)}`;
}

function formatChange(value: number | undefined | null | string): string {
  // Convert to number if it's a string
  let numValue: number;
  if (typeof value === 'string') {
    numValue = parseFloat(value);
    if (isNaN(numValue)) return '0%';
  } else if (typeof value === 'number') {
    numValue = value;
  } else {
    return '0%';
  }

  if (numValue === undefined || numValue === null || isNaN(numValue)) return '0%';
  const sign = numValue >= 0 ? '+' : '';
  return `${sign}${numValue.toFixed(1)}%`;
}

/**
 * Get native token symbol for a network
 */
function getNativeTokenSymbol(network: string): string {
  const networkLower = network.toLowerCase();
  if (networkLower === 'sol' || networkLower === 'solana') return 'SOL';
  if (networkLower === 'bsc' || networkLower === 'binance') return 'BNB';
  if (networkLower === 'eth' || networkLower === 'ethereum') return 'ETH';
  if (networkLower === 'base') return 'ETH';
  if (networkLower === 'arbitrum' || networkLower === 'arb') return 'ETH';
  if (networkLower === 'optimism' || networkLower === 'op') return 'ETH';
  if (networkLower === 'polygon' || networkLower === 'matic') return 'MATIC';
  if (networkLower === 'avax' || networkLower === 'avalanche') return 'AVAX';
  if (networkLower === 'fantom') return 'FTM';
  return 'ETH'; // Default to ETH
}

function formatNetworkName(network: string): string {
  const networkMap: Record<string, string> = {
    'eth': 'ETH',
    'ethereum': 'ETH',
    'bsc': 'BSC',
    'solana': 'SOL',
    'base': 'BASE',
    'arbitrum': 'ARB',
    'optimism': 'OP',
    'polygon': 'MATIC',
    'avax': 'AVAX',
    'avalanche': 'AVAX',
    'fantom': 'FTM',
  };
  return networkMap[network.toLowerCase()] || network.toUpperCase();
}

// Convert API TokenSearchResult to internal Token format
function convertApiTokenToToken(apiToken: TokenSearchResult, id: number): Token {
  const networkName = formatNetworkName(apiToken.network);
  const socialContext = (apiToken as any).social_context || {};
  const socialContextId = typeof socialContext?.id === 'string' ? socialContext.id.trim() : '';
  const socialContextHandle = typeof socialContext?.handle === 'string' ? socialContext.handle.trim() : '';
  const socialContextMessageId = typeof socialContext?.messageId === 'string'
    ? socialContext.messageId
    : (typeof socialContext?.message_id === 'string' ? socialContext.message_id : '');
  const xHandleFromMessage = extractXHandleFromUrl(socialContextMessageId);
  const xHandleFromSocial = extractXHandleFromUrl(
    (typeof socialContext?.x === 'string' && socialContext.x)
    || (typeof socialContext?.twitter === 'string' && socialContext.twitter)
    || undefined
  );
  const preferredXHandle = xHandleFromMessage || xHandleFromSocial || null;
  const preferredXUrl = preferredXHandle ? `https://x.com/${preferredXHandle}` : undefined;
  const preferredXLabel = preferredXHandle ? `@${preferredXHandle}` : undefined;
  const apiCreatorLabelRaw = (apiToken as any).creatorLabel as string | undefined;
  const apiCreatorLabel = typeof apiCreatorLabelRaw === 'string' ? apiCreatorLabelRaw.trim() : undefined;
  const apiCreatorLabelIsLowQuality = isLowQualityCreatorLabelValue(apiCreatorLabel);
  const apiCreatorUrlRaw = (apiToken as any).creatorUrl as string | undefined;
  const socialContextHandleLabel = (() => {
    const handle = socialContextHandle.replace(/^@/, '');
    if (!handle) return undefined;
    if (/^\d+$/.test(handle)) return undefined;
    if (/^(i|status)$/i.test(handle)) return undefined;
    return `@${handle}`;
  })();
  const socialContextIdLabel = (() => {
    const raw = socialContextId.startsWith('@') ? socialContextId.slice(1) : socialContextId;
    if (!raw) return undefined;
    if (/^\d+$/.test(raw)) return undefined;
    if (/^(i|status)$/i.test(raw)) return undefined;
    return `@${raw.replace(/^@/, '')}`;
  })();

  // Ensure numeric values are properly converted (handle string, number, null, undefined)
  const price = typeof apiToken.price === 'number'
    ? apiToken.price
    : (apiToken.price ? parseFloat(String(apiToken.price)) : undefined);
  const priceChange5m = typeof apiToken.priceChange5m === 'number'
    ? apiToken.priceChange5m
    : (apiToken.priceChange5m ? parseFloat(String(apiToken.priceChange5m)) : undefined);
  const priceChange1h = typeof apiToken.priceChange1h === 'number'
    ? apiToken.priceChange1h
    : (apiToken.priceChange1h ? parseFloat(String(apiToken.priceChange1h)) : undefined);
  const priceChange6h = typeof apiToken.priceChange6h === 'number'
    ? apiToken.priceChange6h
    : (apiToken.priceChange6h ? parseFloat(String(apiToken.priceChange6h)) : undefined);
  const priceChange24h = typeof apiToken.priceChange24h === 'number'
    ? apiToken.priceChange24h
    : (apiToken.priceChange24h ? parseFloat(String(apiToken.priceChange24h)) : undefined);
  const volume24h = typeof apiToken.volume24h === 'number'
    ? apiToken.volume24h
    : (apiToken.volume24h ? parseFloat(String(apiToken.volume24h)) : undefined);
  const liquidity = typeof apiToken.liquidity === 'number'
    ? apiToken.liquidity
    : (apiToken.liquidity ? parseFloat(String(apiToken.liquidity)) : undefined);
  const fdv = typeof apiToken.fdv === 'number'
    ? apiToken.fdv
    : (apiToken.fdv ? parseFloat(String(apiToken.fdv)) : undefined);

  return {
    id,
    name: apiToken.name || 'Unknown',
    symbol: apiToken.symbol || 'UNKNOWN',
    chain: networkName,
    imageUrl: apiToken.imageUrl, // Token logo from API
    poolCreatedAt: apiToken.poolCreatedAt,
    isNew: isNewToken(apiToken.poolCreatedAt), // Check if less than 24h old
    isHot: isHotToken(volume24h, apiToken.txns24h, priceChange24h), // Check if hot (high activity)
    price: formatPrice(price),
    age: formatAge(apiToken.poolCreatedAt), // Calculate age from creation time
    txns: apiToken.txns24h || 0,
    buys: apiToken.buys24h || 0,
    sells: apiToken.sells24h || 0,
    volume: formatCurrency(volume24h),
    makers: apiToken.holders || 0, // Using holders count for makers display
    holders: apiToken.holders,
    c5m: formatChange(priceChange5m),  // 5 minutes change
    c1h: formatChange(priceChange1h),  // 1 hour change
    c6h: formatChange(priceChange6h), // 6 hours change
    c24h: formatChange(priceChange24h), // 24 hours change
    liquidity: formatCurrency(liquidity),
    fdv: formatCurrency(fdv),
    address: apiToken.address, // Store address for detail page
    poolAddress: apiToken.poolAddress, // Critical for charts
    network: apiToken.network, // Store network for detail page

    // Raw fields for fast sorting
    priceRaw: price || 0,
    volumeRaw: volume24h || 0,
    liquidityRaw: liquidity || 0,
    fdvRaw: fdv || 0,
    c5mRaw: priceChange5m || 0,
    c1hRaw: priceChange1h || 0,
    c6hRaw: priceChange6h || 0,
    c24hRaw: priceChange24h || 0,
    ageRaw: apiToken.poolCreatedAt ? new Date(apiToken.poolCreatedAt).getTime() : 0,
    socialLinks: {
      website: apiToken.websites?.[0]?.url || apiToken.socials?.find(s => s.type === 'website')?.url || socialContext?.website,
      twitter: apiToken.socials?.find(s => s.type === 'twitter')?.url || socialContext?.x || socialContext?.twitter,
      telegram: apiToken.socials?.find(s => s.type === 'telegram')?.url,
      discord: apiToken.socials?.find(s => s.type === 'discord')?.url,
    },
    creatorAddress: (apiToken as any).creatorAddress || (apiToken as any).creator || (apiToken as any).userAddress || undefined,
    creatorUrl:
      apiCreatorUrlRaw
      || preferredXUrl
      || socialContextMessageId
      || socialContext?.message_id
      || socialContext?.url
      || socialContext?.profile
      || socialContext?.link
      || socialContext?.x
      || socialContext?.twitter
      || socialContext?.farcaster
      || socialContext?.website
      || undefined,
    creatorLabel:
      // Keep backend label first unless it's low-quality placeholder/noise.
      (!apiCreatorLabelIsLowQuality ? apiCreatorLabel : undefined)
      || preferredXLabel
      || socialContextHandleLabel
      || socialContextIdLabel
      || undefined,
    launchMultipleRaw: (() => {
      const v = typeof apiToken.launchMultiple === 'number' ? apiToken.launchMultiple : (apiToken.launchMultiple ? parseFloat(String(apiToken.launchMultiple)) : undefined);
      // Guard: suppress absurd multiples that indicate bad baseline data
      if (v !== undefined && Number.isFinite(v) && v > 0 && v <= 200_000) return v;
      return undefined;
    })(),
    trendingScore: calculateTrendingScore({
      volume24h: volume24h || 0,
      txns24h: apiToken.txns24h || 0,
      priceChange24h: priceChange24h || 0,
      liquidity: liquidity || 0,
      // Estimate makers if not available (approx 50% of txns as unique, capped)
      makers: apiToken.txns24h ? Math.floor(apiToken.txns24h * 0.5) : 0,
      // Note: uniqueHolders is not available in list API, only in details enrichment
    }),
    launchpad: apiToken.launchpad,
  };
}

const getChainColor = (chain: string): string => {
  switch (chain) {
    case 'SOL': return '#9945FF';
    case 'ETH': return '#627EEA';
    case 'BSC': return '#F0B90B';
    case 'BASE': return '#0052FF';
    case 'ARB': return '#28A0F0';
    case 'OP': return '#FF0420';
    case 'AVAX': return '#E84142';
    case 'MATIC': return '#8247E5';
    default: return '#666666';
  }
};

const getChainLogo = (chain: string): string => {
  const chainLower = chain.toLowerCase();
  if (chainLower === 'eth' || chainLower === 'ethereum') return '/assets/tokens/eth.png';
  if (chainLower === 'sol' || chainLower === 'solana') return '/assets/tokens/sol.png';
  if (chainLower === 'base') return '/assets/tokens/base.png';
  if (chainLower === 'bsc' || chainLower === 'binance') return '/assets/tokens/bsc.png';
  if (chainLower === 'arbitrum' || chainLower === 'arb') return '/assets/tokens/arbitrum.png';
  if (chainLower === 'optimism' || chainLower === 'op') return '/assets/tokens/optimism.png';
  if (chainLower === 'polygon' || chainLower === 'matic') return '/assets/tokens/polygon.png';
  if (chainLower === 'avax' || chainLower === 'avalanche') return 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png';
  return '';
};

const TokenRow = React.memo(({
  token: t,
  index: i,
  isMobile,
  timeframe,
  onTokenClick
}: {
  token: Token;
  index: number;
  isMobile: boolean;
  timeframe: TrendingTimeframe;
  onTokenClick: (token: Token) => void;
}) => {
  const [activeSignalKey, setActiveSignalKey] = useState<string | null>(null);
  const changeValue = getTimeframeChangeValue(t, timeframe);
  const isPositive = changeValue.startsWith('+');
  const buyPct = t.buys + t.sells > 0 ? (t.buys / (t.buys + t.sells)) * 100 : 50;
  const showRank = !isMobile && !t.isNew && !t.isHot;
  const tokenSignals = getTokenSignals(t);
  const creatorDisplay = creatorText(t.creatorLabel, t.creatorAddress, t.creatorUrl, t.socialLinks?.website);
  const creatorHref = t.creatorUrl || t.socialLinks?.website || chainExplorerAddressUrl(t.chain, t.creatorAddress);

  return (
    <React.Fragment>
      <tr
        onClick={() => onTokenClick(t)}
        className={styles.tr}
      >
        {/* Token Info */}
        <td
          className={styles.td}
          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
        >
          <div className={styles.tokenInfo}>
            {showRank && (
              <span className={styles.rank}>
                {i + 1}
              </span>
            )}
            <div className={`${styles.tokenIconWrapper} ${isMobile ? styles.tokenIconWrapperMobile : ''}`}>
              {isMobile && (
                <span className={`${styles.avatarRankBadge} ${t.isNew ? styles.avatarRankNew : ''} ${t.isHot && !t.isNew ? styles.avatarRankHot : ''}`}>
                  {t.isNew ? 'NEW' : t.isHot ? 'HOT' : i + 1}
                </span>
              )}
              <img
                src={proxyImageUrl(t.imageUrl) || proxyImageUrl(`https://ui-avatars.com/api/?name=${encodeURIComponent(t.symbol)}&background=random&color=fff`) || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.symbol)}&background=random&color=fff`}
                alt={t.name}
                className={styles.tokenIcon}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(t.symbol)}&background=random&color=fff`;
                  const stage = e.currentTarget.dataset.fallbackStage || '0';
                  if (stage === '0') {
                    e.currentTarget.dataset.fallbackStage = '1';
                    e.currentTarget.src = proxyImageUrl(fallbackUrl) || fallbackUrl;
                    return;
                  }
                  if (stage === '1') {
                    e.currentTarget.dataset.fallbackStage = '2';
                    e.currentTarget.src = fallbackUrl;
                  }
                }}
              />
              <img
                src={getChainLogo(t.chain)}
                alt={t.chain}
                className={styles.chainLogo}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.style.background = getChainColor(t.chain);
                  }
                }}
              />
            </div>

            <div className={styles.tokenNameCol}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                <span className={styles.tokenSymbol}>{t.symbol}</span>
                {t.isNew && !isMobile && (
                  <span style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}>NEW</span>
                )}
                {t.isHot && !t.isNew && !isMobile && (
                  <span style={{
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: '#fff',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                  }}>HOT</span>
                )}
              </div>
              <span className={styles.tokenName}>{t.name}</span>
            </div>
          </div>
        </td>

        {/* Price */}
        <td
          className={`${styles.td} ${styles.tdRight}`}
          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
        >
          <div className={styles.price}>
            {t.price}
          </div>
        </td>

        {/* Change (based on timeframe) */}
        <td
          className={`${styles.td} ${styles.tdRight} ${isPositive ? styles.changePositive : styles.changeNegative}`}
          style={{ padding: isMobile ? '10px 8px' : '12px 16px', fontSize: isMobile ? '11px' : '12px' }}
        >
          {changeValue}
        </td>

        {/* Age */}
        <td
          className={`${styles.td} ${styles.tdRight} ${styles.age} ${((t.age.toLowerCase().endsWith('h') || t.age.toLowerCase().endsWith('m')) || t.isNew) ? styles.ageRecent : ''}`}
          style={{ padding: isMobile ? '10px 8px' : '12px 16px', fontSize: isMobile ? '11px' : '12px' }}
        >
          {t.age}
        </td>

        {/* Volume / Liquidity */}
        <td
          className={`${styles.td} ${styles.tdRight}`}
          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
        >
          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div className={styles.volume}>
              <span className={styles.volLabel} style={{ marginRight: '4px', fontSize: isMobile ? '9px' : '11px', fontWeight: 500 }}>VOL:</span>
              {t.volume}
            </div>
            <div className={styles.volume}>
              <span className={styles.liqLabel} style={{ marginRight: '4px', fontSize: isMobile ? '9px' : '11px', fontWeight: 500 }}>LIQ:</span>
              {t.liquidity}
            </div>
          </div>
        </td>

        {/* Txns (Buy/Sell Bar) */}
        {!isMobile && (
          <td
            className={`${styles.td} ${styles.tdCenter}`}
            style={{ padding: '12px 16px' }}
          >
            <div className={styles.buySellBar} style={{ flexDirection: 'column' }}>
              <div className={styles.buySellBar} style={{ justifyContent: 'space-between', marginBottom: '2px' }}>
                <span className={styles.changePositive} style={{ fontSize: '9px' }}>
                  {t.buys}
                </span>
                <span className={styles.changeNegative} style={{ fontSize: '9px' }}>
                  {t.sells}
                </span>
              </div>
              <div className={styles.barContainer} style={{ height: '6px' }}>
                <div
                  className={styles.buyBar}
                  style={{ width: `${buyPct}%` }}
                ></div>
                <div
                  className={styles.sellBar}
                  style={{ width: `${100 - buyPct}%` }}
                ></div>
              </div>
            </div>
          </td>
        )}
      </tr>
      {/* Sub-row for additional details */}
      <tr className={styles.subRow}>
        <td colSpan={isMobile ? 5 : 6}>
          <div className={styles.subRowContent}>
            {showRank && <span className={styles.subRowRankSpacer} aria-hidden="true" />}
            <div className={styles.subRowCapsuleWrap}>
              <div className={styles.subRowLaunchpadWrap}>
                <LaunchpadCapsule
                  address={t.address || ''}
                  chain={t.chain}
                  launchpad={t.launchpad}
                  onAskAI={() => console.log('Trigger Ask AI for', t.name)}
                />
                {creatorDisplay && (t.creatorLabel || t.creatorAddress || t.creatorUrl) && (
                  creatorHref ? (
                    <a
                      className={`${styles.subRowCreator} ${styles.subRowCreatorLink}`}
                      href={creatorHref}
                      target="_blank"
                      rel="noreferrer"
                      title={t.creatorLabel || t.creatorAddress || 'creator'}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {creatorDisplay}
                    </a>
                  ) : (
                    <span className={styles.subRowCreator} title={t.creatorAddress || t.creatorLabel || 'creator'}>
                      {creatorDisplay}
                    </span>
                  )
                )}
              </div>
              <div className={styles.tokenSignals} role="group" aria-label="Token quality indicators">
                {tokenSignals.map((signal) => (
                  <button
                    key={signal.key}
                    type="button"
                    className={`${styles.tokenSignal} ${signal.active ? styles.tokenSignalActive : styles.tokenSignalInactive} ${signal.tier === 'green' ? styles.signalTierGreen : ''} ${signal.tier === 'yellow' ? styles.signalTierYellow : ''} ${signal.tier === 'red' ? styles.signalTierRed : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSignalKey((prev) => (prev === signal.key ? null : signal.key));
                    }}
                    aria-label={`${signal.label}: ${signal.active ? 'ON' : 'OFF'}`}
                  >
                    {signal.kind === 'dex' && (
                      <img
                        src={dexScreenerLogo}
                        alt="DexScreener"
                        className={styles.tokenSignalDexLogo}
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                    {signal.kind === 'spike' && <TrendingUp size={12} strokeWidth={2.2} />}
                    {signal.kind === 'depth' && <Droplets size={12} strokeWidth={2.2} />}
                    {signal.kind === 'activity' && <Activity size={12} strokeWidth={2.2} />}
                    {signal.kind === 'multiple' && (
                      <span
                        className={`${styles.tokenSignalMultipleValue} ${signal.tier === 'x1000' ? styles.multipleX1000 :
                          signal.tier === 'x100' ? styles.multipleX100 :
                            signal.tier === 'x50' ? styles.multipleX50 :
                              signal.tier === 'x10' ? styles.multipleX10 : ''}`}
                        aria-hidden="true"
                      >
                        {Number.isFinite(t.launchMultipleRaw || NaN) && (t.launchMultipleRaw || 0) > 0
                          ? `x${(t.launchMultipleRaw || 0) >= 100 ? Math.round(t.launchMultipleRaw || 0) : (t.launchMultipleRaw || 0).toFixed(1)}`
                          : 'x-'}
                      </span>
                    )}
                    {activeSignalKey === signal.key && (
                      <span className={styles.tokenSignalBubble} role="status" onClick={(e) => e.stopPropagation()}>
                        <span className={styles.tokenSignalBubbleTitle}>{signal.label}</span>
                        <span className={styles.tokenSignalBubbleText}>
                          {signal.active ? `ON · ${signal.detail}` : `OFF · ${signal.offDetail}`}
                        </span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </td>
      </tr>
    </React.Fragment>
  );
});

interface TokensPageProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Available chains for filtering
const CHAIN_OPTIONS = [
  { id: 'all', name: 'All Chains', logo: '', apiKey: '' },
  { id: 'ETH', name: 'Ethereum', logo: '/assets/tokens/eth.png', apiKey: 'eth' },
  { id: 'SOL', name: 'Solana', logo: '/assets/tokens/sol.png', apiKey: 'solana' },
  { id: 'BSC', name: 'BNB Chain', logo: '/assets/tokens/bsc.png', apiKey: 'bsc' },
  { id: 'BASE', name: 'Base', logo: '/assets/tokens/base.png', apiKey: 'base' },
  { id: 'ARB', name: 'Arbitrum', logo: '/assets/tokens/arbitrum.png', apiKey: 'arbitrum' },
  { id: 'OP', name: 'Optimism', logo: '/assets/tokens/optimism.png', apiKey: 'optimism' },
  { id: 'MATIC', name: 'Polygon', logo: '/assets/tokens/polygon.png', apiKey: 'polygon' },
];

// Chains to fetch data from
const FETCH_CHAINS = CHAIN_OPTIONS.filter(c => c.apiKey).map(c => c.apiKey);

export const TokensPage: React.FC<TokensPageProps> = ({
  searchQuery: externalSearchQuery,
  onSearchChange: externalOnSearchChange,
}) => {
  const { authenticated } = usePrivy();
  const navigate = useNavigate(); // Hook for navigation
  // Page visibility detection
  const { isVisible } = usePageVisibility();
  const isTabVisible = useTabVisibility();
  const isPageActive = isVisible && isTabVisible;


  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [allTokens, setAllTokens] = useState<Token[]>([]); // All chains cached data
  const [tokens, setTokens] = useState<Token[]>([]); // Currently displayed tokens (for search)
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true); // Initial multi-chain load
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [selectedChain, setSelectedChain] = useState<string>(
    localStorage.getItem('kiko-selected-chain') || 'all'
  );
  const [timeframe, setTimeframe] = useState<TrendingTimeframe>(
    (localStorage.getItem('kiko-trending-timeframe') as TrendingTimeframe) || '5m'
  );
  const [showChainDropdown, setShowChainDropdown] = useState(false); // Chain dropdown visibility
  const [visibleCount, setVisibleCount] = useState(30);
  const loadingRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'trending' | 'favorites'>('trending'); // Tab state

  // Use external search if provided, otherwise use internal
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalOnSearchChange || setInternalSearchQuery;
  const [sortBy, setSortBy] = useState<keyof Token | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isMobile, setIsMobile] = useState(false);

  // Refs for request management
  const chainRequestIdsRef = useRef<Map<string, string>>(new Map());
  const mountedRef = useRef(true);

  // Token page should always read fresh DB-backed API payloads.
  useEffect(() => {
    clearTrendingLocalCache();
  }, []);

  // Load all chains data on initial mount - with queue and batching
  useEffect(() => {
    // Reset mounted ref on each mount (important for StrictMode)
    mountedRef.current = true;

    const loadAllChains = async () => {
      setInitialLoading(true);
      setError(null);

      try {



        // Fetch fresh data (DB-backed API)
        const fetchPromises = FETCH_CHAINS.map(async (chain) => {
          if (!mountedRef.current) return [];

          try {
            // Use cache-first live endpoint for multi-chain screen to avoid strict-mode timeout storm.
            const data = await tokenApi.getTrendingLive(chain, timeframe, 100, true);

            if (mountedRef.current && data && data.length > 0) {
              // Convert to internal tokens
              // We'll assign IDs later after aggregation
              return data.map((token) => convertApiTokenToToken(token, 0));
            }
          } catch (err) {
            console.warn(`Failed to load ${chain} tokens:`, err);
          }
          return [];
        });

        const results = await Promise.all(fetchPromises);
        let freshTokens = results.flat();

        // Rank tokens from all chains by selected timeframe
        if (freshTokens.length > 0) {
          freshTokens.sort((a, b) => computeTimeframeScore(b, timeframe) - computeTimeframeScore(a, timeframe));
        }

        // Batch update (also clear stale list if backend returns empty)
        if (mountedRef.current) {
          // Assign unique IDs for the table display AFTER global sorting
          const displayTokens = freshTokens.map((t, idx) => ({ ...t, id: idx + 1 }));
          setAllTokens(displayTokens);
        }

        if (mountedRef.current) {
          setInitialLoading(false);
          if (freshTokens.length === 0) {
            setError('No trending tokens available. The data may still be loading.');
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          console.error('Error loading all chains:', err);
          setError(`Failed to load trending tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } finally {
        if (mountedRef.current) {
          setInitialLoading(false);
        }
      }
    };

    // Always load on mount, regardless of page visibility
    loadAllChains();

    // Cleanup on unmount
    return () => {
      chainRequestIdsRef.current.forEach((requestId) => {
        requestManager.cancel(requestId);
      });
      chainRequestIdsRef.current.clear();
    };
  }, [timeframe, reloadNonce]); // Reload when timeframe changes or manual retry is triggered

  // 30-second polling for real-time updates
  useEffect(() => {
    if (!isPageActive) return;

    const POLL_INTERVAL = 300000; // 5 minutes (matches backend refresh cadence)

    const pollData = async () => {
      if (!mountedRef.current || !isPageActive) return;




      try {
        const promises = FETCH_CHAINS.map(async (chain) => {
          if (!mountedRef.current) return [];
          try {
            // Polling should stay lightweight and cache-friendly.
            const data = await tokenApi.getTrendingLive(chain, timeframe, 100, true);
            if (mountedRef.current && data && data.length > 0) {
              return data.map((token) => convertApiTokenToToken(token, 0));
            }
          } catch (err) {
            // Silently ignore poll errors
          }
          return [];
        });

        const results = await Promise.all(promises);
        let freshTokens = results.flat();

        if (mountedRef.current) {
          // Keep the list ranked by selected timeframe
          freshTokens.sort((a, b) => computeTimeframeScore(b, timeframe) - computeTimeframeScore(a, timeframe));

          const displayTokens = freshTokens.map((t, idx) => ({ ...t, id: idx + 1 }));
          setAllTokens(displayTokens);
        }
      } catch (e) {
        // Silently ignore
      }
    };

    const intervalId = setInterval(pollData, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isPageActive, timeframe]);

  // Cleanup on unmount
  useEffect(() => {
    // Reset mounted ref on each mount (important for StrictMode)
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      chainRequestIdsRef.current.forEach((requestId) => {
        requestManager.cancel(requestId);
      });
      chainRequestIdsRef.current.clear();
    };
  }, []);

  // Handle search
  const searchRequestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setTokens([]);
      setLoading(false);
      setError(null);
      return;
    }


    // NOTE: Removed isPageActive check - user-initiated search should always run

    // Cancel previous search request
    if (searchRequestIdRef.current) {
      requestManager.cancel(searchRequestIdRef.current);
    }

    const searchTokens = async () => {
      const requestId = `search-${searchQuery}-${Date.now()}`;
      searchRequestIdRef.current = requestId;

      setLoading(true);
      setError(null);

      try {
        const results = await requestManager.execute(
          requestId,
          () => tokenApi.search(searchQuery),
          { priority: 2, timeout: 30000 } // Higher priority for user-initiated search
        );

        if (mountedRef.current && searchRequestIdRef.current === requestId) {
          const convertedTokens = results.map((token, index) =>
            convertApiTokenToToken(token, index + 1)
          );
          setTokens(convertedTokens);
        }
      } catch (err) {
        if (mountedRef.current && searchRequestIdRef.current === requestId) {
          console.error('Error searching tokens:', err);
          setError('Failed to search tokens. Please try again.');
          setTokens([]);
        }
      } finally {
        if (mountedRef.current && searchRequestIdRef.current === requestId) {
          setLoading(false);
          searchRequestIdRef.current = null;
        }
      }
    };

    // Debounce search
    const timeoutId = setTimeout(searchTokens, 500);
    return () => {
      clearTimeout(timeoutId);
      if (searchRequestIdRef.current) {
        requestManager.cancel(searchRequestIdRef.current);
        searchRequestIdRef.current = null;
        setLoading(false);
      }
    };
  }, [searchQuery]);



  // Persist selected chain
  useEffect(() => {
    localStorage.setItem('kiko-selected-chain', selectedChain);
  }, [selectedChain]);

  // Persist selected timeframe + reset view state
  useEffect(() => {
    localStorage.setItem('kiko-trending-timeframe', timeframe);
    setVisibleCount(30);
    setSortBy(null);
    setSortDirection('desc');
  }, [timeframe]);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Close chain dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.chainSelector}`)) {
        setShowChainDropdown(false);
      }
    };

    if (showChainDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChainDropdown]);

  // Favorites state
  const [favoriteAddresses, setFavoriteAddresses] = useState<Set<string>>(new Set());

  // Fetch favorites when tab changes to favorites or on mount
  useEffect(() => {
    const loadFavorites = async () => {
      if (!authenticated) {
        setFavoriteAddresses(new Set());
        return;
      }

      try {
        const favs = await favoriteApi.getFavorites();
        // Store addresses in lowercase for consistent comparison
        const addresses = new Set(favs.map(f => f.address.toLowerCase()));
        setFavoriteAddresses(addresses);
      } catch (err) {
        console.error('Failed to load favorites', err);
      }
    };

    // Always load initially and when tab becomes favorites
    loadFavorites();
  }, [activeTab, authenticated]);

  // Filter and sort tokens
  const filteredAndSortedTokens = useMemo(() => {
    // Use search results if searching, otherwise use cached allTokens
    const sourceTokens = searchQuery.trim() ? tokens : allTokens;
    let filtered = [...sourceTokens];

    // Chain filter
    if (selectedChain !== 'all') {
      filtered = filtered.filter(t => t.chain === selectedChain);
    }

    // Search filter (additional filter on already searched results)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.symbol.toLowerCase().includes(query) ||
        t.chain.toLowerCase().includes(query) ||
        t.address?.toLowerCase().includes(query) ||
        t.poolAddress?.toLowerCase().includes(query)
      );
    }

    // Tab Filter: Favorites - use lowercase comparison
    if (activeTab === 'favorites') {
      filtered = filtered.filter(t => t.address && favoriteAddresses.has(t.address.toLowerCase()));
    }

    if (activeTab === 'trending') {
      filtered = filtered.filter((t) => {
        if (t.liquidityRaw <= 0) return false;
        if (t.volumeRaw <= 0 && t.txns <= 0) return false;
        return true;
      });
    }

    // Sort
    if (sortBy) {
      filtered.sort((a, b) => {
        const aVal: any = a[sortBy];
        const bVal: any = b[sortBy];

        let aNum: number, bNum: number;
        const aToken = a as Token;
        const bToken = b as Token;

        // Use raw fields for sorting to avoid parsing strings
        if (sortBy === 'age') {
          aNum = aToken.ageRaw;
          bNum = bToken.ageRaw;
        } else if (sortBy === 'volume') {
          aNum = aToken.volumeRaw;
          bNum = bToken.volumeRaw;
        } else if (sortBy === 'liquidity') {
          aNum = aToken.liquidityRaw;
          bNum = bToken.liquidityRaw;
        } else if (sortBy === 'fdv') {
          aNum = aToken.fdvRaw;
          bNum = bToken.fdvRaw;
        } else if (sortBy === 'price') {
          aNum = aToken.priceRaw;
          bNum = bToken.priceRaw;
        } else if (sortBy === 'c5m') {
          aNum = aToken.c5mRaw;
          bNum = bToken.c5mRaw;
        } else if (sortBy === 'c1h') {
          aNum = aToken.c1hRaw;
          bNum = bToken.c1hRaw;
        } else if (sortBy === 'c6h') {
          aNum = aToken.c6hRaw;
          bNum = bToken.c6hRaw;
        } else if (sortBy === 'c24h') {
          aNum = aToken.c24hRaw;
          bNum = bToken.c24hRaw;
        } else if (sortBy === 'trendingScore') {
          aNum = aToken.trendingScore;
          bNum = bToken.trendingScore;
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          aNum = aVal;
          bNum = bVal;
        } else {
          // String comparison for symbol, name, chain
          return sortDirection === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
        }

        // Adjust for Age: smaller timestamp = older token
        // In "desc" mode for age, we want newest first, so higher timestamp first
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      });
    } else {
      // Default: rank by selected timeframe (so chain switch + timeframe switch feels responsive)
      filtered.sort((a, b) => computeTimeframeScore(b as Token, timeframe) - computeTimeframeScore(a as Token, timeframe));
    }

    // Prevent one repeated symbol (e.g. many "ZORA") from monopolizing the visible ranking.
    // Only apply on trending feed without active search/sort to preserve explicit user intent.
    if (
      activeTab === 'trending' &&
      !searchQuery.trim() &&
      !sortBy
    ) {
      filtered = capDuplicateSymbols(filtered, 2);
    }

    return filtered;
  }, [tokens, allTokens, searchQuery, sortBy, sortDirection, selectedChain, activeTab, favoriteAddresses, timeframe]);

  const handleSort = (column: keyof Token) => {
    if (sortBy === column) {
      // Same column clicked: desc → asc → cancel
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // Was asc, now cancel sorting
        setSortBy(null);
        setSortDirection('desc');
      }
    } else {
      // New column: start with desc
      setSortBy(column);
      setSortDirection('desc');
    }
  };



  // Infinite scroll observer
  useEffect(() => {
    if (!loadingRef.current || filteredAndSortedTokens.length <= visibleCount) return;

    const root = document.querySelector('[data-scroll-container="app"]') as Element | null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 30);
        }
      },
      { threshold: 0.1, rootMargin: '200px', root }
    );

    observer.observe(loadingRef.current);
    return () => observer.disconnect();
  }, [filteredAndSortedTokens.length, visibleCount]);

  // Scroll fallback: some mobile/fast-scroll cases skip IntersectionObserver events.
  useEffect(() => {
    const root = document.querySelector('[data-scroll-container="app"]') as HTMLElement | null;
    if (!root || filteredAndSortedTokens.length <= visibleCount) return;

    const onScroll = () => {
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight;
      if (remaining < 400) {
        setVisibleCount((prev) => prev + 30);
      }
    };

    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, [filteredAndSortedTokens.length, visibleCount]);

  const SortIcon: React.FC<{ column: keyof Token }> = ({ column }) => {
    if (sortBy !== column) return null;
    return sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  // Convert token list data to detail page format
  const getFallbackDetail = (token: Token) => {
    const priceNum = parseFloat(token.price.replace('$', '').replace(',', '').replace(/\.\.\..*/, '') || '0');
    const priceChange = parseFloat(token.c24h.replace('%', '').replace('+', '') || '0');
    const symbol = token.symbol || token.name || 'UNKNOWN';

    return {
      name: token.name || 'Unknown Token',
      symbol: symbol,
      pair: `${symbol} / ${getNativeTokenSymbol(token.chain)}`,
      chain: token.chain,
      price: isNaN(priceNum) ? '0.000000' : priceNum.toFixed(18),
      priceChange24h: isNaN(priceChange) ? 0 : priceChange,
      address: token.address || '',
      fdv: token.fdv,
      mcap: token.fdv,
      liquidity: token.liquidity,
      volume24h: token.volume,
      holders: token.holders || token.makers || 0,
      imageUrl: token.imageUrl,
      poolAddress: token.poolAddress,
      riskScore: 50,
      audit: {
        status: "Unverified",
        warnings: [],
      },
      socialLinks: token.socialLinks,
    };
  };




  const handleTokenClick = (token: Token) => {
    if (!token.chain || !token.address) return;

    // Optimistic fallback data to pass via state
    const fallback = getFallbackDetail(token);

    // Navigate to the detail page route
    const chainSlug = token.network || token.chain.toLowerCase();
    navigate(`/tokens/${chainSlug}/${token.address}`, {
      state: { token: fallback }
    });
  };

  // Removed conditional rendering of TokenDetailPage



  const getChangeColumn = () => getTimeframeChangeColumn(timeframe);

  return (
    <PageContainer fullWidth className={styles.container}>
      {/* Token Table */}
      {/* Unified Main Section */}
      <div className={`${styles.content} ${isMobile ? styles.contentMobile : ''}`}>
        {/* Header Controls (Tabs & Search) - OUTSIDE of the main list card */}
        <div className={styles.controlBar}>
          <div className={styles.filterGroup}>
            <button
              className={`${styles.filterBtn} ${activeTab === 'trending' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveTab('trending')}
            >
              Trending
            </button>
            <button
              className={`${styles.filterBtn} ${activeTab === 'favorites' ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              Favorites
            </button>
          </div>

          <div className={styles.controlsRow}>
            <div className={styles.searchWrapper}>
              <Search size={18} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className={styles.clearButton}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Section - The Rectangular Card for List/States */}
        <div className={styles.mainSection}>

          {/* Loading Skeleton */}
          {
            (loading || initialLoading) && filteredAndSortedTokens.length === 0 && (
              <div className={styles.tableCard}>
                <table className={styles.table}>
                  <colgroup>
                    <col style={{ width: isMobile ? '32%' : '28%' }} />
                    <col style={{ width: isMobile ? '18%' : '14%' }} />
                    <col style={{ width: isMobile ? '14%' : '12%' }} />
                    <col style={{ width: isMobile ? '12%' : '8%' }} />
                    <col style={{ width: isMobile ? '24%' : '20%' }} />
                    {!isMobile && <col style={{ width: '18%' }} />}
                  </colgroup>
                  <thead className={styles.thead}>
                    <tr>
                      <th className={styles.th} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={styles.thContent}>Token Info</div>
                      </th>
                      <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>Price</div>
                      </th>
                      <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>{getTimeframeChangeLabel(timeframe)}</div>
                      </th>
                      <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>Age</div>
                      </th>
                      <th className={`${styles.th} ${styles.thRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                        <div className={`${styles.thContent} ${styles.thContentRight}`}>Vol / Liq</div>
                      </th>
                      {!isMobile && (
                        <th className={`${styles.th} ${styles.thCenter}`} style={{ padding: '12px 16px' }}>
                          <div className={`${styles.thContent} ${styles.thContentCenter}`}>Txns</div>
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className={styles.tbody}>
                    {Array.from({ length: 15 }).map((_, i) => (
                      <tr key={i} className={styles.tr}>
                        <td className={styles.td} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                          <div className={styles.skeletonCell}>
                            {/* [Logic]: Use variant="text" for rank placeholder. [Ref]: Skeleton API. [Risk]: Slight alignment offset on mobile. */}
                            {!isMobile && <Skeleton variant="text" width={18} height={14} style={{ marginRight: '4px' }} />}
                            <div className={`${styles.skeletonIconWrapper} ${isMobile ? styles.skeletonIconWrapperMobile : ''}`}>
                              {isMobile && <Skeleton variant="rectangular" width={24} height={10} borderRadius={3} style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }} />}
                              <Skeleton variant="circular" width={32} height={32} />
                              <Skeleton variant="circular" width={14} height={14} style={{ position: 'absolute', bottom: -2, right: -2, border: '2px solid var(--bg-primary)', zIndex: 1 }} />
                            </div>
                            <div>
                              <Skeleton variant="text" width={40} height={14} />
                              <Skeleton variant="text" width={60} height={12} style={{ marginTop: 4 }} />
                            </div>
                          </div>
                        </td>
                        <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                          <Skeleton variant="text" width={60} height={14} style={{ marginLeft: 'auto' }} />
                        </td>
                        <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                          <Skeleton variant="text" width={40} height={14} style={{ marginLeft: 'auto' }} />
                        </td>
                        <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                          <Skeleton variant="text" width={40} height={14} style={{ marginLeft: 'auto' }} />
                        </td>
                        <td className={`${styles.td} ${styles.tdRight}`} style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <Skeleton variant="text" width={60} height={12} />
                            <Skeleton variant="text" width={50} height={12} />
                          </div>
                        </td>
                        {!isMobile && (
                          <td className={`${styles.td} ${styles.tdCenter}`} style={{ padding: '12px 16px' }}>
                            <Skeleton variant="rectangular" width="80%" height={6} borderRadius={3} style={{ margin: '0 auto' }} />
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }

          {/* Error State - Only show if no data available */}
          {
            error && !loading && !initialLoading && allTokens.length === 0 && (
              <div className={styles.errorContainer}>
                <div className={styles.errorMessage}>
                  {error && (error.includes('request limit') || error.includes('429')) ? (
                    <>
                      <div>⚠️ API Rate Limit Exceeded</div>
                      <div style={{ fontSize: '12px', marginTop: '8px', opacity: 0.8 }}>
                        Please wait a moment and try again, or refresh the page
                      </div>
                    </>
                  ) : (
                    error
                  )}
                </div>
                {error && (error.includes('request limit') || error.includes('429')) && (
                  <button
                    onClick={() => {
                      setError(null);
                      setInitialLoading(true);
                      setReloadNonce((prev) => prev + 1);
                    }}
                    className={styles.retryBtn}
                  >
                    Retry now
                  </button>
                )}
              </div>
            )
          }

          {/* Empty State - Search with no results */}
          {
            !loading && !initialLoading && !error && searchQuery.trim() && filteredAndSortedTokens.length === 0 && (
              <div className={styles.emptyState}>
                <p>No tokens found for "{searchQuery}"</p>
                <p className={styles.emptyStateSub}>Try searching with a different term</p>
              </div>
            )
          }

          {/* Empty State - Chain filter with no results */}
          {
            !loading && !initialLoading && !error && !searchQuery.trim() && selectedChain !== 'all' && filteredAndSortedTokens.length === 0 && allTokens.length > 0 && (
              <div className={styles.emptyState}>
                <p>No tokens found for {CHAIN_OPTIONS.find(c => c.id === selectedChain)?.name || selectedChain}</p>
                <p className={styles.emptyStateSub}>Try selecting a different chain</p>
              </div>
            )
          }

          {
            filteredAndSortedTokens.length > 0 && (!loading || !searchQuery.trim()) && (
              <>
                <div className={styles.tableCard}>
                  <div className={styles.tableHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className={styles.tableTitle} style={{ margin: 0 }}>
                      {activeTab === 'favorites'
                        ? 'Favorites'
                        : 'Trending'}
                    </h2>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className={styles.timeframeSelector}>
                        {(['5m', '1h', '24h'] as TrendingTimeframe[]).map((tf) => (
                          <button
                            key={tf}
                            className={`${styles.timeframeBtn} ${timeframe === tf ? styles.timeframeBtnActive : ''}`}
                            onClick={() => setTimeframe(tf)}
                          >
                            {tf.toUpperCase()}
                          </button>
                        ))}
                      </div>

                      <div className={styles.chainSelector}>
                        <button
                          className={styles.chainSelectorBtn}
                          onClick={() => setShowChainDropdown(!showChainDropdown)}
                        >
                          {selectedChain === 'all' ? (
                            null
                          ) : (
                            <img
                              src={CHAIN_OPTIONS.find(c => c.id === selectedChain)?.logo}
                              alt={selectedChain}
                              className={styles.chainSelectorIcon}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <span>{selectedChain === 'all' ? 'All' : CHAIN_OPTIONS.find(c => c.id === selectedChain)?.id}</span>
                          <ChevronDown size={14} />
                        </button>
                        {showChainDropdown && (
                          <div className={styles.chainDropdown}>
                            {CHAIN_OPTIONS.map(chain => (
                              <button
                                key={chain.id}
                                className={`${styles.chainOption} ${selectedChain === chain.id ? styles.chainOptionActive : ''}`}
                                onClick={() => {
                                  setSelectedChain(chain.id);
                                  setShowChainDropdown(false);
                                }}
                              >
                                {chain.logo ? (
                                  <img
                                    src={chain.logo}
                                    alt={chain.name}
                                    className={styles.chainOptionIcon}
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <span className={styles.allChainsIcon}>⛓</span>
                                )}
                                <span>{chain.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <table className={styles.table}>
                    <colgroup>
                      <col style={{ width: isMobile ? '32%' : '28%' }} />
                      <col style={{ width: isMobile ? '18%' : '14%' }} />
                      <col style={{ width: isMobile ? '14%' : '12%' }} />
                      <col style={{ width: isMobile ? '12%' : '8%' }} />
                      <col style={{ width: isMobile ? '24%' : '20%' }} />
                      {!isMobile && <col style={{ width: '18%' }} />}
                    </colgroup>
                    <thead className={styles.thead}>
                      <tr>
                        <th
                          className={styles.th}
                          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                          onClick={() => handleSort('symbol')}
                        >
                          <div className={styles.thContent}>
                            Token Info
                            <SortIcon column="symbol" />
                          </div>
                        </th>
                        <th
                          className={`${styles.th} ${styles.thRight}`}
                          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                          onClick={() => handleSort('price')}
                        >
                          <div className={`${styles.thContent} ${styles.thContentRight}`}>
                            Price
                            <SortIcon column="price" />
                          </div>
                        </th>
                        <th
                          className={`${styles.th} ${styles.thRight}`}
                          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                          onClick={() => handleSort(getChangeColumn() as keyof Token)}
                        >
                          <div className={`${styles.thContent} ${styles.thContentRight}`}>
                            {getTimeframeChangeLabel(timeframe)}
                            <SortIcon column={getChangeColumn() as keyof Token} />
                          </div>
                        </th>
                        <th
                          className={`${styles.th} ${styles.thRight}`}
                          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                          onClick={() => handleSort('age')}
                        >
                          <div className={`${styles.thContent} ${styles.thContentRight}`}>
                            Age
                            <SortIcon column="age" />
                          </div>
                        </th>
                        <th
                          className={`${styles.th} ${styles.thRight}`}
                          style={{ padding: isMobile ? '10px 8px' : '12px 16px' }}
                          onClick={() => handleSort('volume')}
                        >
                          <div className={`${styles.thContent} ${styles.thContentRight}`}>
                            Vol / Liq
                            <SortIcon column="volume" />
                          </div>
                        </th>
                        {!isMobile && (
                          <th
                            className={`${styles.th} ${styles.thCenter}`}
                            style={{ padding: '12px 16px' }}
                            onClick={() => handleSort('txns')}
                          >
                            <div className={`${styles.thContent} ${styles.thContentCenter}`}>
                              Txns
                              <SortIcon column="txns" />
                            </div>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className={styles.tbody}>
                      {filteredAndSortedTokens.slice(0, visibleCount).map((t, i) => (
                        <TokenRow
                          key={`${t.chain}-${t.address || t.poolAddress || t.symbol}-${t.id}`}
                          token={t}
                          index={i}
                          isMobile={isMobile}
                          timeframe={timeframe}
                          onTokenClick={handleTokenClick}
                        />
                      ))}
                    </tbody>
                  </table>

                  {filteredAndSortedTokens.length > visibleCount && (
                    <div ref={loadingRef} className={styles.infiniteScrollLoader}>
                      <div className={styles.loadingSpinnerSmall}></div>
                      <span>Loading more tokens...</span>
                      <button
                        type="button"
                        className={styles.loadMoreBtn}
                        onClick={() => setVisibleCount((prev) => prev + 30)}
                      >
                        Load more
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
        </div>
      </div>
    </PageContainer>
  );
};
