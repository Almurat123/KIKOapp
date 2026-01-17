import fs from 'node:fs';

type DexRow = {
  chainHint: string;
  rank: number;
  dex: string;
  symbol?: string;
  priceUsd?: number;
  age?: string;
  boosts?: number | null;
  txns?: number;
  volumeUsd?: number;
  makers?: number;
  change5m?: number | null;
  change1h?: number | null;
  change6h?: number | null;
  change24h?: number | null;
  liquidityUsd?: number;
  fdvUsd?: number;
};

function toLines(text: string): string[] {
  return text
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseIntLoose(value: string): number | null {
  const cleaned = value.replace(/,/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '—') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePct(value: string): number | null {
  if (!value || value === '-' || value === '—') return null;
  const cleaned = value.replace(/,/g, '').replace(/%/g, '').trim();
  if (!cleaned) return null;
  const m = cleaned.match(/^(-?\d+(?:\.\d+)?)([KMB])?$/i);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = (m[2] || '').toUpperCase();
  const mul = suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1;
  return base * mul;
}

function parseUsd(value: string): number | null {
  if (!value || value === '-' || value === '—') return null;
  const cleaned = value.replace(/,/g, '').trim();
  const m = cleaned.match(/^\$?(-?\d+(?:\.\d+)?)([KMB])?$/i);
  if (!m) return null;
  const base = Number(m[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = (m[2] || '').toUpperCase();
  const mul = suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1;
  return base * mul;
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function logScore(value: unknown): number {
  const n = Math.max(0, safeNumber(value));
  return Math.log10(n + 1);
}

function momentumScore(pct: unknown): number {
  const n = safeNumber(pct);
  return Math.tanh(n / 50);
}

type Weights = {
  volume: number;
  txns: number;
  liquidity: number;
  m5: number;
  h1: number;
  h6: number;
  h24: number;
  makers: number;
  boosts: number;
};

function scoreRow(row: DexRow, w: Weights): number {
  return (
    w.volume * logScore(row.volumeUsd) +
    w.txns * logScore(row.txns) +
    w.liquidity * logScore(row.liquidityUsd) +
    w.makers * logScore(row.makers) +
    w.boosts * logScore(row.boosts ?? 0) +
    w.m5 * momentumScore(row.change5m) +
    w.h1 * momentumScore(row.change1h) +
    w.h6 * momentumScore(row.change6h) +
    w.h24 * momentumScore(row.change24h)
  );
}

function rankIndicesDesc(values: number[]): number[] {
  return values
    .map((v, idx) => ({ v, idx }))
    .sort((a, b) => (b.v === a.v ? a.idx - b.idx : b.v - a.v))
    .map((x) => x.idx);
}

function spearmanRankCorr(targetRank: number[], predictedScore: number[]): number {
  const n = targetRank.length;
  if (n <= 1) return 0;

  // targetRank is 1..n, predictedScore -> predicted ranks by score desc
  const predOrder = rankIndicesDesc(predictedScore);
  const predRank = new Array<number>(n);
  for (let i = 0; i < predOrder.length; i++) predRank[predOrder[i]] = i + 1;

  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = targetRank[i] - predRank[i];
    sumD2 += d * d;
  }

  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

function inferChainHint(segmentLines: string[]): string {
  const all = segmentLines.join('\n').toLowerCase();
  if (all.includes('raydium') || all.includes('pumpswap') || all.includes('/\nsol')) return 'solana';
  // PancakeSwap exists on multiple chains; WBNB is a strong BSC hint.
  if (all.includes('wbnb') || all.includes('/\nwbnb')) return 'bsc';
  if (all.includes('aerodrome') || all.includes('base')) return 'base';
  return 'eth';
}

function parseSegment(segmentLines: string[]): DexRow[] {
  const chainHint = inferChainHint(segmentLines);

  const rows: DexRow[] = [];
  let i = 0;

  while (i < segmentLines.length) {
    const line = segmentLines[i];
    const rankMatch = line.match(/^#(\d+)$/);
    if (!rankMatch) {
      i++;
      continue;
    }

    const rank = Number(rankMatch[1]);
    i++;

    const record: string[] = [];
    while (i < segmentLines.length && !segmentLines[i].match(/^#\d+$/) && !segmentLines[i].startsWith('Showing pairs')) {
      record.push(segmentLines[i]);
      i++;
    }

    if (record.length < 10) continue;

    const dex = record[0] || '';

    // Parse from tail (more stable than relying on the left columns which vary by chain/DEX)
    const r = [...record];

    const fdvStr = r.pop()!;
    const liquidityStr = r.pop()!;
    const change24hStr = r.pop()!;
    const change6hStr = r.pop()!;
    const change1hStr = r.pop()!;
    const change5mStr = r.pop()!;
    const makersStr = r.pop()!;
    const volumeStr = r.pop()!;
    const txnsStr = r.pop()!;
    const ageStr = r.pop()!;

    // Some exports have an extra "boosts" number before price.
    let priceStr = r.pop()!;
    let boosts: number | null = null;
    if (!priceStr.startsWith('$') && (priceStr === '-' || /^[0-9,]+$/.test(priceStr))) {
      boosts = parseIntLoose(priceStr);
      priceStr = r.pop()!;
    }

    // Symbol usually appears early, but formats vary; best-effort.
    const symbol = r.find((x) => /^[A-Z0-9]{2,15}$/.test(x)) || undefined;

    rows.push({
      chainHint,
      rank,
      dex,
      symbol,
      boosts,
      priceUsd: parseUsd(priceStr) ?? undefined,
      age: ageStr,
      txns: parseIntLoose(txnsStr) ?? undefined,
      volumeUsd: parseUsd(volumeStr) ?? undefined,
      makers: parseIntLoose(makersStr) ?? undefined,
      change5m: parsePct(change5mStr),
      change1h: parsePct(change1hStr),
      change6h: parsePct(change6hStr),
      change24h: parsePct(change24hStr),
      liquidityUsd: parseUsd(liquidityStr) ?? undefined,
      fdvUsd: parseUsd(fdvStr) ?? undefined,
    });
  }

  return rows;
}

function sampleWeights(): Weights {
  const base = [Math.random(), Math.random(), Math.random()];
  const sum = base.reduce((a, b) => a + b, 0) || 1;
  const volume = base[0] / sum;
  const txns = base[1] / sum;
  const liquidity = base[2] / sum;

  const momentSum = Math.random() + Math.random() + Math.random() + Math.random();
  const m5 = (Math.random() / momentSum) * 0.25;
  const h1 = (Math.random() / momentSum) * 0.25;
  const h6 = (Math.random() / momentSum) * 0.25;
  const h24 = (Math.random() / momentSum) * 0.25;

  const makers = Math.random() * 0.25;
  const boosts = Math.random() * 0.15;

  // Re-normalize main components roughly
  const total = volume + txns + liquidity + makers + boosts + m5 + h1 + h6 + h24;
  return {
    volume: volume / total,
    txns: txns / total,
    liquidity: liquidity / total,
    makers: makers / total,
    boosts: boosts / total,
    m5: m5 / total,
    h1: h1 / total,
    h6: h6 / total,
    h24: h24 / total,
  };
}

async function run() {
  const file = process.argv[2] || 'test/backlog.md';
  const raw = fs.readFileSync(file, 'utf8');
  const lines = toLines(raw);

  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '#1') starts.push(i);
  }
  if (starts.length !== 4) {
    console.log(`[fit_dex_backlog] Expected 4 segments (4x #1), got ${starts.length}`);
  }

  const segments: string[][] = [];
  for (let s = 0; s < starts.length; s++) {
    const start = starts[s];
    const end = s + 1 < starts.length ? starts[s + 1] : lines.length;
    segments.push(lines.slice(start, end));
  }

  const datasets = segments.map(parseSegment).filter((rows) => rows.length > 0);
  const byChain = new Map<string, DexRow[]>();
  for (const rows of datasets) {
    const chain = rows[0].chainHint;
    const existing = byChain.get(chain);
    byChain.set(chain, existing ? [...existing, ...rows] : rows);
  }

  console.log('[fit_dex_backlog] Parsed datasets:', Array.from(byChain.entries()).map(([c, r]) => `${c}:${r.length}`).join(', '));

  let bestW: Weights | null = null;
  let bestScore = -Infinity;
  const ITER = Number(process.argv[3] || 8000);

  for (let it = 0; it < ITER; it++) {
    const w = sampleWeights();
    let total = 0;
    let chains = 0;

    for (const [, rows] of byChain.entries()) {
      const targetRank = rows.map((r) => r.rank);
      const predicted = rows.map((r) => scoreRow(r, w));
      total += spearmanRankCorr(targetRank, predicted);
      chains++;
    }

    const avg = chains ? total / chains : 0;
    if (avg > bestScore) {
      bestScore = avg;
      bestW = w;
    }
  }

  if (!bestW) {
    console.log('[fit_dex_backlog] No weights found');
    return;
  }

  console.log('\n[fit_dex_backlog] Best avg Spearman:', bestScore.toFixed(4));
  console.log('[fit_dex_backlog] Weights:', bestW);

  for (const [chain, rows] of byChain.entries()) {
    const targetRank = rows.map((r) => r.rank);
    const predicted = rows.map((r) => scoreRow(r, bestW!));
    const corr = spearmanRankCorr(targetRank, predicted);
    console.log(`[fit_dex_backlog] ${chain} Spearman: ${corr.toFixed(4)}`);
  }
}

run().catch((e) => {
  console.error('[fit_dex_backlog] Error:', e);
  process.exit(1);
});
