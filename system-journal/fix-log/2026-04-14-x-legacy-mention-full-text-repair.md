# Fix Log: 2026-04-14 X Legacy Mention Full Text Repair

## What Changed

- Repaired legacy X webhook mention extraction to read mention text from the
  full-text fields instead of trusting only the short `text` field.
- Legacy mention extraction now checks:
  - `full_text`
  - `extended_tweet.full_text`
  - `note_tweet.text`
  - `text`
- Legacy mention detection now merges mention entities from:
  - `entities.user_mentions`
  - `extended_tweet.entities.user_mentions`

## Why

Production log `logs.1776172125273.json` showed a webhook payload with:

- `legacyMentionEventCount = 1`
- `mentionCount = 0`
- `acceptedCount = 0`

That proved X delivered a legacy `tweet_create_events` payload, but our parser
still dropped it before the worker ever saw a mention.

The user also provided a screenshot of a long quoted post where `@KiKoappdev1`
appeared near the end of the body text. This is exactly the legacy payload
shape where X can truncate `text` while keeping the real mention only in
`full_text` / `extended_tweet.full_text` and the extended mention entity list.

## Product Rule

- A long legacy mention must still be reply-eligible even when the bot mention
  appears only near the end of the post body.
- Webhook parsing must prefer full tweet text and extended mention entities so
  valid mentions are not silently dropped before mentions-feed confirmation.

## Document Provenance

- Source: production log `logs.1776172125273.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To: proving a legacy mention event reached webhook ingress but was
  dropped before enqueue
- Verification: verified in runtime

- Source: user-provided screenshot of a long quoted post with `@KiKoappdev1`
  at the end of the body
- Kind: product/runtime evidence
- Retrieved: 2026-04-14
- Applied To: justifying full-text and extended-entities extraction for legacy
  mention events
- Verification: partially verified
