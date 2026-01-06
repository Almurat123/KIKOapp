/**
 * Runtime detectors (local-only)
 * - Fetch recent logs for watched tokens
 * - Apply simple heuristics (owner/upgrade/list bursts not fully implemented; placeholders)
 * - Emit JSONL alerts for AI consumption (no external alerts)
 */

import { mkdirSync, existsSync, appendFileSync } from 'fs';
import { JsonRpcProvider, Log, ethers } from 'ethers';
import { OUTPUT_ALERTS, OUTPUT_DIR, chainConfigs, getRpc, getWatchTokens, thresholds } from './config/rules.js';

interface Alert {
  ts: number;
  chain: string;
  type: string;
  severity: 'info' | 'warn' | 'high' | 'critical';
  reason: string;
  evidence?: Record<string, unknown>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchLogs(provider: JsonRpcProvider, token: string, fromBlock: number, toBlock: number): Promise<Log[]> {
  const iface = new ethers.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)',
  ]);
  const filter = {
    address: token,
    fromBlock,
    toBlock,
    topics: [iface.getEvent('Transfer')!.topicHash],
  };
  return provider.getLogs(filter);
}

function emitAlert(alert: Alert) {
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  appendFileSync(OUTPUT_ALERTS, JSON.stringify(alert) + '\n', 'utf8');
}

async function processChain(chain: string) {
  const rpc = getRpc(chain);
  if (!rpc) return;

  // Skip if rate limit requires it or chain is not supported (e.g. Solana)
  if (chain === 'solana') return;

  const cfg = chainConfigs.find(c => c.chain === chain);
  const rateLimitMs = cfg?.rateLimitMs || 200;

  try {
    const provider = new JsonRpcProvider(rpc);
    const watchTokens = getWatchTokens();
    if (watchTokens.length === 0) return;

    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - (cfg?.defaultLookbackBlocks ?? 500));

    // Reuse interface outside the loop
    const iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
    const zero = '0x0000000000000000000000000000000000000000';

    for (const token of watchTokens) {
      try {
        const logs = await fetchLogs(provider, token, fromBlock, latest);

        let mints = 0;
        let burns = 0;
        let largeMoves = 0;

        for (const log of logs) {
          try {
            const parsed = iface.parseLog(log);
            if (!parsed) continue;

            const from = parsed.args.from.toLowerCase();
            const to = parsed.args.to.toLowerCase();
            const value = parsed.args.value as bigint;

            if (from === zero) mints++;
            if (to === zero) burns++;

            // Heuristic for large move: > 100 * 10^18 (assuming 18 decimals)
            // Ideally we should fetch decimals(), but skipping for speed/rate-limit
            if (value > BigInt(100) * BigInt(10) ** BigInt(18)) largeMoves++;
          } catch (e) {
            // Ignore parse errors (e.g. non-standard Transfer event)
            continue;
          }
        }

        if (mints > 0) {
          emitAlert({
            ts: Date.now(),
            chain,
            type: 'mint-detected',
            severity: 'warn',
            reason: `Token ${token} minted ${mints} times in last window`,
            evidence: { mints, fromBlock, latest },
          });
        }

        if (burns > 0) {
          emitAlert({
            ts: Date.now(),
            chain,
            type: 'burn-detected',
            severity: 'info',
            reason: `Token ${token} burned ${burns} times in last window`,
            evidence: { burns, fromBlock, latest },
          });
        }

        if (largeMoves > 0) {
          emitAlert({
            ts: Date.now(),
            chain,
            type: 'large-move',
            severity: 'warn',
            reason: `Token ${token} had ${largeMoves} large transfers`,
            evidence: { largeMoves, fromBlock, latest },
          });
        }

        // Rate limit between tokens
        await sleep(rateLimitMs);
      } catch (err: any) {
        console.error(`[Detector] Error scanning token ${token} on ${chain}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[Detector] Chain error ${chain}: ${err.message}`);
  }
}

async function main() {
  const chains = chainConfigs.map(c => c.chain);
  await Promise.all(chains.map(processChain));
}

main().catch(err => {
  emitAlert({
    ts: Date.now(),
    chain: 'system',
    type: 'runtime-error',
    severity: 'high',
    reason: err?.message || 'runtime error',
  });
  process.exitCode = 1;
});

