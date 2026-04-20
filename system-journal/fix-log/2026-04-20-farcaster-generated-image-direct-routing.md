# 2026-04-20 Farcaster Generated Image Direct Routing

## What Changed

- Added deterministic Farcaster generated-image request detection in
  `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterChatBridge.ts`.
- Added `enqueueFarcasterGeneratedImageMessage`, which creates a transcript-native
  generated-image assistant row, creates a generated-image task, and starts the
  existing generated-image owner with `source: farcaster`.
- Updated
  `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts`
  so explicit image-generation casts bypass ordinary text-model orchestration.
- Added tests for English and Chinese image-generation casts with attachments,
  plus a guard that visual Q&A stays in the normal chat path.

## Why

The production traces showed the Farcaster ingress received the two attached
images, but still created ordinary chat tasks on `gpt-5.4-mini-2026-03-17`.
The model classified both turns as `general_answer`, never called
`generate_image_from_intent`, and published clarification text with no embeds.

That means the failure was not Farcaster media ingestion. It was routing:
explicit image-generation casts were still allowed to depend on a text model's
intent/tool decision. The bridge now treats clear generate/create/draw/render
image requests as generated-image tasks before the text model can downgrade the
turn to a normal answer.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776673868939.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: Farcaster direct generated-image routing and tests
  - Verification: verified in runtime log, code, and targeted tests
- Source: `/Users/almurat/Downloads/logs.1776673786346.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: confirming the issue was repeatable across adjacent runs
  - Verification: verified in runtime log and code

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npm test -- src/services/farcaster-agent/farcasterIngressWorker.test.ts`
- `cd /Users/almurat/KiKo/kiko-api && npx tsc --noEmit`

## Owner Boundaries

- `farcasterIngressWorker.ts` owns deciding which Farcaster ingress path to use
  after hydration and quota checks.
- `farcasterChatBridge.ts` owns Farcaster-to-chat task creation and now owns the
  deterministic Farcaster generated-image handoff.
- `generatedImageChatTask.ts` remains the only owner of provider execution,
  generated-image billing, safety checks, storage, and public Farcaster image
  publication copies.
