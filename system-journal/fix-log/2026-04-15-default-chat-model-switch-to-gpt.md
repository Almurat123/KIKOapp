# Fix Log: 2026-04-15 Default Chat Model Switch To GPT

## What Changed

- Switched the canonical default chat model from `grok-4-1-fast-non-reasoning` to `gpt-5.4-mini-2026-03-17`.
- Updated the frontend default model selection helper to point new users at GPT.
- Updated Prisma defaults for `UserSettings.defaultChatModel` and `ChatSession.model`.
- Added a database migration that also backfills users who were still sitting on the old Grok default.

## Why

The product owner asked to stop using Grok as the default because it is more expensive than the GPT option.

X and Farcaster reply workers already honor the saved per-user model, so the only thing that needed to change was the canonical default for users who have not made an explicit choice yet.

## Owner Boundary

- `kiko-web` owns the UI default shown to new users.
- `UserSettings.defaultChatModel` owns the persisted per-user preference.
- `ChatSession.model` owns the default for brand-new sessions created without an explicit model.
- X and Farcaster mention workers continue to read the persisted user preference and do not invent their own defaults.

## Document Provenance

- Source: operator request to move the product default from Grok to GPT
- Kind: product doc
- Retrieved: 2026-04-15
- Applied To: canonical default model, new-session fallback, and persisted user defaults
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/x/xIngressWorker.ts`
- Kind: repo doc
- Retrieved: 2026-04-15
- Applied To: X mention replies continue using the user's saved model preference
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts`
- Kind: repo doc
- Retrieved: 2026-04-15
- Applied To: Farcaster mention replies continue using the user's saved model preference
- Verification: verified in code
