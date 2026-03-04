import assert from 'node:assert/strict';
import test from 'node:test';
import { reproduceAllCtIssues, reproduceCtIssue } from '../governance/ct136Reproduction.js';

test('ct136 reproduction: every issue can be replayed with cross-flow linkage', async () => {
  const results = await reproduceAllCtIssues();

  assert.equal(results.length, 136);

  const failed = results.filter((row) => !row.matched);
  assert.equal(
    failed.length,
    0,
    `unmatched issues: ${failed.map((row) => `${row.issueId}:${row.strategy}:${row.detail}`).join(', ')}`,
  );
});

test('ct136 reproduction: single issue replay returns deterministic issue linkage', async () => {
  const result = await reproduceCtIssue('CT-083', 999);

  assert.equal(result.matched, true);
  assert.equal(result.issueId, 'CT-083');
  assert.ok(result.ctIssueIds.includes('CT-083'));
});
