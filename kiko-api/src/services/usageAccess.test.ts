import test from 'node:test';
import assert from 'node:assert/strict';

import { isCurrentRequestFree, type UsageDecision } from './usageAccess.js';

function makeDecision(overrides: Partial<UsageDecision>): UsageDecision {
    return {
        allowed: true,
        dateUtc: '2026-03-24',
        totalUsed: 0,
        totalLimit: 0,
        tokenBalance: 0,
        usesTotalLimitOnly: false,
        normalUsed: 0,
        advancedUsed: 0,
        modelCategory: 'other',
        ...overrides,
    };
}

test('isCurrentRequestFree returns true while deepseek usage remains inside free quota window', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ modelCategory: 'deepseek', normalUsed: 0 })),
        true,
    );
});

test('isCurrentRequestFree returns false for other-category models', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ modelCategory: 'other', totalUsed: 4 })),
        false,
    );
});

test('isCurrentRequestFree returns false once grok usage already consumed the free quota', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ modelCategory: 'grok', advancedUsed: 999 })),
        false,
    );
});

test('isCurrentRequestFree treats holder users as free while total-tier access is allowed', () => {
    assert.equal(
        isCurrentRequestFree(makeDecision({ usesTotalLimitOnly: true, tokenBalance: 10_000_000, allowed: true, modelCategory: 'grok', advancedUsed: 999 })),
        true,
    );
});
