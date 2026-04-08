// CONTEXT MEMORY
// Updated: 2026-04-08
// Author: Murat
// Reason: Add a repeatable smoke test for live trending-token discovery and direct-swap
//         route construction without broadcasting transactions.
// Goal: Validate that the four target networks still produce executable direct-swap
//       paths from hot-token discovery through quote/build and pre-sim.
// Owns: Read-only trending fetches, sample selection, simulation-only swap execution,
//       and structured summary output for operators.
// Does Not Own: Production routing policy, broadcast behavior, approval policy, or
//               any permanent execution state.
// Design Language:
// - Prefer simulation-only validation over real broadcast for smoke tests.
// - Fetch the full trending window first, then test a bounded sample.
// - Preserve actionable failures instead of hiding them behind empty success output.
// - Never add cache-busting noise to read paths unless the test explicitly needs it.
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/owner-map/backend-swap-validation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-08-trending-direct-swap-smoke-test.md

import { Wallet } from 'ethers';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { DEFAULT_FORK_LAB_PRIVATE_KEY } from '../services/copytrade-v2/runtime/copytradeForkLab.js';
import { executeDirectSwap } from '../services/dex/directSwap/orchestrator.js';
import { getTrendingTokens, type TokenSearchResult } from '../services/geckoTerminal.js';
import { getTrendingTokensPremium } from '../services/dexscreener.js';
import { getSolanaQuote, SOLANA_NATIVE_MINT } from '../services/solanaSwap.js';

type ChainSpec = {
  chainId: number;
  label: string;
  trendingLimit: number;
  sampleSize: number;
  nativeAmount: string;
  source: 'dexscreener' | 'geckoterminal';
};

type SmokeRow = {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  status: 'passed' | 'failed' | 'skipped';
  mode: 'direct-swap' | 'solana-quote';
  provider?: string;
  txHash?: string;
  aggregator?: string;
  outAmount?: string;
  error?: string;
};

type EvmSmokeResult = {
  chainId: number;
  label: string;
  walletAddress: string;
  fetched: number;
  tested: number;
  passed: number;
  failed: number;
  rows: SmokeRow[];
};

type SolanaSmokeResult = {
  chainId: number;
  label: string;
  fetched: number;
  tested: number;
  passed: number;
  failed: number;
  rows: SmokeRow[];
};

const DEFAULT_SAMPLE_SIZE = 3;
const DEFAULT_TRENDING_LIMIT = 50;
const DEFAULT_EVM_NATIVE_AMOUNT = '0.01';
const DEFAULT_SOL_LAMPORTS = '1000000';
const NATIVE_PLACEHOLDER = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const CHAIN_SPECS: ChainSpec[] = [
  { chainId: 1, label: 'ethereum', trendingLimit: DEFAULT_TRENDING_LIMIT, sampleSize: DEFAULT_SAMPLE_SIZE, nativeAmount: DEFAULT_EVM_NATIVE_AMOUNT, source: 'dexscreener' },
  { chainId: 8453, label: 'base', trendingLimit: DEFAULT_TRENDING_LIMIT, sampleSize: DEFAULT_SAMPLE_SIZE, nativeAmount: DEFAULT_EVM_NATIVE_AMOUNT, source: 'dexscreener' },
  { chainId: 56, label: 'bsc', trendingLimit: DEFAULT_TRENDING_LIMIT, sampleSize: DEFAULT_SAMPLE_SIZE, nativeAmount: DEFAULT_EVM_NATIVE_AMOUNT, source: 'dexscreener' },
  { chainId: 900, label: 'solana', trendingLimit: DEFAULT_TRENDING_LIMIT, sampleSize: DEFAULT_SAMPLE_SIZE, nativeAmount: DEFAULT_SOL_LAMPORTS, source: 'geckoterminal' },
];

