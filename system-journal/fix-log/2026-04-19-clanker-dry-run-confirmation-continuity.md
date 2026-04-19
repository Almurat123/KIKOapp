# 2026-04-19 Clanker Dry-Run Confirmation Continuity

## What Changed

- `kiko-api/src/jobs/chat/conversationStateResolver.ts`
  - now reconstructs `deploy_clanker_token` dry-run previews as reusable
    `order_confirmation` state instead of dropping them after the preview turn
  - preserves `TOKEN_DEPLOY_MUTATION` as the confirmation action class
  - clears stale preview state once a real Clanker deployment receipt appears

- `kiko-api/src/jobs/chat/workerStateBuilder.ts`
  - now exposes Clanker deploy previews as `token_deploy` worker state
  - replays the prepared launch payload with `confirmDeploy=true` only on the
    execute handoff
  - recomputes confirmation bindings from the normalized execute args so the
    direct follow-up plan and execution gate stay in sync

- `kiko-api/src/jobs/chat/nodePromptAssembler.ts`
  - now surfaces `order_confirmation` payloads in `WORKING_MEMORY` and
    `USER_CONTEXT`
  - keeps Clanker deploy previews visible to the model so it can help confirm
    the exact prepared payload

- Added targeted tests for:
  - Clanker dry-run preview confirmation reconstruction
  - Clanker deploy worker-state progress
  - Clanker deploy direct follow-up execution
  - prompt visibility of pending Clanker deploy confirmation payloads

## Why

Clanker launches already had a dry-run-first tool contract, but the preview did
not become durable confirmation state. That meant the model could see the
preview response, but the next confirm turn could not reliably reconstruct the
same launch payload for execution.

The fix keeps the preview as shared state for the model and the worker, while
still reserving the actual `confirmDeploy=true` handoff for execution time only.

## Product Rule

- Clanker dry-run previews are confirmation-ready state, not disposable tool
  noise.
- The model should see the prepared launch payload and help verify it before
  execution.
- `confirmDeploy=true` remains an execution-only handoff detail.
- Successful deploy receipts clear older preview state instead of reviving it.

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npx tsx --test --test-force-exit src/jobs/chat/conversationStateResolver.test.ts src/jobs/chat/workerStateBuilder.test.ts src/jobs/chat/nodePromptAssembler.test.ts src/jobs/chat/executionGate.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npx tsc --noEmit`

Both passed on 2026-04-19.

## Document Provenance

- Source: local runtime observation of the Clanker dry-run preview / confirm
  mismatch in the current KiKo thread
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: preview-to-confirm continuity and stale-preview clearing
  - Verification: verified in code and targeted tests

- Source: `/Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: original Clanker dry-run / mutation gate split
  - Verification: verified in code and targeted tests

- Source: `/Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: preserving Clanker preview payloads as confirmable state
  - Verification: verified in code and targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
