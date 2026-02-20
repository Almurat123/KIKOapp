/**
 * Point-to-point tests for "Skipping trade: copytrade delay exceeded".
 *
 * Scenario (from backend.txt):
 * - Webhook receives Alchemy payload → decode swap → enqueue with detectedAt
 * - If detectedAt is old (e.g. from pendingHint when pending watcher saw tx earlier),
 *   then by the time we run the buy check, Date.now() - detectedAt > 2500ms (turbo)
 *   and we skip. Fix: when we decode from receipt in webhook (no cached predecoded),
 *   use Date.now() as detectedAt so the clock starts at enqueue, not at old pendingHint.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { isCopyTradeDelayExceeded } from './autoTradeService.js';

const TURBO_MAX_MS = 2500;
const NORMAL_MAX_MS = 5000;

test('turbo: old detectedAt (3s ago) → skip', () => {
    const now = 10000;
    const detectedAt = now - 3000; // 3 seconds ago
    const { skip, delayMs, maxDelayMs } = isCopyTradeDelayExceeded(detectedAt, true, now);
    assert.equal(skip, true, 'should skip when delay > 2.5s in turbo');
    assert.equal(delayMs, 3000);
    assert.equal(maxDelayMs, TURBO_MAX_MS);
});

test('turbo: fresh detectedAt (0.5s ago) → do not skip', () => {
    const now = 10000;
    const detectedAt = now - 500;
    const { skip, delayMs, maxDelayMs } = isCopyTradeDelayExceeded(detectedAt, true, now);
    assert.equal(skip, false);
    assert.equal(delayMs, 500);
    assert.equal(maxDelayMs, TURBO_MAX_MS);
});

test('turbo: exactly at limit (2500ms) → do not skip', () => {
    const now = 10000;
    const detectedAt = now - TURBO_MAX_MS;
    const { skip } = isCopyTradeDelayExceeded(detectedAt, true, now);
    assert.equal(skip, false);
});

test('turbo: 1ms over limit → skip', () => {
    const now = 10000;
    const detectedAt = now - TURBO_MAX_MS - 1;
    const { skip } = isCopyTradeDelayExceeded(detectedAt, true, now);
    assert.equal(skip, true);
});

test('normal mode: 3s ago → do not skip (5s limit)', () => {
    const now = 10000;
    const detectedAt = now - 3000;
    const { skip, maxDelayMs } = isCopyTradeDelayExceeded(detectedAt, false, now);
    assert.equal(skip, false);
    assert.equal(maxDelayMs, NORMAL_MAX_MS);
});

test('normal mode: 6s ago → skip', () => {
    const now = 10000;
    const detectedAt = now - 6000;
    const { skip } = isCopyTradeDelayExceeded(detectedAt, false, now);
    assert.equal(skip, true);
});

test('undefined detectedAt → never skip', () => {
    const now = 10000;
    const { skip, delayMs } = isCopyTradeDelayExceeded(undefined, true, now);
    assert.equal(skip, false);
    assert.equal(delayMs, 0);
});

test('scenario: webhook decoded from receipt with no cache — use Date.now() at enqueue', () => {
    // Simulate: enqueue at T=0 with detectedAt=0 (Date.now() at enqueue).
    // Check runs at T=1s → delay 1000ms < 2500 → do not skip.
    const enqueueTime = 1000;
    const checkTime = enqueueTime + 1000; // 1s later
    const detectedAt = enqueueTime; // webhook fix: use "now" when no cached
    const { skip, delayMs } = isCopyTradeDelayExceeded(detectedAt, true, checkTime);
    assert.equal(skip, false, 'with fresh detectedAt at enqueue, 1s later we should not skip');
    assert.equal(delayMs, 1000);
});

test('scenario: old pendingHint used as detectedAt (bug) → skip', () => {
    // Simulate: pending watcher saw tx at T=1000, set pendingHint.detectedAt=1000.
    // Webhook decoded at T=3500ms, enqueue with resolveDetectedAt(undefined, 1000) → 1000 (still < 4s stale).
    // Check runs at T=4000ms → delay 3000ms > 2500 → skip.
    const pendingSawAt = 1000;
    const checkTime = 4000;
    const detectedAt = pendingSawAt; // bug: we used old pendingHint
    const { skip, delayMs } = isCopyTradeDelayExceeded(detectedAt, true, checkTime);
    assert.equal(skip, true, 'with old pendingHint as detectedAt we exceed turbo limit and skip');
    assert.equal(delayMs, 3000);
});
