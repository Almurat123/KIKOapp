# 2026-04-14 Copytrade Quarantine Visible Delete

## Problem

Malformed legacy copy-trade configs could be quarantined out of the `/configs`
response entirely. That removed the user's only path to generate a signed
delete intent, leaving broken rows stuck in the database with no visible UI
cleanup affordance.

## Root Cause

- Backend list sanitization treated `invalid_target_wallet` rows as
  `hideFromList=true`.
- Frontend delete flow requires the config card to exist because delete signing
  is derived from the visible `copyTradeConfig` payload.
- Once the row was hidden, users could no longer sign a delete for the broken
  config.

## Fix

- Keep quarantined malformed configs visible in `/api/copy-trade/configs`.
- Force quarantined rows to `paused` + `requiresResign=true`.
- Return a `quarantineReason` so the frontend can render them as cleanup-only
  cards.
- Frontend disables edit/resume for quarantined copy-trade cards but keeps the
  delete action available.

## Document Provenance

- Source: user-reported runtime behavior in the current production incident
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - copy-trade config list sanitization
  - strategy card action gating
- Verification: verified in code review and local typecheck

## Guardrails

- Quarantine must never remove a user's only cleanup path.
- Invalid legacy configs may stay visible, but they must not become actionable
  for resume/edit flows.
- Delete remains the only allowed recovery action for quarantined configs.
