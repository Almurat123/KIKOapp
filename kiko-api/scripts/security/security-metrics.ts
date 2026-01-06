/**
 * Aggregate security outputs into JSON/MD reports for AI consumption.
 * Inputs (optional):
 *  - /tmp/kiko-security/runtime-alerts.jsonl
 *  - /tmp/kiko-security/fund-flows.json
 *  - /tmp/kiko-security/fingerprints.jsonl
 * Outputs:
 *  - reports/security-metrics.json
 *  - reports/security-summary.md
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { OUTPUT_ALERTS, OUTPUT_FINGERPRINTS, OUTPUT_FLOWS, OUTPUT_METRICS, OUTPUT_SUMMARY } from './config/rules.js';

interface Alert {
  ts: number;
  chain: string;
  type: string;
  severity: string;
}

interface Fingerprint {
  selectorsHit: Record<string, boolean>;
}

interface Flow {
  risk: string;
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as T[];
}

function readJson(path: string): any {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const alerts = readJsonl<Alert>(OUTPUT_ALERTS);
  const flowsData = readJson(OUTPUT_FLOWS);
  const fps = readJsonl<Fingerprint>(OUTPUT_FINGERPRINTS);

  const timestamp = new Date().toISOString();

  const metrics = {
    generatedAt: timestamp,
    counts: {
      alerts: alerts.length,
      flows: flowsData?.flows?.length || 0,
      fingerprints: fps.length,
    },
    alertsBySeverity: alerts.reduce<Record<string, number>>((m, a) => {
      const sev = a.severity || 'unknown';
      m[sev] = (m[sev] || 0) + 1;
      return m;
    }, {}),
    flowsHighRisk: (flowsData?.flows || []).filter((f: Flow) => f.risk === 'high' || f.risk === 'critical').length,
    selectorsHit: fps.reduce<Record<string, number>>((m, f) => {
      Object.entries(f.selectorsHit || {}).forEach(([k, v]) => {
        if (v) m[k] = (m[k] || 0) + 1;
      });
      return m;
    }, {}),
  };

  const summaryMd = [
    `# Security Summary (${timestamp})`,
    `- Alerts: ${metrics.counts.alerts} (severity: ${JSON.stringify(metrics.alertsBySeverity)})`,
    `- Flows: ${metrics.counts.flows} (high/crit: ${metrics.flowsHighRisk})`,
    `- Fingerprints: ${metrics.counts.fingerprints}`,
    `- Risky selectors hit: ${JSON.stringify(metrics.selectorsHit)}`,
  ].join('\n');

  const summaryDir = OUTPUT_SUMMARY.includes('/') ? OUTPUT_SUMMARY.split('/').slice(0, -1).join('/') : '.';
  if (summaryDir && summaryDir !== '.' && !existsSync(summaryDir)) mkdirSync(summaryDir, { recursive: true });
  const metricsDir = OUTPUT_METRICS.includes('/') ? OUTPUT_METRICS.split('/').slice(0, -1).join('/') : '.';
  if (metricsDir && metricsDir !== '.' && !existsSync(metricsDir)) mkdirSync(metricsDir, { recursive: true });

  writeFileSync(OUTPUT_METRICS, JSON.stringify(metrics, null, 2), 'utf8');
  writeFileSync(OUTPUT_SUMMARY, summaryMd, 'utf8');
}

main();

