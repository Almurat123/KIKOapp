import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import { getChainConfig } from '../../../config/chainConfig.js';
import { SOLANA_CONFIG, getSolanaConnection } from '../../../config/solanaConfig.js';
import { NATIVE_TOKEN_ADDRESS, isNativeToken } from '../../../config/tokenRegistry.js';
import { getNativeTokenPriceUsd } from '../../onChainPriceService.js';
import { getTokenInfo } from '../../tokenService.js';
import { getErc20Balance, getErc20Decimals, getNativeBalance } from '../../rpcManager.js';

const DEFAULT_MIN_AMOUNT = 0.0000001;

function normalizeAddress(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function formatHumanAmount(value: number, maxDecimals = 12): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const fixed = value.toFixed(maxDecimals);
  return fixed.replace(/\.?0+$/, '');
}

function isStablecoinToken(token: string, chainId: number): boolean {
  const normalized = normalizeAddress(token);
  if (!normalized) return false;

  if (chainId === 900) {
    return normalized === normalizeAddress(SOLANA_CONFIG.TOKENS.USDC)
      || normalized === normalizeAddress(SOLANA_CONFIG.TOKENS.USDT);
  }

  const chainConfig = getChainConfig(chainId);
  return (chainConfig.stablecoins || []).some((item) => normalizeAddress(item) === normalized);
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
  const normalizedToken = normalizeAddress(params.tokenIn);
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
    getErc20Balance(normalizedToken, params.walletAddress, params.chainId).catch(() => 0n),
    getErc20Decimals(normalizedToken, params.chainId).catch(() => 18),
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
  const normalizedToken = normalizeAddress(params.tokenIn);
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
  let decimals = 9;
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

export async function resolveSellAmountInHuman(params: {
  walletAddress: string;
  tokenIn: string;
  chainId: number;
}): Promise<string | null> {
  if (!params.walletAddress) return null;
  if (params.chainId === 900) {
    return await resolveSolanaSellAmountInHuman({
      walletAddress: params.walletAddress,
      tokenIn: params.tokenIn,
    });
  }
  return await resolveEvmSellAmountInHuman(params);
}
