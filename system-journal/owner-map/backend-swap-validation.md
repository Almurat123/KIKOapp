# Backend Swap Validation Owner Map

Updated: 2026-04-13

## Owned Layers

- `kiko-api/src/scripts/testTrendingDirectSwapSmoke.ts`
- `kiko-api/src/services/dex/directSwap/constants.ts`

## Ownership Boundaries

### Smoke-test harness

Owns: bounded read-only trending fetches, simulation-only direct swap execution,
and summary reporting for operator validation.

Does not own: production routing decisions, execution policy, pool selection
rules, or broadcast semantics.

### Production swap path

Owns: route selection, quote construction, allowance handling, and execution.

Does not own: bespoke smoke-test orchestration or one-off validation sample sizes.

### EVM native gas-reserve balance source

Owns: using fresh copytrade guard native-balance evidence, or a single direct
native-balance RPC read, before adjusting native input for gas reserve.

Does not own: wallet portfolio hydration, stablecoin balance discovery, or
multi-chain wallet display context.

Design rule: the swap hot path must not call broad wallet portfolio balance
hydration to answer a single native gas-reserve question.

### DirectSwap strategy boundary

Owns: product-enabled chain list, default strategy ordering per chain, and
official v4 read-only address maps used by DirectSwap quoting logic.

Does not own: Universal Router send enablement, hook provenance, or unknown-hook
runtime safety decisions.
