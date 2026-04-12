# 2026-04-12 Copytrade Card Live Hydration

## Summary

Copytrade creation could render correctly only after re-entering a chat session.
The live `strategy-card` websocket event was reaching the chat UI, but a later
session hydration pass replaced the local card with the stale plain-text database
row until persistence caught up.

## Root Cause

- Owner: `kiko-web/src/hooks/useConversations.ts`
- `loadConversation()` merged database messages over local messages by default.
- The merge logic already protected `transaction-status-card` when the database
  row lagged behind, but it did not preserve `strategy-card` or other rich
  non-text assistant messages.
- Result: the current conversation lost the live card after a background reload,
  while a later re-entry showed the card because the database had finally caught
  up.

## Correction

- Added a local-first merge rule for rich assistant message types when the
  database row is still plain text.
- Preserved same-type rich assistant data merges instead of collapsing back to
  text.
- Kept transaction-card specific merge behavior intact.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1775995828927.json`
- Kind: runtime observation
- Retrieved: 2026-04-12
- Applied To: confirming that copytrade confirmation completed, but the live chat
  view lost the card before a later session reload.
- Verification: partially verified

- Source: `/Users/almurat/Downloads/IMG_4739.PNG`
- Kind: runtime observation
- Retrieved: 2026-04-12
- Applied To: confirming that the copytrade result remained as plain text in the
  active session instead of rendering the strategy card immediately.
- Verification: verified in runtime

- Source: `kiko-web/src/components/Chat/ChatInterface.tsx`
- Kind: repo doc
- Retrieved: 2026-04-12
- Applied To: confirming that `show_strategy_card` already updates the live
  message state when the websocket event arrives.
- Verification: verified in code

## Verification

- `npm run build` in `kiko-web`
