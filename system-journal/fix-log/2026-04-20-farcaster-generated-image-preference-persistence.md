# 2026-04-20 Farcaster Generated Image Preference Persistence

## What Changed

- Added `UserSettings.defaultGeneratedImageModel` and
  `UserSettings.defaultGeneratedImageQuality` in
  `/Users/almurat/KiKo/kiko-api/prisma/schema.prisma` plus a matching Prisma
  migration and SQL snapshot update.
- Updated `/Users/almurat/KiKo/kiko-api/src/routes/users.ts` to persist
  generated-image defaults separately from `defaultChatModel`.
- Updated `/Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx`
  to save image-model selections into the new generated-image settings fields
  instead of dropping them on the floor.
- Updated
  `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts`
  and
  `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterChatBridge.ts`
  so explicit Farcaster generated-image requests prefer the saved
  generated-image model and quality before falling back to chat-model-family
  defaults.

## Why

The production log showed a user could pick an image model on the website, then
mention `@kiko` on Farcaster and still execute a text-session model path. The
root cause was not prompt quality or image ingress. The saved website image
selection never reached Farcaster because:

- frontend persistence only wrote `defaultChatModel` for text models
- backend user settings only exposed the text default to Farcaster ingress
- Farcaster generated-image routing derived provider choice from the text chat
  model instead of a separately saved generated-image preference

That meant the image selection UI and the Farcaster generated-image owner had no
shared persisted state.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776677599432.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: tracing the Farcaster mention back to a text-model task instead
    of a generated-image task
  - Verification: verified in runtime log and code
- Source: repository code in
  `/Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx`,
  `/Users/almurat/KiKo/kiko-api/src/routes/users.ts`, and
  `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-20
  - Applied To: confirming the missing persistence boundary and repairing it
  - Verification: verified in code

## Verification

- `cd /Users/almurat/KiKo/kiko-api && npx prisma generate`
- `cd /Users/almurat/KiKo/kiko-api && npx tsc --noEmit`
- `cd /Users/almurat/KiKo/kiko-api && npm test -- src/services/farcaster-agent/farcasterIngressWorker.test.ts`
- `cd /Users/almurat/KiKo/kiko-web && npx tsc -b --pretty false`

## Owner Boundaries

- `WelcomeScreen.tsx` owns persisting the home/default selected model into the
  appropriate remote settings fields.
- `routes/users.ts` owns normalizing and storing text defaults separately from
  generated-image defaults.
- `farcasterIngressWorker.ts` owns reading the saved generated-image preference
  from the linked user before handing the turn to the chat bridge.
- `farcasterChatBridge.ts` owns choosing the final generated-image task model
  and quality for explicit Farcaster image requests.
