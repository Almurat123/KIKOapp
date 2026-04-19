# 2026-04-19 Chat Orphan Session Loading State

## Problem

A route-local chat session could keep showing a running task even after the
backend no longer had that session. The browser kept its local conversation
object and `activeTask`, so the user saw a permanent loading state instead of a
clean failure.

## Root Cause

`useConversations.loadConversation()` treated every backend read failure the
same way. On `Session not found`, it logged the error and returned `null`, but
it did not evict the existing local conversation entry or clear the active task.

That behavior is correct for transient failures, but wrong for a hard 404. A
missing session means the local route state is orphaned, not stale.

## Fix

- Detect `Session not found` / hard 404 failures during `loadConversation()`.
- Remove the orphan local conversation entry and clear the active conversation
  id when that missing session is the current route target.
- Keep the stale-data preservation path for transient failures unchanged.

## Document Provenance

- Source: operator report on 2026-04-19 that a Farcaster-triggered chat route
  stayed loading while no backing chat session could be found in the provided
  database
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: distinguishing hard session absence from transient load failures
- Verification: verified in code

- Source: /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- Kind: repo doc
- Retrieved: 2026-04-19
- Applied To: aligning chat-route 404 handling with the repository loading
  resilience rules
- Verification: verified in code

## Guardrail

Prefer stale data only for transient failures. If the backend explicitly says a
chat session is gone, the frontend must not preserve ghost loading UI.
