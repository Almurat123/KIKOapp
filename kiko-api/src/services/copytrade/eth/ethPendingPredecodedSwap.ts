import { getChainConfig } from '../../../config/chainConfig.js';
import { normalizeAddress } from '../../../utils/address.js';
import type { DecodedSwap } from '../../txDecoder.js';
import { getDexName } from '../../txDecoder.js';
import { isSwapTransaction } from '../../txDecoder/evmSwapEvidence.js';
import { resolveEthPendingSelectorCapability } from './ethPendingSelectorRegistry.js';

const NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function extractPaddedAddresses(input: string): string[] {
  const raw = String(input || '').toLowerCase().replace(/^0x/, '');
  if (!raw) return [];
  const matches = [...raw.matchAll(/000000000000000000000000([0-9a-f]{40})/g)];
  return matches.map((match) => `0x${match[1]}`);
}

function isExcludedAddress(params: {
  address: string;
  wallet: string;
  router: string;
  wrappedNative: string;
  stablecoins: Set<string>;
}): boolean {
  const normalized = normalizeAddress(params.address);
  if (!normalized || normalized === ZERO_ADDRESS || normalized === normalizeAddress(NATIVE_PLACEHOLDER)) return true;
  if (normalized === params.wallet || normalized === params.router || normalized === params.wrappedNative) return true;
  if (params.stablecoins.has(normalized)) return true;
  return false;
}

function inferTokenOutFromInput(params: {
  input: string;
  wallet: string;
  router: string;
  wrappedNative: string;
  stablecoins: Set<string>;
}): string | null {
  const addresses = extractPaddedAddresses(params.input).map((value) => normalizeAddress(value));
  if (addresses.length === 0) return null;

  const walletIndex = addresses.findIndex((value) => value === params.wallet);
  if (walletIndex >= 0) {
    for (let i = walletIndex + 1; i < addresses.length; i += 1) {
      const candidate = addresses[i];
      if (!isExcludedAddress({
        address: candidate,
        wallet: params.wallet,
        router: params.router,
        wrappedNative: params.wrappedNative,
        stablecoins: params.stablecoins,
      })) {
        return candidate;
      }
    }
  }

  for (let i = addresses.length - 1; i >= 0; i -= 1) {
    const candidate = addresses[i];
    if (!isExcludedAddress({
      address: candidate,
      wallet: params.wallet,
      router: params.router,
      wrappedNative: params.wrappedNative,
      stablecoins: params.stablecoins,
    })) {
      return candidate;
    }
  }

  return null;
}

function buildNativeBuyFromPaddedTokenOut(params: {
  chainId: number;
  matchedWallet: string;
  txHash: string;
  tx: { from?: string; to?: string; input?: string; value?: string | bigint };
  selector: string;
}): DecodedSwap | null {
  const wallet = normalizeAddress(params.matchedWallet);
  const from = normalizeAddress(String(params.tx?.from || ''));
  const router = normalizeAddress(String(params.tx?.to || ''));
  const input = String(params.tx?.input || '');
  if (!wallet || !from || !router) return null;
  if (wallet !== from) return null;
  if (!/^0x[0-9a-f]{8}$/.test(params.selector) || !isSwapTransaction(input)) return null;

  let nativeValue = 0n;
  try {
    nativeValue = typeof params.tx?.value === 'bigint'
      ? params.tx.value
      : BigInt(String(params.tx?.value || '0'));
  } catch {
    nativeValue = 0n;
  }
  if (nativeValue <= 0n) return null;

  const chainConfig = getChainConfig(params.chainId);
  const stablecoins = new Set((chainConfig.stablecoins || []).map((token) => normalizeAddress(token)));
  const tokenOut = inferTokenOutFromInput({
    input,
    wallet,
    router,
    wrappedNative: normalizeAddress(chainConfig.wrappedNativeAddress),
    stablecoins,
  });
  if (!tokenOut) return null;

  return {
    txHash: params.txHash,
    sourceTxInput: input,
    sourceTxValue: nativeValue.toString(),
    sourceSelector: params.selector,
    tokenIn: NATIVE_PLACEHOLDER,
    tokenOut,
    amountIn: nativeValue.toString(),
    amountOut: '0',
    router,
    dexName: getDexName(router, params.chainId),
    cashLegHint: {
      inferredTxType: 'TARGET_BUY',
    },
  };
}

export function buildEthPendingPredecodedSwap(params: {
  chainId: number;
  matchedWallet: string;
  txHash: string;
  tx: { from?: string; to?: string; input?: string; value?: string | bigint };
}): DecodedSwap | null {
  if (params.chainId !== 1) return null;
  const input = String(params.tx?.input || '');
  const selector = input.startsWith('0x') ? input.slice(0, 10).toLowerCase() : '';
  const capability = resolveEthPendingSelectorCapability(selector);
  if (capability.kind === 'unsupported') return null;

  if (capability.kind === 'native_buy_padded_tokenout') {
    return buildNativeBuyFromPaddedTokenOut({
      ...params,
      selector,
    });
  }

  return null;
}
