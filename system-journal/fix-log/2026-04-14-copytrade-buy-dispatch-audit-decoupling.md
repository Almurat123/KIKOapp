# 2026-04-14 Copytrade Buy Dispatch Audit Decoupling

## Problem

The copytrade buy runtime treated the `buy_dispatch_gate` owner as part of the
synchronous buy entry path. Even though the stage was only computing stale
signal freshness and emitting timing audit, it sat inline with the trade flow
and made the audit look like a blocking transaction gate.

## Root Cause

- `legacyCopytradeBuyRuntime` mixed two responsibilities in the same inline
  block:
  - computing the stale-signal veto used to skip outdated buys
  - emitting `user buy dispatch delay` and `buy_dispatch_gate` timing audit
- This preserved correctness, but it blurred the owner boundary and kept
  non-essential audit work on the hot path.

## Fix

- The runtime now computes the delay verdict synchronously and keeps that veto
  inline.
- `user buy dispatch delay` logging and `buy_dispatch_gate` audit emission are
  deferred off the synchronous buy path via a scheduler boundary.
- The deferred audit captures the exact delay snapshot at decision time, so the
  emitted numbers remain stable even though logging is asynchronous.

## Document Provenance

- Source: /Users/almurat/Downloads/logs.1776151885257.json
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To:
  - separating stale-signal veto from buy dispatch audit emission
  - preserving delay evidence while removing audit work from the synchronous
    trade owner path
- Verification: verified in runtime logs, code review, and local replay setup

## Guardrails

- Stale-signal rejection remains synchronous and may still skip an outdated buy.
- Timing audit does not own trade admission; it records the decision after the
  verdict is computed.
- Future hot-path fixes must not reintroduce inline audit/log work ahead of buy
  execution without a correctness reason.
