/**
 * Security rules and thresholds for local detectors.
 * All values are conservative defaults; adjust via env or edit here.
 */

export interface ChainConfig {
  chain: string;
  rpcEnv: string;
  defaultLookbackBlocks: number;
  labelMixers: string[];
  labelExchanges: string[];
  rateLimitMs?: number;
}

export interface Thresholds {
  sellFailRate: number; // e.g., 0.1 = 10%
  taxJump: number; // absolute delta, e.g., 0.05 = 5%
  taxMax: number; // e.g., 0.2 = 20%
  lpDrop: number; // e.g., 0.05 = 5%
  bigTxSupply: number; // fraction of total supply
  bigTxTVL: number; // fraction of TVL
  watchlistBurst: number; // number of addresses added to list
}

export interface Heuristics {
  name: string;
  description: string;
  chains: string[];
}

export const thresholds: Thresholds = {
  sellFailRate: parseFloat(process.env.SECURITY_THRESHOLD_SELL_FAIL_RATE || '0.10'),
  taxJump: parseFloat(process.env.SECURITY_THRESHOLD_TAX_JUMP || '0.05'),
  taxMax: parseFloat(process.env.SECURITY_THRESHOLD_TAX_MAX || '0.20'),
  lpDrop: parseFloat(process.env.SECURITY_THRESHOLD_LP_DROP || '0.05'),
  bigTxSupply: parseFloat(process.env.SECURITY_THRESHOLD_BIG_TX_SUPPLY || '0.01'),
  bigTxTVL: parseFloat(process.env.SECURITY_THRESHOLD_BIG_TX_TVL || '0.10'),
  watchlistBurst: parseInt(process.env.SECURITY_THRESHOLD_WATCHLIST_BURST || '20', 10),
};

export const chainConfigs: ChainConfig[] = [
  {
    chain: 'eth',
    rpcEnv: 'SECURITY_RPC_ETH',
    defaultLookbackBlocks: 500,
    labelMixers: ['tornado', 'mixer'],
    labelExchanges: ['binance', 'okx', 'coinbase', 'kraken', 'bybit', 'gate'],
    rateLimitMs: 200, // 5 requests per second
  },
  {
    chain: 'bsc',
    rpcEnv: 'SECURITY_RPC_BSC',
    defaultLookbackBlocks: 500,
    labelMixers: ['tornado', 'mixer'],
    labelExchanges: ['binance', 'okx', 'bybit', 'gate'],
    rateLimitMs: 200,
  },
  {
    chain: 'base',
    rpcEnv: 'SECURITY_RPC_BASE',
    defaultLookbackBlocks: 500,
    labelMixers: ['tornado', 'mixer'],
    labelExchanges: ['coinbase', 'binance', 'okx'],
    rateLimitMs: 200,
  },
  {
    chain: 'arb',
    rpcEnv: 'SECURITY_RPC_ARB',
    defaultLookbackBlocks: 500,
    labelMixers: ['tornado', 'mixer'],
    labelExchanges: ['binance', 'okx', 'kraken'],
    rateLimitMs: 200,
  },
  {
    chain: 'polygon',
    rpcEnv: 'SECURITY_RPC_POLYGON',
    defaultLookbackBlocks: 500,
    labelMixers: ['tornado', 'mixer'],
    labelExchanges: ['binance', 'okx', 'bybit'],
    rateLimitMs: 200,
  },
  // Solana config placeholder - scripts require non-EVM adapter
  {
    chain: 'solana',
    rpcEnv: 'SOLANA_RPC_URL',
    defaultLookbackBlocks: 1000,
    labelMixers: ['mixer'],
    labelExchanges: ['binance', 'okx', 'kraken', 'coinbase'],
    rateLimitMs: 200,
  }
];

export const heuristics: Heuristics[] = [
  {
    name: 'lp-short-lock',
    description: 'LP 未锁或锁定 <30 天，或初始 LP < $5K',
    chains: ['eth', 'bsc', 'base', 'arb', 'polygon'],
  },
  {
    name: 'tax-spike',
    description: '税率跳变 >5% 或 税率 >20%',
    chains: ['eth', 'bsc', 'base', 'arb', 'polygon'],
  },
  {
    name: 'multi-pool-split',
    description: '多池拆分，主池小额锁，侧池未锁',
    chains: ['eth', 'bsc', 'base', 'arb', 'polygon'],
  },
  {
    name: 'deploy-burst',
    description: '同部署者 N 小时内新合约数量 >5',
    chains: ['eth', 'bsc', 'base', 'arb', 'polygon'],
  },
  {
    name: 'meme-drain',
    description: 'MEME：<72h 峰值后拔池，或仅一次卖出成功',
    chains: ['eth', 'bsc', 'base', 'arb', 'polygon'],
  },
  {
    name: 'arb-router-check',
    description: 'Arbitrum：检查路由白名单外的自建路由，处理事件乱序去重',
    chains: ['arb'],
  },
  {
    name: 'polygon-tax-freq',
    description: 'Polygon：频繁改税 → 高权重',
    chains: ['polygon'],
  },
];

export function getRpc(chain: string): string | undefined {
  const cfg = chainConfigs.find(c => c.chain === chain);
  if (!cfg) return undefined;
  return process.env[cfg.rpcEnv];
}

export function getWatchTokens(): string[] {
  const raw = process.env.SECURITY_WATCH_TOKENS || '';
  return raw.split(',').map(t => t.trim()).filter(Boolean);
}

export const OUTPUT_DIR = process.env.SECURITY_OUTPUT_DIR || '/tmp/kiko-security';
export const OUTPUT_ALERTS = `${OUTPUT_DIR}/runtime-alerts.jsonl`;
export const OUTPUT_FLOWS = `${OUTPUT_DIR}/fund-flows.json`;
export const OUTPUT_FINGERPRINTS = `${OUTPUT_DIR}/fingerprints.jsonl`;
export const OUTPUT_SUMMARY = 'reports/security-summary.md';
export const OUTPUT_METRICS = 'reports/security-metrics.json';


