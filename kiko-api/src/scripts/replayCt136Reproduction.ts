import { reproduceAllCtIssues } from '../services/copytrade-v2/governance/ct136Reproduction.js';

async function main() {
  const startedAt = Date.now();
  const results = await reproduceAllCtIssues();
  const failed = results.filter((row) => !row.matched);

  const byFlow = results.reduce<Record<string, number>>((acc, row) => {
    acc[row.flow] = (acc[row.flow] || 0) + 1;
    return acc;
  }, {});

  console.log('[CT136-Replay] summary', {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    byFlow,
    durationMs: Date.now() - startedAt,
  });

  if (failed.length > 0) {
    console.error('[CT136-Replay] failed-cases', failed.map((row) => ({
      issueId: row.issueId,
      flow: row.flow,
      strategy: row.strategy,
      detail: row.detail,
      observedReasonCode: row.observedReasonCode,
      observedLifecycleState: row.observedLifecycleState,
      ctIssueIds: row.ctIssueIds,
    })));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[CT136-Replay] fatal', error);
  process.exitCode = 1;
});
