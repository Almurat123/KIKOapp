import fs from 'node:fs';
import process from 'node:process';

type ParsedArgs = {
  logPath: string;
};

function parseArgs(argv: string[]): ParsedArgs {
  const fromEnv = String(process.env.LOG_PATH || '').trim();
  let logPath = fromEnv;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--log' && argv[i + 1]) {
      logPath = argv[++i];
    }
  }
  if (!logPath) {
    throw new Error('Missing --log <path> (or LOG_PATH env)');
  }
  return { logPath };
}

function parseReasonCode(line: string): string {
  const matched = line.match(/\breasonCode=([a-zA-Z0-9_]+)/);
  return matched?.[1] || 'unknown';
}

function parseIntField(line: string, field: string): number {
  const matched = line.match(new RegExp(`\\b${field}=([0-9]+)`));
  return Number(matched?.[1] || 0);
}

function parseBooleanField(line: string, field: string): boolean {
  const matched = line.match(new RegExp(`\\b${field}=(true|false)`));
  return matched?.[1] === 'true';
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(args.logPath)) {
    throw new Error(`Log file not found: ${args.logPath}`);
  }
  const text = fs.readFileSync(args.logPath, 'utf8');
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.includes('[CopyTradeDomain] solana_target_resolution_observed'));

  const reasonCounts = new Map<string, number>();
  let fallbackCount = 0;
  let parsedTxAvailableCount = 0;
  let trackedWalletTotal = 0;
  let candidateTotal = 0;
  let signerCandidateTotal = 0;

  for (const line of lines) {
    const reasonCode = parseReasonCode(line);
    reasonCounts.set(reasonCode, (reasonCounts.get(reasonCode) || 0) + 1);
    if (parseBooleanField(line, 'usedPendingHintFallback')) fallbackCount += 1;
    if (parseBooleanField(line, 'parsedTxAvailable')) parsedTxAvailableCount += 1;
    trackedWalletTotal += parseIntField(line, 'trackedWalletCount');
    candidateTotal += parseIntField(line, 'rawCandidateCount');
    signerCandidateTotal += parseIntField(line, 'rawSignerCandidateCount');
  }

  const reasons = Array.from(reasonCounts.entries())
    .map(([reasonCode, count]) => ({
      reasonCode,
      count,
      ratio: lines.length > 0 ? Number((count / lines.length).toFixed(4)) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  console.log(JSON.stringify({
    logPath: args.logPath,
    totalResolutionEvents: lines.length,
    pendingHintFallbackHits: fallbackCount,
    parsedTxAvailableHits: parsedTxAvailableCount,
    avgTrackedWalletCount: lines.length > 0 ? Number((trackedWalletTotal / lines.length).toFixed(4)) : 0,
    avgRawCandidateCount: lines.length > 0 ? Number((candidateTotal / lines.length).toFixed(4)) : 0,
    avgRawSignerCandidateCount: lines.length > 0 ? Number((signerCandidateTotal / lines.length).toFixed(4)) : 0,
    reasonBreakdown: reasons,
  }, null, 2));
}

main().catch((error) => {
  console.error('[summarizeSolanaTargetResolutionAudit] failed', error);
  process.exitCode = 1;
});
