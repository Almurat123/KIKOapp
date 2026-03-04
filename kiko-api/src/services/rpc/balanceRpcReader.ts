import { ethers } from 'ethers';
import * as rpcManager from '../rpcManager.js';
import { normalizeAddress } from '../../utils/address.js';

const ERC20_BALANCE_OF_ABI = ['function balanceOf(address owner) view returns (uint256)'];
const ERC20_DECIMALS_ABI = ['function decimals() view returns (uint8)'];

const BALANCE_RPC_OPTIONS = {
  strategy: 'cheap' as const,
  importance: 'normal' as const,
  exhaustiveFailover: true as const,
};

let callRpcRawFn: typeof rpcManager.callRpcRaw = rpcManager.callRpcRaw;

function withPath(path?: string): { path: string } {
  return { path: path || 'balance_reader' };
}

function assertRawResult<T>(response: { result?: T; error?: { message?: string } }, fallbackError: string): T {
  if (response.error) {
    throw new Error(response.error.message || fallbackError);
  }
  if (response.result === undefined || response.result === null) {
    throw new Error(fallbackError);
  }
  return response.result;
}

export async function readEvmTokenBalanceFast(params: {
  tokenAddress: string;
  walletAddress: string;
  chainId: number | string;
  blockTag?: string | number;
  path?: string;
}): Promise<bigint> {
  const tokenAddress = normalizeAddress(params.tokenAddress);
  const walletAddress = normalizeAddress(params.walletAddress);
  const blockTag = params.blockTag ?? 'latest';
  const iface = new ethers.Interface(ERC20_BALANCE_OF_ABI);
  const data = iface.encodeFunctionData('balanceOf', [walletAddress]);
  const response = await callRpcRawFn<string>(
    params.chainId,
    'eth_call',
    [{ to: tokenAddress, data }, blockTag],
    {
      ...BALANCE_RPC_OPTIONS,
      ...withPath(params.path || 'evm_token_balance_fast'),
    }
  );
  const raw = assertRawResult(response, 'evm_balance_call_failed');
  if (!raw || raw === '0x') return 0n;
  const [decoded] = iface.decodeFunctionResult('balanceOf', raw);
  return BigInt(decoded);
}

export async function readEvmTokenDecimalsFast(params: {
  tokenAddress: string;
  chainId: number | string;
  blockTag?: string | number;
  path?: string;
}): Promise<number> {
  const tokenAddress = normalizeAddress(params.tokenAddress);
  const blockTag = params.blockTag ?? 'latest';
  const iface = new ethers.Interface(ERC20_DECIMALS_ABI);
  const data = iface.encodeFunctionData('decimals', []);
  const response = await callRpcRawFn<string>(
    params.chainId,
    'eth_call',
    [{ to: tokenAddress, data }, blockTag],
    {
      ...BALANCE_RPC_OPTIONS,
      ...withPath(params.path || 'evm_token_decimals_fast'),
    }
  );
  const raw = assertRawResult(response, 'evm_decimals_call_failed');
  if (!raw || raw === '0x') return 18;
  const [decoded] = iface.decodeFunctionResult('decimals', raw);
  const decimals = Number(decoded);
  return Number.isFinite(decimals) ? decimals : 18;
}

export async function readNativeBalanceFast(params: {
  walletAddress: string;
  chainIdOrName: number | string;
  blockTag?: string | number;
  path?: string;
}): Promise<bigint> {
  const blockTag = params.blockTag ?? 'latest';
  const chain = params.chainIdOrName;
  const isSolana = chain === 900 || String(chain).toLowerCase() === 'solana';
  if (isSolana) {
    const response = await callRpcRawFn<{ value: number }>(
      'solana',
      'getBalance',
      [params.walletAddress],
      {
        ...BALANCE_RPC_OPTIONS,
        ...withPath(params.path || 'solana_native_balance_fast'),
      }
    );
    const raw = assertRawResult(response, 'solana_native_balance_failed');
    return BigInt(raw.value || 0);
  }

  const response = await callRpcRawFn<string>(
    chain,
    'eth_getBalance',
    [params.walletAddress, blockTag],
    {
      ...BALANCE_RPC_OPTIONS,
      ...withPath(params.path || 'evm_native_balance_fast'),
    }
  );
  const raw = assertRawResult(response, 'evm_native_balance_failed');
  return raw ? BigInt(raw) : 0n;
}

export async function readSolanaTokenBalanceFast(params: {
  walletAddress: string;
  tokenAddress: string;
  path?: string;
}): Promise<{ balanceRaw: bigint; decimals: number }> {
  const response = await callRpcRawFn<{ value: Array<{ account?: { data?: { parsed?: { info?: any } } } }> }>(
    'solana',
    'getTokenAccountsByOwner',
    [
      params.walletAddress,
      { mint: params.tokenAddress },
      { encoding: 'jsonParsed' },
    ],
    {
      ...BALANCE_RPC_OPTIONS,
      ...withPath(params.path || 'solana_token_balance_fast'),
    }
  );
  const raw = assertRawResult(response, 'solana_token_balance_failed');
  const accounts = Array.isArray(raw.value) ? raw.value : [];
  let balanceRaw = 0n;
  let decimals = 9;
  for (const account of accounts) {
    const tokenAmount = account?.account?.data?.parsed?.info?.tokenAmount;
    const amount = tokenAmount?.amount;
    if (amount !== undefined && amount !== null) {
      try {
        balanceRaw += BigInt(String(amount));
      } catch {
        // Ignore malformed account amount and continue with remaining accounts.
      }
    }
    const nextDecimals = Number(tokenAmount?.decimals);
    if (Number.isFinite(nextDecimals) && nextDecimals >= 0) {
      decimals = nextDecimals;
    }
  }
  return { balanceRaw, decimals };
}

export const __balanceRpcReaderTest = {
  setCallRpcRawForTest(fn: typeof rpcManager.callRpcRaw): void {
    callRpcRawFn = fn;
  },
  resetForTest(): void {
    callRpcRawFn = rpcManager.callRpcRaw;
  },
};
