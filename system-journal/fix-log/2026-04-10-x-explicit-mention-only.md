# Fix Log: 2026-04-10 X Explicit Mention Only

## What Changed

- Tightened X mention ingress so only tweets that explicitly mention the bot are treated as replyable mention events.
- Removed the fallback that accepted any reply whose `in_reply_to_user_id` matched the bot.

## Why

Production logs showed a reply event was accepted and enqueued, but the outbound X reply failed with:

`403 Reply to this conversation is not allowed because you have not been mentioned or otherwise engaged by the author of the post you are replying to.`

That means the ingress layer was still classifying some thread replies as mention work even when the author had not explicitly mentioned the bot in that specific tweet.

## Product Rule

- Every turn must explicitly `@KiKoappdev1`.
- Simple thread replies without an explicit mention are ignored.

## Document Provenance

- Source: production log `logs.1775820087518.json`
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: removing implicit thread-reply handling after X rejected outbound reply permission
- Verification: verified in runtime
