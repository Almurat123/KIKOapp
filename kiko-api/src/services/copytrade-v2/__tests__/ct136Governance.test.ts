import assert from 'node:assert/strict';
import test from 'node:test';
import { CT_ISSUES } from '../governance/ct136Catalog.js';
import { ALL_COPYTRADE_REASON_CODES } from '../governance/ct136Types.js';
import { CT_CATALOG_INTEGRITY, resolveCtIssueTrace } from '../governance/ct136Linker.js';

test('ct136: catalog has full contiguous 136 issue coverage', () => {
  assert.equal(CT_ISSUES.length, 136);

  const ids = CT_ISSUES.map((issue) => issue.id);
  const unique = new Set(ids);
  assert.equal(unique.size, 136);

  for (let i = 1; i <= 136; i += 1) {
    const id = `CT-${String(i).padStart(3, '0')}` as `CT-${string}`;
    assert.equal(unique.has(id), true, `missing ${id}`);
  }
});

test('ct136: every issue has reproduction + linkage metadata', () => {
  for (const issue of CT_ISSUES) {
    assert.ok(issue.title.length > 0, `${issue.id} missing title`);
    assert.ok(issue.fault.length > 0, `${issue.id} missing fault`);
    assert.ok(issue.invariant.length > 0, `${issue.id} missing invariant`);
    assert.ok(issue.reproduction.trigger.length > 0, `${issue.id} missing trigger`);
    assert.ok(issue.reproduction.expected.length > 0, `${issue.id} missing expected`);
    assert.ok(issue.reproduction.probe.length > 0, `${issue.id} missing probe`);
    assert.ok(issue.reasonCodes.length > 0, `${issue.id} missing reason codes`);
    assert.ok(issue.lifecycleStates.length > 0, `${issue.id} missing lifecycle states`);
    assert.ok(issue.relatedIds.length > 0, `${issue.id} missing related links`);
  }
});

test('ct136: integrity check has no holes', () => {
  assert.equal(CT_CATALOG_INTEGRITY.total, 136);
  assert.equal(CT_CATALOG_INTEGRITY.uniqueIds, 136);
  assert.equal(CT_CATALOG_INTEGRITY.missingIds.length, 0);
  assert.equal(CT_CATALOG_INTEGRITY.missingReasonCodes.length, 0);
  assert.equal(CT_CATALOG_INTEGRITY.disconnectedIds.length, 0);
  assert.equal(CT_CATALOG_INTEGRITY.danglingRelatedIds.length, 0);
});

test('ct136: every reason code resolves to linked issues', () => {
  for (const reasonCode of ALL_COPYTRADE_REASON_CODES) {
    const trace = resolveCtIssueTrace({
      reasonCode,
      preferredFlow: 'order-flow',
      lifecycleState: 'VALIDATED',
    });
    assert.ok(trace.primaryIds.length > 0, `reason ${reasonCode} has no CT mapping`);
    assert.ok(trace.flows.length > 0, `reason ${reasonCode} has no flow mapping`);
  }
});

test('ct136: flow preference selects trading issues first for trading failures', () => {
  const trace = resolveCtIssueTrace({
    reasonCode: 'trading_execution_failed',
    preferredFlow: 'trading-flow',
    lifecycleState: 'BUY_SUBMITTING',
  });

  assert.ok(trace.primaryIds.length > 0);
  assert.equal(trace.flows.includes('trading-flow'), true);
});
