# 2026-04-14 Copytrade Strategy List Read/Write Decoupling

## Problem

The copy-trade strategy page was still loading one extra
`GET /api/copy-trade/config/:id/target-status` request per card after the main
`GET /api/copy-trade/configs` response. Under a large strategy set this created
an avoidable N+1 burst. Production logs then showed the same default limiter
bucket blocking both:

- card hydration reads
- user `DELETE /api/copy-trade/config/:id` requests

At the same time, malformed legacy configs with truncated EVM addresses were
still being returned by the config list and rendered as duplicate user-facing
cards.

## Root Cause

Two owner violations were stacked together:

1. Frontend strategy cards were treating `target-status` as required render-time
   data even though the backend already persists target summary fields directly
   on `CopyTradeConfig`.
2. Backend config listing returned malformed legacy rows unchanged, so the
   strategy page displayed duplicate cards for logically broken configs.

## Fix

- `StrategyCard` now renders copy-trade metrics from persisted config summary
  fields:
  - `targetTrackedTxCount`
  - `targetWalletTxCount`
  - `targetProfitUsd`
  - `targetLossUsd`
- `copyTradeApi.ts` exposes those summary fields in the frontend type.
- Global rate limiting now splits copy-trade traffic into:
  - `copytrade_read`
  - `copytrade_write`
  so read bursts no longer block delete/update actions.
- `GET /api/copy-trade/configs` now quarantines malformed list rows before
  returning them:
  - invalid `targetWallet`
  - signed payload target mismatch
  - missing signed payload target wallet
- Quarantined rows are marked `paused` and `requiresResign=true`.
- Rows with invalid persisted wallet addresses are excluded from the user-facing
  list response.
- Rows with signed payload mismatch remain visible as paused so the user can
  still understand and repair/delete the config.

## Document Provenance

- Source: production log `logs.1776097448703.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - copy-trade limiter bucket split
  - removal of per-card target-status hydration
  - list-time quarantine of malformed configs
- Verification: verified in runtime and code review

## Guardrails

- Copy-trade list entry must be renderable from `/configs` alone.
- User mutations must not share the same limiter bucket as strategy list burst
  reads.
- Malformed legacy configs may remain in storage for audit, but they must not
  remain user-visible as actionable cards.
