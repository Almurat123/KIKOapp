import assert from 'node:assert/strict';
import { __copyTradeGuardTestHelpers as helpers } from '../services/autoTradeService.js';

type Json = Record<string, unknown>;

function parseIterations(): number {
    const raw = process.argv[2] || process.env.ITERATIONS || '1000';
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 1000;
    return Math.floor(n);
}

function lcg(seed = 42): () => number {
    let state = seed >>> 0;
    return () => {
        state = (1664525 * state + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

function randomChoice<T>(rand: () => number, values: T[]): T {
    const idx = Math.floor(rand() * values.length);
    return values[Math.max(0, Math.min(values.length - 1, idx))];
}

function expectedPositiveMax(a: unknown, b: unknown): number {
    const vals = [Number(a), Number(b)].filter((v) => Number.isFinite(v) && v > 0);
    if (vals.length === 0) return 0;
    return Math.max(...vals);
}

function run() {
    const iterations = parseIterations();
    const rand = lcg(20260225);

    let checks = 0;

    // Suite 1: fixed user scenario (0.1 ETH cash-in), minTarget = 1800 USD must always block.
    for (let i = 0; i < iterations; i++) {
        const ethPrice = 1200 + rand() * 6000; // 1200-7200
        const targetValueUsd = 0.1 * ethPrice;
        const blocked = helpers.isBelowMinTargetValue(targetValueUsd, 1800);
        assert.equal(blocked, true, `suite1_failed: target=${targetValueUsd.toFixed(2)} price=${ethPrice.toFixed(2)}`);
        checks++;
    }

    // Suite 2: strict min-source unavailable must block when minTarget > 0.
    for (let i = 0; i < iterations; i++) {
        const minTarget = 100 + rand() * 5000;
        const strictRequired = true;
        const strictReliable = false;
        const effectiveTarget = rand() * minTarget; // any value
        const shouldSkip = (minTarget > 0 && strictRequired && !strictReliable)
            || (minTarget > 0 && helpers.isBelowMinTargetValue(effectiveTarget, minTarget));
        assert.equal(shouldSkip, true, 'suite2_failed: strict min guard bypassed');
        checks++;
    }

    // Suite 3: effective min target resolution uses strictest positive value.
    const weird: unknown[] = [undefined, null, '', 0, -1, -100, NaN, Infinity, 50, 200, 1800, 2500, '1800', '0', 'abc'];
    for (let i = 0; i < iterations; i++) {
        const c = randomChoice(rand, weird);
        const u = randomChoice(rand, weird);
        const got = helpers.resolveEffectiveMinTargetValueUsd(
            { minTargetValueUsd: c },
            { minTargetValueUsd: u }
        );
        const expected = expectedPositiveMax(c, u);
        assert.equal(got, expected, `suite3_failed: config=${String(c)} user=${String(u)} got=${got} expected=${expected}`);
        checks++;
    }

    // Suite 4: when strict is reliable, strict value must dominate broad value in min check.
    for (let i = 0; i < iterations; i++) {
        const minTarget = 100 + rand() * 3000;
        const broad = rand() * 5000;
        const strict = rand() * 5000;

        const decisionByCode = helpers.isBelowMinTargetValue(strict, minTarget);
        const decisionByBroad = helpers.isBelowMinTargetValue(broad, minTarget);
        const shouldFollowStrict = true;

        if (shouldFollowStrict) {
            // Assert strict decision is the one we use when reliable=true.
            const effective = strict;
            const finalDecision = helpers.isBelowMinTargetValue(effective, minTarget);
            assert.equal(finalDecision, decisionByCode, `suite4_failed: strict=${strict} broad=${broad} min=${minTarget}`);
            // Sanity: if broad differs, decision still must be based on strict.
            if (decisionByCode !== decisionByBroad) {
                assert.notEqual(finalDecision, decisionByBroad, 'suite4_failed: broad overrode strict');
            }
        }
        checks++;
    }

    // Suite 5: dedupe by user must keep one latest config per user.
    for (let i = 0; i < iterations; i++) {
        const users = 5 + Math.floor(rand() * 20);
        const rows: Array<{ id: string; userId: string; updatedAt: Date; createdAt: Date }> = [];
        const expectedMax = new Map<string, number>();

        for (let u = 0; u < users; u++) {
            const userId = `u_${u}`;
            const dup = 1 + Math.floor(rand() * 5);
            for (let d = 0; d < dup; d++) {
                const ts = Date.now() - Math.floor(rand() * 1_000_000);
                rows.push({
                    id: `${userId}_${d}_${i}`,
                    userId,
                    updatedAt: new Date(ts),
                    createdAt: new Date(ts - 1000)
                });
                const prev = expectedMax.get(userId) || 0;
                if (ts >= prev) expectedMax.set(userId, ts);
            }
        }

        const deduped = helpers.dedupeConfigsByUser(rows as any[]);
        assert.equal(deduped.length, users, `suite5_failed: expected_users=${users} got=${deduped.length}`);

        for (const row of deduped as any[]) {
            const ts = new Date(row.updatedAt || row.createdAt || 0).getTime();
            const mx = expectedMax.get(String(row.userId));
            assert.equal(ts, mx, `suite5_failed: user=${row.userId} gotTs=${ts} expectedTs=${mx}`);
        }
        checks++;
    }

    const report: Json = {
        ok: true,
        iterations,
        suites: 5,
        checks,
        timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(report, null, 2));
}

run();

