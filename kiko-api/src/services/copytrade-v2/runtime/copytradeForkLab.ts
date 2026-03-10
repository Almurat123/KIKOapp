import { getChainConfig } from '../../../config/chainConfig.js';

export const DEFAULT_FORK_LAB_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const DEFAULT_FORK_LAB_MNEMONIC = 'test test test test test test test test test test test junk';

type SupportedForkLabChain = {
  chainId: number;
  rpcEnvVar: string;
  defaultPort: number;
  label: string;
};

const SUPPORTED_FORK_LAB_CHAINS: Record<number, SupportedForkLabChain> = {
  1: { chainId: 1, rpcEnvVar: 'ETH_RPC_URL', defaultPort: 9545, label: 'Ethereum' },
  8453: { chainId: 8453, rpcEnvVar: 'BASE_RPC_URL', defaultPort: 9546, label: 'Base' },
  56: { chainId: 56, rpcEnvVar: 'BSC_RPC_URL', defaultPort: 9547, label: 'BSC' },
};

const RPC_HOST_DENYLIST = [
  'alchemy.com',
];

function selectForkableRpcUrl(urls: string[]): string {
  const normalized = urls
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (normalized.length === 0) return '';

  const preferred = normalized.find((url) => !RPC_HOST_DENYLIST.some((deny) => url.includes(deny)));
  return preferred || normalized[0] || '';
}

export type CopytradeForkLabTarget = {
  chainId: number;
  label: string;
  rpcEnvVar: string;
  upstreamRpcUrl: string;
  localRpcUrl: string;
  port: number;
};

export function getSupportedForkLabChainIds(): number[] {
  return Object.keys(SUPPORTED_FORK_LAB_CHAINS)
    .map((value) => Number(value))
    .sort((left, right) => left - right);
}

export function resolveCopytradeForkLabTargets(params?: {
  chains?: number[];
  basePort?: number;
  host?: string;
}): CopytradeForkLabTarget[] {
  const host = params?.host || '127.0.0.1';
  const requestedChains = params?.chains && params.chains.length > 0
    ? params.chains
    : [1, 8453, 56];
  const basePort = Number.isFinite(params?.basePort) ? Number(params?.basePort) : 9545;

  return requestedChains.map((chainId, index) => {
    const supported = SUPPORTED_FORK_LAB_CHAINS[chainId];
    if (!supported) {
      throw new Error(`Unsupported fork lab chain: ${chainId}`);
    }

    const chainConfig = getChainConfig(chainId);
    const upstreamRpcUrl = selectForkableRpcUrl(chainConfig.rpcUrls);
    if (!upstreamRpcUrl) {
      throw new Error(`No upstream RPC URL resolved for chain ${chainId} (${supported.label})`);
    }

    const port = basePort + index;
    return {
      chainId,
      label: supported.label,
      rpcEnvVar: supported.rpcEnvVar,
      upstreamRpcUrl,
      localRpcUrl: `http://${host}:${port}`,
      port,
    };
  });
}

export function buildCopytradeForkLabEnv(targets: CopytradeForkLabTarget[], privateKey: string = DEFAULT_FORK_LAB_PRIVATE_KEY): Record<string, string> {
  const env: Record<string, string> = {
    LOCAL_SIGNER_ENABLED: 'true',
    LOCAL_SIGNER_PRIVATE_KEY: privateKey,
  };

  for (const target of targets) {
    env[target.rpcEnvVar] = target.localRpcUrl;
    env[`LOCAL_SIGNER_RPC_URL_${target.chainId}`] = target.localRpcUrl;
    env[`LOCAL_SIGNER_PRIVATE_KEY_${target.chainId}`] = privateKey;
  }

  return env;
}

export function formatShellExports(env: Record<string, string>): string {
  return Object.entries(env)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `export ${key}=${shellEscape(value)}`)
    .join('\n');
}

export function buildAnvilArgs(target: CopytradeForkLabTarget, options?: {
  mnemonic?: string;
  accounts?: number;
  balance?: number;
}): string[] {
  const accounts = Math.max(1, Math.floor(options?.accounts || 20));
  const balance = Number.isFinite(options?.balance) ? Number(options?.balance) : 1000000;
  return [
    '--host', '127.0.0.1',
    '--port', String(target.port),
    '--chain-id', String(target.chainId),
    '--fork-url', target.upstreamRpcUrl,
    '--accounts', String(accounts),
    '--balance', String(balance),
    '--mnemonic', options?.mnemonic || DEFAULT_FORK_LAB_MNEMONIC,
  ];
}

function shellEscape(value: string): string {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}
