# Backend Swap Validation Owner Map

Updated: 2026-04-08

## Owned Layers

- `kiko-api/src/scripts/testTrendingDirectSwapSmoke.ts`

## Ownership Boundaries

### Smoke-test harness

Owns: bounded read-only trending fetches, simulation-only direct swap execution,
and summary reporting for operator validation.

Does not own: production routing decisions, execution policy, pool selection
rules, or broadcast semantics.

### Production swap path

Owns: route selection, quote construction, allowance handling, and execution.

Does not own: bespoke smoke-test orchestration or one-off validation sample sizes.

