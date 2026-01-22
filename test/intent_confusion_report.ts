import fs from 'fs';
import path from 'path';
import { parseIntent } from '../kiko-api/src/services/ai/intentParser.ts';

type Sample = {
  id: string;
  text: string;
  expected_high_level: string;
  expected_action: string;
  meta?: Record<string, unknown>;
};

type Confusion = Record<string, Record<string, number>>;

const ROOT = path.resolve(__dirname);
const DATASETS = [
  'intent_dataset_set1.json',
  'intent_dataset_set2.json',
  'intent_dataset_set3.json',
  'intent_dataset_set4.json',
  'intent_dataset_set5.json',
].map((name) => path.join(ROOT, name));

const labels = [
  'TRADING',
  'MARKET_ANALYSIS',
  'RISK_SCAN',
  'SOCIAL_SENSING',
  'COPY_TRADING',
  'PREDICTION_MARKETS',
  'GENERAL_CHAT',
];

function initConfusion(): Confusion {
  const matrix: Confusion = {};
  for (const exp of labels) {
    matrix[exp] = {};
    for (const pred of labels) {
      matrix[exp][pred] = 0;
    }
  }
  return matrix;
}

function calcMetrics(matrix: Confusion) {
  const totals = {
    correct: 0,
    total: 0,
  };
  const perLabel: Record<string, { tp: number; fp: number; fn: number; precision: number; recall: number }> = {};

  for (const label of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const exp of labels) {
      for (const pred of labels) {
        const value = matrix[exp][pred];
        if (exp === label && pred === label) tp += value;
        if (exp !== label && pred === label) fp += value;
        if (exp === label && pred !== label) fn += value;
      }
    }
    const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
    const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
    perLabel[label] = { tp, fp, fn, precision, recall };
    totals.correct += tp;
  }

  for (const exp of labels) {
    for (const pred of labels) {
      totals.total += matrix[exp][pred];
    }
  }

  return {
    accuracy: totals.total === 0 ? 0 : totals.correct / totals.total,
    perLabel,
    total: totals.total,
    correct: totals.correct,
  };
}

async function run() {
  const matrix = initConfusion();
  const errors: Array<{ id: string; input: string; expected: string; got: string }> = [];

  for (const file of DATASETS) {
    const raw = fs.readFileSync(file, 'utf-8');
    const samples = JSON.parse(raw) as Sample[];

    for (const sample of samples) {
      const parsed = await parseIntent(sample.text, {});
      const expected = sample.expected_high_level;
      const got = parsed.highLevel.type;
      if (!matrix[expected]) {
        matrix[expected] = {};
      }
      if (!matrix[expected][got]) {
        matrix[expected][got] = 0;
      }
      matrix[expected][got] += 1;

      if (expected !== got) {
        errors.push({
          id: sample.id,
          input: sample.text,
          expected,
          got,
        });
      }
    }
  }

  const metrics = calcMetrics(matrix);
  const report = {
    summary: {
      total: metrics.total,
      correct: metrics.correct,
      accuracy: Number(metrics.accuracy.toFixed(4)),
    },
    perLabel: Object.fromEntries(
      Object.entries(metrics.perLabel).map(([label, stats]) => [
        label,
        {
          precision: Number(stats.precision.toFixed(4)),
          recall: Number(stats.recall.toFixed(4)),
          tp: stats.tp,
          fp: stats.fp,
          fn: stats.fn,
        },
      ])
    ),
    confusion: matrix,
    topErrors: errors.slice(0, 50),
  };

  const outJson = path.join(ROOT, 'intent_confusion_report.json');
  fs.writeFileSync(outJson, JSON.stringify(report, null, 2));

  const outMd = path.join(ROOT, 'intent_confusion_report.md');
  const lines: string[] = [];
  lines.push(`# Intent Confusion Report`);
  lines.push('');
  lines.push(`- Total: ${metrics.total}`);
  lines.push(`- Correct: ${metrics.correct}`);
  lines.push(`- Accuracy: ${report.summary.accuracy}`);
  lines.push('');
  lines.push(`## Per-Label Metrics`);
  lines.push('');
  for (const label of labels) {
    const stats = report.perLabel[label];
    lines.push(`- ${label}: precision=${stats.precision}, recall=${stats.recall}, tp=${stats.tp}, fp=${stats.fp}, fn=${stats.fn}`);
  }
  lines.push('');
  lines.push(`## Confusion Matrix`);
  lines.push('');
  lines.push(`| expected \\/ predicted | ${labels.join(' | ')} |`);
  lines.push(`| ${labels.map(() => '---').join(' | ')} |`);
  for (const exp of labels) {
    const row = labels.map((pred) => matrix[exp][pred] || 0);
    lines.push(`| ${exp} | ${row.join(' | ')} |`);
  }
  lines.push('');
  lines.push(`## Sample Errors (first 50)`);
  lines.push('');
  for (const err of report.topErrors) {
    lines.push(`- ${err.id}: expected=${err.expected}, got=${err.got} :: ${err.input}`);
  }

  fs.writeFileSync(outMd, lines.join('\n'));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
