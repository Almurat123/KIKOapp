import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import prisma from '../../../db/prisma.js';
import { getChainConfig } from '../../../config/chainConfig.js';
import { SOLANA_CONFIG, getSolanaConnection } from '../../../config/solanaConfig.js';
import { NATIVE_TOKEN_ADDRESS, isNativeToken } from '../../../config/tokenRegistry.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { getTokenInfo } from '../../tokenService.js';
import { getErc20Balance, getErc20Decimals, getNativeBalance } from '../../rpcManager.js';
import { normalizeToken } from '../runtime/chainIdentityNormalizer.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';

const DEFAULT_MIN_AMOUNT = 0.0000001;
const DEFAULT_EVM_DECIMALS = 18;
const DEFAULT_SOLANA_DECIMALS = 9;

export type SellAmountFallbackSource =
  | 'wallet_balance'
  | 'pending_lot'
  | 'ledger'
  | 'inferred_source_ratio';

export interface SellAmountResolverContext {
  userId?: string | null;
  configId?: string | null;
  targetWallet?: string | null;
  mode?: CopytradeMode;
  sourceAmountIn?: string | number | null;
}

export interface SellAmountResolution {
  amountInHuman: string | null;
  source: SellAmountFallbackSource | null;
  metadata: Record<string, unknown>;
}

interface SellAmountProbeResult {
  amountInHuman: string | null;
  metadata?: Record<string, unknown>;
}

export interface SellAmountResolverOverrides {
  resolveWalletAmountInHuman?: (params: {
    walletAddress: string;
    tokenIn: string;
    chainId: number;
  }) => Promise<SellAmountProbeResult>;
  resolvePendingLotAmountInHuman?: (params: {
    tokenIn: string;
    chainId: number;
    context: SellAmountResolverContext;
  }) => Promise<SellAmountProbeResult>;
  resolveLedgerAmountInHuman?: (params: {
    tokenIn: string;
    chainId: number;
    context: SellAmountResolverContext;
  }) => Promise<SellAmountProbeResult>;
  resolveInferredAmountInHuman?: (params: {
    tokenIn: string;
    chainId: number;
    context: SellAmountResolverContext;
  }) => Promise<SellAmountProbeResult>;
}

function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value && 'toString' in value) {
    return String((value as { toString(): string }).toString()).trim();
  }
  return String(value).trim();
}

function normalizeAddress(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function formatHumanAmount(value: number, maxDecimals = 12): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const fixed = value.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, '');
}

