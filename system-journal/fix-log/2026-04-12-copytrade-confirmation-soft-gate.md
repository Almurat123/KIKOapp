# 2026-04-12 Copytrade Confirmation Soft Gate

## Problem

Creating a copy-trade config was routed through the same hard execution gate as
trade mutations. The gate correctly required user confirmation, but the runtime
treated that checkpoint as a failure, which pushed the plan card into an error
state.

## Root Cause

`create_copy_trade_config` is an `ORDER_MUTATION`, so it must preserve a
confirmation boundary. The bug was not the existence of the boundary. The bug
was that the execution result was shaped like a failure instead of a soft
confirmation checkpoint, so the planner and UI rendered it as an error.

## Fix

- Keep the confirmation boundary for copy-trade config creation.
- Shape confirmation-required gate results as soft success payloads.
- Preserve the confirmation payload so the next turn can still ask the user to
  confirm and then execute the real config creation on the follow-up turn.

## Verification

- Verified the gate path in `executionGate.ts`.
- Verified `conversationStateResolver.ts` already converts confirmation payloads
  into `copy_trade_confirmation` state.
- Verified the tool execution engine now returns a confirmation-shaped success
  result for the pre-confirmation copytrade step.

## Guardrail

Do not turn confirmation checkpoints into failed steps or error messages.
Confirmation state should stay visible as a pending checkpoint, not as an
execution failure.
