# Fix Log: Side-Effect Tool Failure Terminal Receipts

Date: 2026-04-19
Author: Rowan

## Trigger

The operator reported that NVIDIA/GLM agent-mode turns could keep reasoning after a deploy or order tool had already failed. Runtime logs for session `cmo5a4f1h03sjj5et046ndecy` showed `deploy_clanker_token` returned `ok:false`, but the turn did not terminate because only successful mutation receipts had a deterministic runtime answer.

## Verified Runtime Evidence

- Session: `cmo5a4f1h03sjj5et046ndecy`
- Tool: `deploy_clanker_token`
- Observed result: `ok:false`
- Previous behavior: `nodeOrchestrator` logged the failed tool result, but `buildExecutionReceiptDecision` returned no answer for failed mutation tools, so orchestration opened another model round.

## Changes

- `executionReceiptAnswer.ts` now builds deterministic failure receipts for supported side-effecting tools instead of only building success receipts.
- Failure receipts include the tool error, reason code when present, and any concrete ids/URLs already returned by the tool result.
- `runNodeOrchestration` can now terminate the turn through the existing receipt-answer hook for supported mutation failures, without handing the failure back to the model for another generation round.
- Added targeted tests for:
  - failure receipt formatting for `deploy_clanker_token`
  - orchestrator termination after a failed side-effecting tool result

## Ownership

- Failure/success mutation receipt formatting: `kiko-api/src/jobs/chat/executionReceiptAnswer.ts`
- Mutation-round termination via runtime receipt answers: `kiko-api/src/jobs/chat/nodeOrchestrator.ts`

## Document Provenance

- Source: `/Users/almurat/KiKo/kiko-api/logs/app.log`
- Kind: runtime observation
- Retrieved: 2026-04-19
- Applied To: failed deploy mutation loop diagnosis and terminal failure-receipt requirement
- Verification: verified in runtime log and targeted tests

- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
- Kind: repo doc
- Retrieved: 2026-04-19
- Applied To: confirmed that the remaining loop cause was the missing failure terminal path after tool execution
- Verification: verified in code

## Non-Goals

- This entry does not change the underlying deploy/order tool business logic.
- This entry does not fabricate explorer or product links when a failing tool did not return them.

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-agent-execution-receipt-links.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
- /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
