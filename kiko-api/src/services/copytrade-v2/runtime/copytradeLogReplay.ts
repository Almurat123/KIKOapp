import fs from 'node:fs';

export type CopytradeReplayEvent = {
  txHash: string;
  chainId: number;
  network: string;
  targetWallet: string;
  sourceTxFrom?: string;
  timestampMs: number;
  timingSource?: string;
};

const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  1: 'ETH_MAINNET',
  56: 'BNB_MAINNET',
  8453: 'BASE_MAINNET',
  900: 'SOLANA_MAINNET',
};

function toTimestampMs(value: unknown): number {
  const text = String(value || '').trim();
  if (!text) return 0;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHash(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeAddress(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function buildReplayKey(event: CopytradeReplayEvent): string {
  return `${event.chainId}:${event.txHash}:${event.targetWallet}`;
}

function parseJsonReplayEvents(filePath: string): CopytradeReplayEvent[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload)) return [];

  const events = new Map<string, CopytradeReplayEvent>();
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue;
    const message = String((row as any).message || '');
    const metadata = (row as any).attributes?.metadata || {};
    if (!message.includes('fast_dispatch_decision')) continue;
    const txHash = normalizeHash(metadata.txHash);
    const chainId = Number(metadata.chainId || 0);
    const targetWallet = normalizeAddress(metadata.targetWallet);
    if (!txHash || !chainId || !targetWallet) continue;

    const event: CopytradeReplayEvent = {
      txHash,
      chainId,
      network: CHAIN_ID_TO_NETWORK[chainId] || String(metadata.network || ''),
      targetWallet,
      sourceTxFrom: normalizeAddress(metadata.sourceTxFrom || '') || undefined,
      timestampMs: toTimestampMs((row as any).timestamp || (row as any).attributes?.timestamp),
      timingSource: String(metadata.timingSource || ''),
    };
    if (!event.network) continue;
    events.set(buildReplayKey(event), event);
  }

  return Array.from(events.values()).sort((left, right) => left.timestampMs - right.timestampMs);
}

function parsePlainLogReplayEvents(filePath: string): CopytradeReplayEvent[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');
  const events = new Map<string, CopytradeReplayEvent>();
  const regex = /\[CopyTradeTimingAudit\] fast_dispatch_decision/;

  for (const line of lines) {
    if (!regex.test(line)) continue;
    const txHashMatch = line.match(/txHash=([0-9a-zA-Zx]+)/i);
    const chainIdMatch = line.match(/chainId=(\d+)/i);
    const walletMatch = line.match(/targetWallet=([0-9a-zA-Zx]+)/i);
    const networkMatch = line.match(/network=([A-Z_0-9]+)/i);
    if (!txHashMatch || !chainIdMatch || !walletMatch) continue;

    const chainId = Number(chainIdMatch[1]);
    const event: CopytradeReplayEvent = {
      txHash: normalizeHash(txHashMatch[1]),
      chainId,
      network: String(networkMatch?.[1] || CHAIN_ID_TO_NETWORK[chainId] || ''),
      targetWallet: normalizeAddress(walletMatch[1]),
      timestampMs: toTimestampMs(line.slice(0, 30)),
    };
    if (!event.network) continue;
    events.set(buildReplayKey(event), event);
  }

  return Array.from(events.values()).sort((left, right) => left.timestampMs - right.timestampMs);
}

export function readReplayEventsFromLogFile(filePath: string): CopytradeReplayEvent[] {
  if (filePath.endsWith('.json')) {
    return parseJsonReplayEvents(filePath);
  }
  return parsePlainLogReplayEvents(filePath);
}

export function sliceReplayEvents(events: CopytradeReplayEvent[], options?: {
  limit?: number;
  chainIds?: number[];
  targetWallet?: string;
}): CopytradeReplayEvent[] {
  const chainIdSet = options?.chainIds && options.chainIds.length > 0
    ? new Set(options.chainIds)
    : null;
  const targetWallet = options?.targetWallet ? normalizeAddress(options.targetWallet) : '';

  const filtered = events.filter((event) => {
    if (chainIdSet && !chainIdSet.has(event.chainId)) return false;
    if (targetWallet && event.targetWallet !== targetWallet) return false;
    return true;
  });

  if (options?.limit && options.limit > 0) {
    return filtered.slice(0, options.limit);
  }
  return filtered;
}

export function buildReplaySchedule(events: CopytradeReplayEvent[], speedMultiplier: number = 1): Array<CopytradeReplayEvent & { delayMs: number }> {
  if (events.length === 0) return [];
  const firstTs = events[0]!.timestampMs;
  const speed = Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1;
  return events.map((event) => ({
    ...event,
    delayMs: Math.max(0, Math.round((event.timestampMs - firstTs) / speed)),
  }));
}
