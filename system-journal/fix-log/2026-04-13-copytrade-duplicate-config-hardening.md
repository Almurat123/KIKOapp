# 2026-04-13 Copytrade Duplicate Config Hardening

## Problem

The same user could create multiple active copy-trade configs for the same
`targetWallet` on the same `chainId`. This made webhook tracking ambiguous and
multiplied `TrackedWallet.activeConfigs` for a single logical subscription.

Production inspection found duplicate active BSC configs for one user and one
target wallet after malformed wallet entities created repeated rows.

## Root Cause

Neither the chat tool path nor the signed HTTP create path checked for an
existing active config by `userId + chainId + targetWallet` before creating a
new row.

The signed update path also allowed one active config to be moved onto another
active config's tuple.

## Fix

- `create_copy_trade_config` now returns the existing active config when the
  same user, chain, and target wallet already exists.
- Signed HTTP create returns the existing active config instead of creating a
  duplicate row.
- Signed HTTP update rejects moves onto another active config with
  `DUPLICATE_COPY_TRADE_CONFIG`.
- Postgres now has a partial unique index on active configs by
  `userId + chainId + lower(targetWallet)`, so concurrent duplicate creates fail
  at the database boundary as well as the runtime boundary.
- Tool and signed HTTP create paths convert database unique races into an
  existing-config response without incrementing tracked-wallet counts.

## Verification

- Verified production duplicate rows with Prisma.
- Added a tool-level regression test proving duplicate create returns the
  existing config and does not create another row or increment tracked-wallet
  counts.
- Added a tool-level race regression test for `P2002` unique conflicts.
- Added migration `20260413162000_copytrade_active_target_unique` for the
  database-level invariant.
- Verified TypeScript and targeted unit tests.

## Guardrail

Active copy-trade config identity is `userId + chainId + normalized targetWallet`.
New code must not create a second active row for that tuple, and the database
must reject concurrent active duplicates even if runtime guards race.