function parsePositiveNumber(value: unknown): number | null {
  const raw = toText(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parsePositiveBigInt(value: unknown): bigint | null {
  const raw = toText(value);
  if (!raw || !/^[0-9]+$/.test(raw)) return null;
  try {
    const parsed = BigInt(raw);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function parseAmountHuman(value: unknown): string | null {
  const parsed = parsePositiveNumber(value);
  if (!parsed || parsed <= DEFAULT_MIN_AMOUNT) return null;
  return formatHumanAmount(parsed);
}

function toAmountFromRaw(value: bigint, decimals: number, maxDecimals = 12): string | null {
  if (value <= 0n) return null;
  const human = Number(ethers.formatUnits(value, decimals));
  if (!Number.isFinite(human) || human <= DEFAULT_MIN_AMOUNT) return null;
  return formatHumanAmount(human, maxDecimals);
}

function isStablecoinToken(token: string, chainId: number): boolean {
  const normalized = normalizeToken(chainId, token);
  if (!normalized) return false;

  if (chainId === 900) {
    return normalized === normalizeToken(chainId, SOLANA_CONFIG.TOKENS.USDC)
      || normalized === normalizeToken(chainId, SOLANA_CONFIG.TOKENS.USDT);
  }

  const chainConfig = getChainConfig(chainId);
  return (chainConfig.stablecoins || []).some((item) => normalizeAddress(item) === normalizeAddress(normalized));
}

async function resolveUsdPrice(tokenAddress: string, chainId: number): Promise<number> {
  if (isStablecoinToken(tokenAddress, chainId)) return 1;

  if (isNativeToken(tokenAddress, chainId)) {
    const nativePrice = await getNativeTokenPriceUsd(chainId).catch(() => 0);
    return Number.isFinite(nativePrice) && nativePrice > 0 ? nativePrice : 0;
  }

  const tokenInfo = await getTokenInfo(tokenAddress, chainId, {
    verbose: false,
    priority: 'high',
    fastMode: true,
    rpcStrategy: 'fast',
  }).catch(() => null);

  const price = Number(tokenInfo?.price || 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

async function resolveTokenDecimals(params: {
  chainId: number;
  tokenIn: string;
}): Promise<number> {
  const tokenIn = normalizeToken(params.chainId, params.tokenIn);
  if (!tokenIn) return params.chainId === 900 ? DEFAULT_SOLANA_DECIMALS : DEFAULT_EVM_DECIMALS;
  if (isNativeToken(tokenIn, params.chainId) || tokenIn === NATIVE_TOKEN_ADDRESS) {
    return params.chainId === 900 ? DEFAULT_SOLANA_DECIMALS : DEFAULT_EVM_DECIMALS;
  }

  if (params.chainId === 900) {
    const tokenInfo = await getTokenInfo(tokenIn, params.chainId, {
      verbose: false,
      priority: 'high',
      fastMode: true,
      rpcStrategy: 'fast',
    }).catch(() => null);
    const decimals = Number(tokenInfo?.decimals || DEFAULT_SOLANA_DECIMALS);
    return Number.isFinite(decimals) && decimals > 0 ? decimals : DEFAULT_SOLANA_DECIMALS;
  }

  const decimals = await getErc20Decimals(tokenIn, params.chainId, 'latest', { lane: 'critical' }).catch(() => DEFAULT_EVM_DECIMALS);
  if (Number.isFinite(decimals) && decimals > 0) return decimals;
  return DEFAULT_EVM_DECIMALS;
}

export async function resolveBuyAmountInHuman(params: {
  tokenIn: string;
  chainId: number;
  buyAmountUsd: number;
}): Promise<{ amountInHuman: string | null; priceUsd: number | null }> {
  const buyAmountUsd = Number(params.buyAmountUsd || 0);
  if (!Number.isFinite(buyAmountUsd) || buyAmountUsd <= 0) {
    return { amountInHuman: null, priceUsd: null };
  }

  const priceUsd = await resolveUsdPrice(params.tokenIn, params.chainId);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    return { amountInHuman: null, priceUsd: null };
  }

  const amountIn = buyAmountUsd / priceUsd;
  if (!Number.isFinite(amountIn) || amountIn <= DEFAULT_MIN_AMOUNT) {
    return { amountInHuman: null, priceUsd };
  }

  return {
    amountInHuman: formatHumanAmount(amountIn),
    priceUsd,
  };
}

async function resolveEvmSellAmountInHuman(params: {
  walletAddress: string;
  tokenIn: string;
  chainId: number;
}): Promise<string | null> {
  const normalizedToken = normalizeToken(params.chainId, params.tokenIn);
  if (!normalizedToken) return null;

  if (isNativeToken(normalizedToken, params.chainId) || normalizedToken === normalizeAddress(NATIVE_TOKEN_ADDRESS)) {
    const raw = await getNativeBalance(params.walletAddress, params.chainId).catch(() => '0x0');
    const balanceWei = raw.startsWith('0x') ? BigInt(raw) : BigInt(raw || '0');
    if (balanceWei <= 0n) return null;
    const keepForGasWei = ethers.parseUnits('0.002', 18);
    const sellWei = balanceWei > keepForGasWei ? balanceWei - keepForGasWei : 0n;
    if (sellWei <= 0n) return null;
    const human = Number(ethers.formatUnits(sellWei, 18));
    return human > DEFAULT_MIN_AMOUNT ? formatHumanAmount(human) : null;
  }

  const [rawBalance, decimals] = await Promise.all([
    getErc20Balance(normalizedToken, params.walletAddress, params.chainId, 'latest', { lane: 'critical' }).catch(() => 0n),
    getErc20Decimals(normalizedToken, params.chainId, 'latest', { lane: 'critical' }).catch(() => DEFAULT_EVM_DECIMALS),
  ]);

  if (rawBalance <= 0n) return null;
  const sellRaw = (rawBalance * 9950n) / 10000n;
  if (sellRaw <= 0n) return null;

  const human = Number(ethers.formatUnits(sellRaw, decimals));
  return human > DEFAULT_MIN_AMOUNT ? formatHumanAmount(human) : null;
}

async function resolveSolanaSellAmountInHuman(params: {
  walletAddress: string;
  tokenIn: string;
}): Promise<string | null> {
  const normalizedToken = normalizeToken(900, params.tokenIn);
  if (!normalizedToken) return null;
  let owner: PublicKey;
  try {
    owner = new PublicKey(params.walletAddress);
  } catch {
    return null;
  }

  if (isNativeToken(normalizedToken, 900)) {
    const connection = getSolanaConnection();
    const lamports = await connection.getBalance(owner).catch(() => 0);
    if (lamports <= 0) return null;
    const keepLamports = 5_000_000; // keep 0.005 SOL for fees
    const sellLamports = lamports > keepLamports ? lamports - keepLamports : 0;
    if (sellLamports <= 0) return null;
    const human = sellLamports / 1_000_000_000;
    return human > DEFAULT_MIN_AMOUNT ? formatHumanAmount(human, 9) : null;
  }

  const connection = getSolanaConnection();
  let mint: PublicKey;
  try {
    mint = new PublicKey(normalizedToken);
  } catch {
    return null;
  }
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint }).catch(() => null);
  if (!accounts || !accounts.value.length) return null;

  let rawBalance = 0n;
  let decimals = DEFAULT_SOLANA_DECIMALS;
  for (const account of accounts.value) {
    const tokenAmount = account.account.data.parsed.info.tokenAmount;
    rawBalance += BigInt(String(tokenAmount.amount || '0'));
    decimals = Number(tokenAmount.decimals || decimals);
  }

  if (rawBalance <= 0n) return null;
  const sellRaw = (rawBalance * 9950n) / 10000n;
  if (sellRaw <= 0n) return null;

  const human = Number(ethers.formatUnits(sellRaw, decimals));
  return human > DEFAULT_MIN_AMOUNT ? formatHumanAmount(human, Math.min(9, decimals)) : null;
}

async function resolveSellAmountFromWallet(params: {
  walletAddress: string;
  tokenIn: string;
  chainId: number;
}): Promise<SellAmountProbeResult> {
  if (!params.walletAddress) return { amountInHuman: null };
  if (params.chainId === 900) {
    const amountInHuman = await resolveSolanaSellAmountInHuman({
      walletAddress: params.walletAddress,
      tokenIn: params.tokenIn,
    });
    return { amountInHuman };
  }
  const amountInHuman = await resolveEvmSellAmountInHuman(params);
  return { amountInHuman };
}

async function resolveSellAmountFromPendingLot(params: {
  tokenIn: string;
  chainId: number;
  context: SellAmountResolverContext;
}): Promise<SellAmountProbeResult> {
  if (!params.context.userId) return { amountInHuman: null };
  const normalizedToken = normalizeToken(params.chainId, params.tokenIn);
  if (!normalizedToken) return { amountInHuman: null };

  const row = await prisma.pendingAttributedPosition.findFirst({
    where: {
      userId: params.context.userId,
      chainId: params.chainId,
      tokenAddress: normalizedToken,
      status: { in: ['sell_armed', 'armed'] },
      ...(params.context.configId
        ? {
            position: { configId: params.context.configId },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      expectedAmountDec: true,
      expectedAmountRaw: true,
    },
  });

  if (!row) return { amountInHuman: null };

  const expectedAmountDec = parseAmountHuman(row.expectedAmountDec);
  if (expectedAmountDec) {
    return {
      amountInHuman: expectedAmountDec,
      metadata: {
        pendingLotId: row.id,
        pendingLotStatus: row.status,
      },
    };
  }

  const expectedAmountRaw = parsePositiveBigInt(row.expectedAmountRaw);
  if (!expectedAmountRaw) return { amountInHuman: null };
  const decimals = await resolveTokenDecimals({
    chainId: params.chainId,
    tokenIn: normalizedToken,
  });
  const amountInHuman = toAmountFromRaw(expectedAmountRaw, decimals, params.chainId === 900 ? 9 : 12);
  if (!amountInHuman) return { amountInHuman: null };

  return {
    amountInHuman,
    metadata: {
      pendingLotId: row.id,
      pendingLotStatus: row.status,
      decimals,
    },
  };
}

async function resolveSellAmountFromLedger(params: {
  tokenIn: string;
  chainId: number;
  context: SellAmountResolverContext;
}): Promise<SellAmountProbeResult> {
  if (!params.context.userId) return { amountInHuman: null };
  const normalizedToken = normalizeToken(params.chainId, params.tokenIn);
  if (!normalizedToken) return { amountInHuman: null };

  const row = await prisma.copytradePositionLedger.findFirst({
    where: {
      userId: params.context.userId,
      chainId: params.chainId,
      tokenAddress: normalizedToken,
      ...(params.context.configId ? { configId: params.context.configId } : {}),
      closedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      lifecycleState: true,
      sellableAmountRaw: true,
      effectiveOwnedAmountRaw: true,
      pendingOwnedAmountRaw: true,
    },
  });

  if (!row) return { amountInHuman: null };

  const raw = parsePositiveBigInt(row.sellableAmountRaw)
    || parsePositiveBigInt(row.effectiveOwnedAmountRaw)
    || parsePositiveBigInt(row.pendingOwnedAmountRaw);
  if (!raw) return { amountInHuman: null };

  const decimals = await resolveTokenDecimals({
    chainId: params.chainId,
    tokenIn: normalizedToken,
  });
  const amountInHuman = toAmountFromRaw(raw, decimals, params.chainId === 900 ? 9 : 12);
  if (!amountInHuman) return { amountInHuman: null };

  return {
    amountInHuman,
    metadata: {
      ledgerId: row.id,
      ledgerLifecycleState: row.lifecycleState,
      decimals,
    },
  };
}

function parseMetadataNumber(metadata: unknown, key: string): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return parsePositiveNumber(value);
}

async function resolveSellAmountFromInferredRatio(params: {
  tokenIn: string;
  chainId: number;
  context: SellAmountResolverContext;
}): Promise<SellAmountProbeResult> {
  if (params.context.mode === 'safety') return { amountInHuman: null };
  if (!params.context.userId) return { amountInHuman: null };

  const normalizedToken = normalizeToken(params.chainId, params.tokenIn);
  if (!normalizedToken) return { amountInHuman: null };

  const position = await prisma.position.findFirst({
    where: {
      userId: params.context.userId,
      chainId: params.chainId,
      tokenAddress: normalizedToken,
      status: 'open',
      ...(params.context.configId ? { configId: params.context.configId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      entryAmount: true,
      entryAmountDec: true,
    },
  });
  if (!position) return { amountInHuman: null };

  const baseAmount = parsePositiveNumber(position.entryAmountDec) || parsePositiveNumber(position.entryAmount);
  if (!baseAmount) return { amountInHuman: null };

  let ratio = 1;
  let leaderBuyAmountOut: number | null = null;
  const leaderSellAmountIn = parsePositiveNumber(params.context.sourceAmountIn);

  if (leaderSellAmountIn && leaderSellAmountIn > 0) {
    const buyRef = await prisma.copytradeOrder.findFirst({
      where: {
        userId: params.context.userId,
        chainId: params.chainId,
        tokenOut: normalizedToken,
        direction: 'buy',
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        metadataJson: true,
      },
    });
    leaderBuyAmountOut = parseMetadataNumber(buyRef?.metadataJson, 'amountOut');
    if (leaderBuyAmountOut && leaderBuyAmountOut > 0) {
      ratio = leaderSellAmountIn / leaderBuyAmountOut;
    }
  }

  const boundedRatio = Math.max(0.05, Math.min(1.2, ratio));
  const inferredAmount = baseAmount * boundedRatio;
  const amountInHuman = inferredAmount > DEFAULT_MIN_AMOUNT
    ? formatHumanAmount(inferredAmount, params.chainId === 900 ? 9 : 12)
    : null;
  if (!amountInHuman) return { amountInHuman: null };

  return {
    amountInHuman,
    metadata: {
      inferredRatio: boundedRatio,
      inferredFromPositionId: position.id,
      leaderSellAmountIn: leaderSellAmountIn || null,
      leaderBuyAmountOut: leaderBuyAmountOut || null,
    },
  };
}

export async function resolveSellAmountInHuman(params: {
  walletAddress: string;
  tokenIn: string;
  chainId: number;
  context?: SellAmountResolverContext;
  overrides?: SellAmountResolverOverrides;
}): Promise<SellAmountResolution> {
  if (!params.walletAddress) {
    return {
      amountInHuman: null,
      source: null,
      metadata: { reason: 'missing_wallet_address' },
    };
  }

  const context = params.context || {};
  const attemptedSources: SellAmountFallbackSource[] = [];

  const walletProbe = params.overrides?.resolveWalletAmountInHuman
    ? await params.overrides.resolveWalletAmountInHuman({
        walletAddress: params.walletAddress,
        tokenIn: params.tokenIn,
        chainId: params.chainId,
      })
    : await resolveSellAmountFromWallet(params);
  attemptedSources.push('wallet_balance');
  if (walletProbe.amountInHuman && Number(walletProbe.amountInHuman) > 0) {
    return {
      amountInHuman: walletProbe.amountInHuman,
      source: 'wallet_balance',
      metadata: {
        attemptedSources,
      },
    };
  }

  const pendingProbe = params.overrides?.resolvePendingLotAmountInHuman
    ? await params.overrides.resolvePendingLotAmountInHuman({
        tokenIn: params.tokenIn,
        chainId: params.chainId,
        context,
      })
    : await resolveSellAmountFromPendingLot({
        tokenIn: params.tokenIn,
        chainId: params.chainId,
        context,
      });
  attemptedSources.push('pending_lot');
  if (pendingProbe.amountInHuman && Number(pendingProbe.amountInHuman) > 0) {
    return {
      amountInHuman: pendingProbe.amountInHuman,
      source: 'pending_lot',
      metadata: {
        attemptedSources,
        ...(pendingProbe.metadata || {}),
      },
    };
  }

  const ledgerProbe = params.overrides?.resolveLedgerAmountInHuman
    ? await params.overrides.resolveLedgerAmountInHuman({
        tokenIn: params.tokenIn,
        chainId: params.chainId,
        context,
      })
    : await resolveSellAmountFromLedger({
        tokenIn: params.tokenIn,
        chainId: params.chainId,
        context,
      });
  attemptedSources.push('ledger');
  if (ledgerProbe.amountInHuman && Number(ledgerProbe.amountInHuman) > 0) {
    return {
      amountInHuman: ledgerProbe.amountInHuman,
      source: 'ledger',
      metadata: {
        attemptedSources,
        ...(ledgerProbe.metadata || {}),
      },
    };
  }

  attemptedSources.push('inferred_source_ratio');
  if (context.mode === 'safety') {
    return {
      amountInHuman: null,
      source: null,
      metadata: {
        attemptedSources,
        reason: 'sell_amount_inferred_disabled_in_safety_mode',
      },
    };
  }

  const inferredProbe = params.overrides?.resolveInferredAmountInHuman
    ? await params.overrides.resolveInferredAmountInHuman({
        tokenIn: params.tokenIn,
        chainId: params.chainId,
        context,
      })
    : await resolveSellAmountFromInferredRatio({
        tokenIn: params.tokenIn,
        chainId: params.chainId,
        context,
      });
  if (inferredProbe.amountInHuman && Number(inferredProbe.amountInHuman) > 0) {
    return {
      amountInHuman: inferredProbe.amountInHuman,
      source: 'inferred_source_ratio',
      metadata: {
        attemptedSources,
        ...(inferredProbe.metadata || {}),
      },
    };
  }

  return {
    amountInHuman: null,
    source: null,
    metadata: {
      attemptedSources,
      reason: 'sell_amount_all_fallbacks_exhausted',
    },
  };
}
