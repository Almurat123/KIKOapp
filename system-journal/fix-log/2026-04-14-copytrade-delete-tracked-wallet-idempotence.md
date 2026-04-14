# 2026-04-14 Copytrade Delete Tracked Wallet Idempotence

## Problem

Deleting a copy-trade config could succeed at the database row level while still
emitting a Prisma error for `TrackedWallet.update()`. That made successful
deletes look like failures in logs and confused operator/user diagnosis.

## Root Cause

- The delete path assumed a `TrackedWallet` summary row always existed for the
  config target.
- Historical repair work and malformed legacy configs meant some targets no
  longer had a matching `TrackedWallet` row.
- `update()` on a missing composite key throws, even though the config delete
  had already succeeded.

## Fix

- Replace delete-path `trackedWallet.update()` with `trackedWallet.updateMany()`.
- Only decrement when `activeConfigs > 0`.
- Treat `0` updated rows as an idempotent cleanup condition and log it as info,
  not as an error/warn.

## Document Provenance

- Source: production log `logs.1776141824963.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - copy-trade delete cleanup semantics
  - tracked-wallet summary decrement idempotence
- Verification: verified in runtime logs and local typecheck

## Guardrails

- Config delete success must be determined by the config row deletion, not by an
  optional summary-row decrement.
- Summary cleanup should be idempotent.
- Missing `TrackedWallet` rows during delete are a repair-state artifact, not a
  user-facing delete failure.
