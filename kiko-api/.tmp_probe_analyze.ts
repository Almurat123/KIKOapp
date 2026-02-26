import fs from 'node:fs/promises';
import path from 'node:path';

type Row = {
  wallet: string;
  txHash: string;
  status: string;
  selector?: string;
  router?: string;
  commandType?: string;
  replayPath?: boolean;
  simSuccess?: boolean;
  simCode?: string;
  simReason?: string;
  driftClassification?: string;
  driftReasonCode?: string;
  hintStatus?: string;
  hintKind?: string;
  decodeMs?: number;
  hintResolveMs?: number;
  simMs?: number;
  templateHit?: boolean;
  adapterName?: string | null;
};

type ProbeWallet = {
  wallet: string;
  rows: Row[];
};

type ProbeFile = {
  generatedAt: string;
  wallets: ProbeWallet[];
  learningCoverage?: any;
};

function countBy<T extends string>(items: T[]): Array<[T, number]> {
  const map = new Map<T, number>();
  for (const item of items) map.set(item, (map.get(item) || 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Number((n / d).toFixed(4));
}

function flattenRows(file: ProbeFile): Row[] {
  return file.wallets.flatMap((w) => w.rows || []);
}

async function main() {
  const latestPath = process.argv[2];
  const prevPath = process.argv[3];
  if (!latestPath) throw new Error('latestPath is required');

  const latest = JSON.parse(await fs.readFile(latestPath, 'utf8')) as ProbeFile;
  const rows = flattenRows(latest);
  const decoded = rows.filter((r) => r.status === 'ok');
  const replay = decoded.filter((r) => r.replayPath === true);
  const failed = decoded.filter((r) => r.simSuccess === false);
  const bootstrap = decoded.filter((r) => r.commandType === 'bootstrap');

  const supportedSelectors = new Set([
    '0x3593564c',
    '0x24856bc3',
    '0xcae6a6b3',
    '0x0f27c5c1',
    '0xd1ee211d',
    '0x2213bc0b',
    '0x784e2685'
  ]);

  const unsupportedBootstrap = bootstrap.filter((r) => !supportedSelectors.has(String(r.selector || '').toLowerCase()));
  const supportedButNoReplay = decoded.filter(
    (r) => supportedSelectors.has(String(r.selector || '').toLowerCase()) && r.replayPath !== true
  );

  const investigation = {
    source: latestPath,
    generatedAt: new Date().toISOString(),
    totals: {
      rows: rows.length,
      decoded: decoded.length,
      replay: replay.length,
      failed: failed.length,
      bootstrap: bootstrap.length
    },
    failureStudy: {
      failRate: pct(failed.length, decoded.length),
      topSimCodes: countBy(failed.map((r) => String(r.simCode || 'unknown'))),
      topDrift: countBy(failed.map((r) => String(r.driftClassification || 'unknown'))),
      topSelectors: countBy(failed.map((r) => String(r.selector || ''))),
      topRouters: countBy(failed.map((r) => String(r.router || ''))),
      cases: failed
        .map((r) => ({
          wallet: r.wallet,
          txHash: r.txHash,
          selector: r.selector,
          router: r.router,
          commandType: r.commandType,
          adapter: r.adapterName || null,
          hintKind: r.hintKind,
          simCode: r.simCode,
          simReason: r.simReason,
          drift: r.driftClassification,
          driftReason: r.driftReasonCode,
          decodeMs: r.decodeMs,
          hintResolveMs: r.hintResolveMs,
          simMs: r.simMs
        }))
        .sort((a, b) => (Number(b.hintResolveMs || 0) + Number(b.simMs || 0) + Number(b.decodeMs || 0)) - (Number(a.hintResolveMs || 0) + Number(a.simMs || 0) + Number(a.decodeMs || 0)))
        .slice(0, 120)
    },
    noLearningStudy: {
      replayRate: pct(replay.length, decoded.length),
      bootstrapRate: pct(bootstrap.length, decoded.length),
      unsupportedSelectorInBootstrap: unsupportedBootstrap.length,
      unsupportedSelectorInBootstrapRate: pct(unsupportedBootstrap.length, bootstrap.length),
      supportedButNoReplay: supportedButNoReplay.length,
      supportedButNoReplayRate: pct(supportedButNoReplay.length, decoded.length),
      noHintCount: decoded.filter((r) => r.hintStatus !== 'resolved').length,
      noHintRate: pct(decoded.filter((r) => r.hintStatus !== 'resolved').length, decoded.length),
      bootstrapTopSelectors: countBy(bootstrap.map((r) => String(r.selector || ''))),
      unsupportedTopSelectors: countBy(unsupportedBootstrap.map((r) => String(r.selector || ''))),
      supportedButNoReplayTopSelectors: countBy(supportedButNoReplay.map((r) => String(r.selector || ''))),
      supportedButNoReplayCases: supportedButNoReplay.slice(0, 120),
      dbCoverage: latest.learningCoverage || null
    },
    latencyStudy: {
      slowHintCount: decoded.filter((r) => Number(r.hintResolveMs || 0) >= 5000).length,
      slowSimCount: decoded.filter((r) => Number(r.simMs || 0) >= 5000).length,
      slowDecodeCount: decoded.filter((r) => Number(r.decodeMs || 0) >= 1000).length,
      topHint: [...decoded]
        .sort((a, b) => Number(b.hintResolveMs || 0) - Number(a.hintResolveMs || 0))
        .slice(0, 25),
      topSim: [...decoded]
        .sort((a, b) => Number(b.simMs || 0) - Number(a.simMs || 0))
        .slice(0, 25),
      topDecode: [...decoded]
        .sort((a, b) => Number(b.decodeMs || 0) - Number(a.decodeMs || 0))
        .slice(0, 25)
    }
  };

  const summary = {
    source: latestPath,
    generatedAt: new Date().toISOString(),
    chainId: 8453,
    wallets: latest.wallets.map((w) => w.wallet),
    perWalletLimit: latest.wallets[0]?.rows?.length || 0,
    totals: {
      rows: rows.length,
      decoded: decoded.length,
      decodedRate: pct(decoded.length, rows.length),
      hintResolved: decoded.filter((r) => r.hintStatus === 'resolved').length,
      replayPath: replay.length,
      simSuccess: decoded.filter((r) => r.simSuccess === true).length
    },
    topErrorBuckets: countBy(decoded.map((r) => (r.simSuccess ? 'ok' : `sim_fail:${String(r.simCode || 'unknown')}`))).slice(0, 20),
    topCommandTypes: countBy(decoded.map((r) => String(r.commandType || 'none'))),
    topHintKinds: countBy(decoded.map((r) => String(r.hintKind || 'none'))),
    topDrift: countBy(decoded.map((r) => String(r.driftClassification || 'none'))),
    learningCoverage: latest.learningCoverage || null
  };

  const dir = path.dirname(latestPath);
  const base = path.basename(latestPath, '.json');
  await fs.writeFile(path.join(dir, `${base}_summary.json`), JSON.stringify(summary, null, 2));
  await fs.writeFile(path.join(dir, `${base}_investigation.json`), JSON.stringify(investigation, null, 2));

  if (prevPath) {
    const prev = JSON.parse(await fs.readFile(prevPath, 'utf8')) as ProbeFile;
    const prevRows = flattenRows(prev);
    const prevDecoded = prevRows.filter((r) => r.status === 'ok');
    const prevReplay = prevDecoded.filter((r) => r.replayPath === true);
    const prevFailed = prevDecoded.filter((r) => r.simSuccess === false);
    const prevSlowHint = prevDecoded.filter((r) => Number(r.hintResolveMs || 0) >= 5000).length;
    const prevSlowSim = prevDecoded.filter((r) => Number(r.simMs || 0) >= 5000).length;

    const compare = {
      latest: {
        file: latestPath,
        decoded: decoded.length,
        replay: replay.length,
        failed: failed.length,
        replayRate: pct(replay.length, decoded.length),
        failRate: pct(failed.length, decoded.length),
        slowHintCount: investigation.latencyStudy.slowHintCount,
        slowSimCount: investigation.latencyStudy.slowSimCount,
        learningCoverage: latest.learningCoverage || null
      },
      previous: {
        file: prevPath,
        decoded: prevDecoded.length,
        replay: prevReplay.length,
        failed: prevFailed.length,
        replayRate: pct(prevReplay.length, prevDecoded.length),
        failRate: pct(prevFailed.length, prevDecoded.length),
        slowHintCount: prevSlowHint,
        slowSimCount: prevSlowSim,
        learningCoverage: prev.learningCoverage || null
      },
      delta: {
        replay: replay.length - prevReplay.length,
        failed: failed.length - prevFailed.length,
        replayRate: Number((pct(replay.length, decoded.length) - pct(prevReplay.length, prevDecoded.length)).toFixed(4)),
        failRate: Number((pct(failed.length, decoded.length) - pct(prevFailed.length, prevDecoded.length)).toFixed(4)),
        slowHintCount: investigation.latencyStudy.slowHintCount - prevSlowHint,
        slowSimCount: investigation.latencyStudy.slowSimCount - prevSlowSim
      }
    };
    await fs.writeFile(path.join(dir, `${base}_compare_prev.json`), JSON.stringify(compare, null, 2));
  }

  console.log(JSON.stringify({
    latestPath,
    summaryPath: path.join(dir, `${base}_summary.json`),
    investigationPath: path.join(dir, `${base}_investigation.json`),
    comparePath: prevPath ? path.join(dir, `${base}_compare_prev.json`) : null
  }, null, 2));
}

await main();
