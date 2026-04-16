# 2026-04-17 Default Chat Model Switch To Kimi Instant

## What Changed

- Changed the canonical frontend chat default from `gpt-5.4-mini-2026-03-17` to `kimi-k2-5-instant`.
- Changed backend chat-model normalization so empty or unsupported model inputs fall back to `kimi-k2-5-instant`.
- Changed Prisma defaults for `UserSettings.defaultChatModel` and `ChatSession.model` to `kimi-k2-5-instant`.
- Added a production migration that updates existing `UserSettings` rows still equal to the previous GPT default, while leaving non-GPT user choices unchanged.
- Changed model-omitted frontend/backend helper fallbacks to Kimi Instant where they previously drifted to GPT or GLM.

## Why

The operator asked for the product default to stop using GPT and move to the free Kimi 2.5 Fast/Instant path. KiKo has multiple default owners: frontend initial state, backend session normalization, persisted user settings, SQL bootstrap snapshots, and model-omitted helper calls. All default owners must move together or new chats, social replies, and background parsing can silently disagree.

## Product Rule

- `kimi-k2-5-instant` is the canonical default model for new user-facing chat.
- The frontend must not infer the default from model list order.
- The backend must normalize empty or unsupported model ids to `kimi-k2-5-instant`.
- Existing non-GPT saved user preferences remain explicit user choices and must not be rewritten by this migration.
- Existing chat-session history should not be rewritten; only future defaults and previous-default user settings should change.

## Verification

- Verified in code that `chatConstants.DEFAULT_CHAT_MODEL_ID` is `kimi-k2-5-instant`.
- Verified in code that `DEFAULT_CHAT_MODEL` is `kimi-k2-5-instant`.
- Verified in code that Prisma schema defaults and SQL bootstrap defaults use `kimi-k2-5-instant`.
- Verified `npm exec tsc --noEmit` in `kiko-api`.
- Verified `npx tsc --noEmit` in `kiko-web`.
- Verified `npx prisma validate` in `kiko-api`.

## Document Provenance

- Source: operator request to move the default from GPT to free Kimi 2.5 Instant/Fast
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: choosing `kimi-k2-5-instant` as the canonical default
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-lite-defaults.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: confirming Kimi Instant is KiKo's fast/no-thinking Kimi mode
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/env.example`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: confirming `kimi-k2-5-instant` is already in the free-model billing list
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-lite-defaults.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
- /Users/almurat/KiKo/system-journal/conflicts.md
