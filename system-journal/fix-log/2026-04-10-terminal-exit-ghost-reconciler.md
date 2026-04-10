# Fix Log: Terminal Exit Ghost Reconciler

Updated: 2026-04-10

## Problem

Some production positions still remained `open` even though their latest
`PositionExitIntent` had already reached `EXIT_FAILED_TERMINAL`.

These rows were created before the exit worker started archiving terminal
no-quote failures, so they never received `closedAt` or `failed_final`. The
position monitor therefore kept re-entering TP/SL and logging
`TP/SL check skipped: Price not available`.

## Root Cause

The existing stale-open reconciler only repaired rows where:

- `Position.status = open`
- `Position.closedAt` was already set

It did not handle the second ghost shape:

- `Position.status = open`
- latest `PositionExitIntent.lifecycleState = EXIT_FAILED_TERMINAL`
- `Position.closedAt` is still null

## Target Behavior

- Before TP/SL price checks, the monitor should inspect the latest terminal exit
  intent for each open position.
- If the latest intent is already terminal-failed, the monitor must archive the
  parent position into `failed_final` and update the canonical order to
  `FAILED_TERMINAL`.

## Files Corrected

- `kiko-api/src/services/copytrade-v2/runtime/positionMonitor.ts`
- `kiko-api/src/services/copytrade-v2/runtime/terminalExitGhostPositionReconciler.ts`
