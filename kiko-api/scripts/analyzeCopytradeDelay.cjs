#!/usr/bin/env node
const fs = require('fs');

const file = process.argv[2] || '/Users/almurat/KiKo/test/backend.txt';
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);

function tsMs(line) {
  const m = line.match(/^(\d{4}-\d{2}-\d{2}T[^ ]+) \[/);
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isFinite(t) ? t : null;
}

const events = [];
for (const line of lines) {
  const t = tsMs(line);
  if (t == null) continue;
  if (line.includes('Target is buying - triggering copy trade')) {
    events.push({ t, type: 'buy_trigger', line });
  } else if (line.includes('Skipping trade: copytrade delay exceeded')) {
    events.push({ t, type: 'skip_delay', line });
  } else if (line.includes('Skipping trade: target value below user minimum')) {
    events.push({ t, type: 'skip_min_value', line });
  } else if (line.includes('Copy trade completed and position created')) {
    events.push({ t, type: 'buy_success', line });
  } else if (line.includes('Pending predecode hit for all tracked wallets')) {
    events.push({ t, type: 'pending_hit', line });
  }
}

const out = [];
for (let i = 0; i < events.length; i++) {
  if (events[i].type !== 'buy_trigger') continue;
  const start = events[i];
  const window = events.slice(i + 1).filter(e => e.t - start.t <= 5000);
  const end = window.find(e => e.type === 'skip_delay' || e.type === 'skip_min_value' || e.type === 'buy_success');
  if (!end) continue;
  const hadPending = window.some(e => e.type === 'pending_hit');
  out.push({
    start: new Date(start.t).toISOString(),
    end: new Date(end.t).toISOString(),
    elapsedMs: end.t - start.t,
    result: end.type,
    pendingHintLikely: hadPending,
  });
}

console.log(JSON.stringify({ total: out.length, samples: out.slice(-20) }, null, 2));
