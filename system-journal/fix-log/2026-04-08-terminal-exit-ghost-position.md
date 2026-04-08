# Fix Log: Terminal Exit Ghost Position

Updated: 2026-04-08

## Problem

A copy-trade position could remain `open` after a terminal mirror-sell failure
with `Swap failed: No valid quotes found`. The exit intent was already moved to
`EXIT_FAILED_TERMINAL`, but the parent `position` stayed in the open pool.

## Root Cause

`classifyExitIntentExecutionError()` treated the no-quote case as terminal, but
returned `archivePosition: false`. The exit-intent worker therefore only closed
the intent row and never promoted the position out of `open`.

`positionMonitor` only processes `status = open` positions and uses cached token
price snapshots. Because the stuck position had no usable snapshot, the monitor
kept skipping it every cycle and logging `TP/SL check skipped: Price not available`.

## Target Behavior

- No-quote exit failures should be archived into `failed_final`.
- Terminal exit intents should not keep the parent position in the open pool.
- Positions that cannot be priced should stop re-entering the TP/SL loop once
  they are terminal.

## Files Corrected

- `kiko-api/src/services/copytrade-v2/exit/exitIntentExecutionPolicy.ts`