function parseStringFlag(name: string, fallback = ''): string {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

function parseNumberFlag(name: string, fallback: number): number {
  const value = Number(parseStringFlag(name, String(fallback)));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseChainFilter(): number[] | undefined {
  const raw = parseStringFlag('chains');
  if (!raw) return undefined;
  const values = raw.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value > 0);
  return values.length > 0 ? values : undefined;
}

function uniqueTokens(tokens: TokenSearchResult[]): TokenSearchResult[] {
  const seen = new Set<string>();
  const result: TokenSearchResult[] = [];
  for (const token of tokens) {
    const key = String(token.address || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(token);
  }
  return result;
}

function selectActionableTokens(tokens: TokenSearchResult[], sampleSize: number): TokenSearchResult[] {
  return uniqueTokens(tokens)
    .filter((token) => Boolean(token.address))
    .slice(0, sampleSize);
}

function resolveEvmWalletAddress(): string {
  const explicit = parseStringFlag('walletAddress');
  if (explicit) return explicit;
  const privateKey = process.env.LOCAL_SIGNER_PRIVATE_KEY || DEFAULT_FORK_LAB_PRIVATE_KEY;
  return new Wallet(privateKey).address;
}

function resolveUserId(): string {
  return parseStringFlag('userId') || 'direct-swap-smoke';
}

function resolveSolanaUserAddress(): string {
  const explicit = parseStringFlag('solanaUserAddress');
  if (explicit) return explicit;
  return Keypair.generate().publicKey.toBase58();
}

async function fetchTrendingTokensForChain(spec: ChainSpec): Promise<TokenSearchResult[]> {
  if (spec.source === 'geckoterminal') {
    return await getTrendingTokens('solana', spec.trendingLimit, '5m', 1000, 5);
  }
  return await getTrendingTokensPremium(spec.label, spec.trendingLimit, { disableGeckoFill: true });
}

async function runEvmSmoke(spec: ChainSpec, tokens: TokenSearchResult[], walletAddress: string, userId: string): Promise<EvmSmokeResult> {
  const selected = selectActionableTokens(tokens, spec.sampleSize);
  const rows: SmokeRow[] = [];
  let passed = 0;
  let failed = 0;

  for (const token of selected) {
    try {
      const result = await executeDirectSwap({
        userId,
        accessToken: '',
        walletAddress,
        tokenIn: NATIVE_PLACEHOLDER,
        tokenOut: token.address,
        amountIn: spec.nativeAmount,
        chainId: spec.chainId,
        slippageBps: 1000,
        executionMode: 'normal',
      });

      if (result.success) {
        passed += 1;
        rows.push({
          tokenAddress: token.address,
          tokenSymbol: token.symbol || '',
          tokenName: token.name || '',
          status: 'passed',
          mode: 'direct-swap',
          provider: result.provider,
          txHash: result.txHash,
          outAmount: result.amountOut,
        });
      } else {
        failed += 1;
        rows.push({
          tokenAddress: token.address,
          tokenSymbol: token.symbol || '',
          tokenName: token.name || '',
          status: 'failed',
          mode: 'direct-swap',
          provider: result.provider,
          error: result.error || 'direct_swap_failed',
        });
      }
    } catch (error: any) {
      failed += 1;
      rows.push({
        tokenAddress: token.address,
        tokenSymbol: token.symbol || '',
        tokenName: token.name || '',
        status: 'failed',
        mode: 'direct-swap',
        error: error?.message || String(error),
      });
    }
  }

  return {
    chainId: spec.chainId,
    label: spec.label,
    walletAddress,
    fetched: tokens.length,
    tested: selected.length,
    passed,
    failed,
    rows,
  };
}

async function runSolanaSmoke(spec: ChainSpec, tokens: TokenSearchResult[], userAddress: string): Promise<SolanaSmokeResult> {
  const selected = selectActionableTokens(tokens, spec.sampleSize);
  const rows: SmokeRow[] = [];
  let passed = 0;
  let failed = 0;

  for (const token of selected) {
    try {
      const quote = await getSolanaQuote(
        SOLANA_NATIVE_MINT,
        token.address,
        spec.nativeAmount,
        300,
        'auto',
        userAddress,
        undefined,
        'swap'
      );

      if (!quote) {
        failed += 1;
        rows.push({
          tokenAddress: token.address,
          tokenSymbol: token.symbol || '',
          tokenName: token.name || '',
          status: 'failed',
          mode: 'solana-quote',
          error: 'no_quote_returned',
        });
        continue;
      }

      if (!quote.swapTransaction) {
        failed += 1;
        rows.push({
          tokenAddress: token.address,
          tokenSymbol: token.symbol || '',
          tokenName: token.name || '',
          status: 'failed',
          mode: 'solana-quote',
          aggregator: quote.aggregator,
          outAmount: quote.outAmount,
          error: 'missing_swap_transaction',
        });
        continue;
      }

      const tx = VersionedTransaction.deserialize(Buffer.from(quote.swapTransaction, 'base64'));
      const instructionCount = ((tx.message as any).compiledInstructions?.length || 0);
      passed += 1;
      rows.push({
        tokenAddress: token.address,
        tokenSymbol: token.symbol || '',
        tokenName: token.name || '',
        status: 'passed',
        mode: 'solana-quote',
        aggregator: quote.aggregator,
        outAmount: quote.outAmount,
        txHash: `${instructionCount}ix`,
      });
    } catch (error: any) {
      failed += 1;
      rows.push({
        tokenAddress: token.address,
        tokenSymbol: token.symbol || '',
        tokenName: token.name || '',
        status: 'failed',
        mode: 'solana-quote',
        error: error?.message || String(error),
      });
    }
  }

  return {
    chainId: spec.chainId,
    label: spec.label,
    fetched: tokens.length,
    tested: selected.length,
    passed,
    failed,
    rows,
  };
}

async function main(): Promise<void> {
  process.env.SIMULATION_MODE = 'true';

  const sampleSize = parseNumberFlag('sample', DEFAULT_SAMPLE_SIZE);
  const trendingLimit = parseNumberFlag('limit', DEFAULT_TRENDING_LIMIT);
  const chainFilter = parseChainFilter();
  const userId = resolveUserId();
  const evmWalletAddress = resolveEvmWalletAddress();
  const solanaUserAddress = resolveSolanaUserAddress();
  const jsonOnly = hasFlag('json');

  const specs = CHAIN_SPECS.filter((spec) => !chainFilter || chainFilter.includes(spec.chainId));
  const summary: {
    startedAt: string;
    sampleSize: number;
    trendingLimit: number;
    evmWalletAddress: string;
    solanaUserAddress: string;
    chains: Array<EvmSmokeResult | SolanaSmokeResult>;
  } = {
    startedAt: new Date().toISOString(),
    sampleSize,
    trendingLimit,
    evmWalletAddress,
    solanaUserAddress,
    chains: [],
  };

  for (const spec of specs) {
    const effectiveSpec = { ...spec, sampleSize, trendingLimit };
    const tokens = await fetchTrendingTokensForChain(effectiveSpec);
    if (spec.chainId === 900) {
      summary.chains.push(await runSolanaSmoke(effectiveSpec, tokens, solanaUserAddress));
    } else {
      summary.chains.push(await runEvmSmoke(effectiveSpec, tokens, evmWalletAddress, userId));
    }
  }

  const aggregate = summary.chains.reduce((acc, chain) => {
    acc.fetched += chain.fetched;
    acc.tested += chain.tested;
    acc.passed += chain.passed;
    acc.failed += chain.failed;
    return acc;
  }, { fetched: 0, tested: 0, passed: 0, failed: 0 });

  const payload = {
    ...summary,
    aggregate,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
  console.log(`\n[smoke] fetched=${aggregate.fetched} tested=${aggregate.tested} passed=${aggregate.passed} failed=${aggregate.failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
