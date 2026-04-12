# 2026-04-12 First Send No Loading Chat Entry

## Problem

After sending the first message from `/`, the chat surface still felt like it
was loading before entering the conversation. The route owner had already been
restored, but the first-send path still deferred the primary message list and
rendered a visible pending-send spinner before an assistant message or task
state existed.

## Root Cause

`ChatInterface` treated the first-send pending state as visible chat content.
At the same time, `ChatMessageList` was loaded through `React.lazy`, so the
primary surface could mount only after the send interaction had already started.

That made the first user message compete with a chunk boundary and a standalone
thinking spinner during the most latency-sensitive interaction.

## Fix

- Restored `ChatMessageList` as an eager import of the core chat surface.
- Kept the message list mounted across welcome and chat states.
- Removed the standalone `firstSendPending` spinner from `ChatMessageList`.
- Kept `firstSendPending` as internal duplicate-send protection only.

## Document Provenance

- Source: `git show ca8163b:kiko-web/src/components/Chat/ChatInterface.tsx`
- Kind: repo history
- Retrieved: 2026-04-12
- Applied To: compare the 2026-03-12 chat entry against the current first-send path
- Verification: verified in code

- Source: Runtime complaint about visible loading after first send
- Kind: runtime observation
- Retrieved: 2026-04-12
- Applied To: remove visible first-send pending UI and eager-load the primary message list
- Verification: partially verified

## Guardrail

The primary message list is not an optional late chunk for the first-send path.
Heavy strategy runtimes and modals may remain deferred, but the chat surface
that shows the user's sent message must be immediately available.
