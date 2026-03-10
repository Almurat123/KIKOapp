import {
  buildReplaySchedule,
  readReplayEventsFromLogFile,
  sliceReplayEvents,
} from '../services/copytrade-v2/runtime/copytradeLogReplay.js';

function parseNumberFlag(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) return fallback;
  const parsed = Number(arg.slice(prefix.length));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringFlag(name: string): string {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : '';
}

function parseChainIds(): number[] | undefined {
  const raw = parseStringFlag('chains');
  if (!raw) return undefined;
  const chainIds = raw.split(',').map((value) => Number(value.trim())).filter((value) => Number.isFinite(value) && value > 0);
  return chainIds.length > 0 ? chainIds : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const logFile = parseStringFlag('log');
  if (!logFile) {
    throw new Error('Missing required --log=/absolute/path/to/logs.json');
  }

  const apiBaseUrl = parseStringFlag('apiBaseUrl') || 'http://127.0.0.1:3001';
  const speed = parseNumberFlag('speed', 20);
  const limit = parseNumberFlag('limit', 10);
  const chainIds = parseChainIds();
  const targetWallet = parseStringFlag('targetWallet');
  const dryRun = hasFlag('dry-run');
  const internalSecret = process.env.INTERNAL_WEBHOOK_SECRET || '';

  const allEvents = readReplayEventsFromLogFile(logFile);
  const selected = sliceReplayEvents(allEvents, { limit, chainIds, targetWallet });
  const schedule = buildReplaySchedule(selected, speed);

  if (dryRun) {
    console.log(JSON.stringify({
      mode: 'dry-run',
      logFile,
      apiBaseUrl,
      selected: schedule,
    }, null, 2));
    return;
  }

  const startedAt = Date.now();
  const results: Array<Record<string, unknown>> = [];
  for (const event of schedule) {
    const waitMs = Math.max(0, event.delayMs - (Date.now() - startedAt));
    if (waitMs > 0) {
      await sleep(waitMs);
    }

    const response = await fetch(`${apiBaseUrl}/api/webhook/process-tx`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(internalSecret ? { 'x-internal-secret': internalSecret } : {}),
      },
      body: JSON.stringify({
        wallet: event.targetWallet,
        txHash: event.txHash,
        network: event.network,
        sourceTxFrom: event.sourceTxFrom,
      }),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text
    }
    results.push({
      txHash: event.txHash,
      chainId: event.chainId,
      network: event.network,
      wallet: event.targetWallet,
      status: response.status,
      ok: response.ok,
      body,
    });
  }

  console.log(JSON.stringify({
    mode: 'replayed',
    logFile,
    apiBaseUrl,
    requested: schedule.length,
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
