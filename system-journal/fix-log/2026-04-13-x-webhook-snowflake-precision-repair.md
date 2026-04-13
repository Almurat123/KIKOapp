# Fix Log: 2026-04-13 X Webhook Snowflake Precision Repair

## What Changed

- Repaired legacy `tweet_create_events` webhook parsing so X snowflake ids are
  recovered from the raw webhook body before mention extraction runs.
- The route now patches legacy tweet event fields such as:
  - `id`
  - `author_id`
  - `conversation_id`
  - `in_reply_to_status_id`
- Mention processing keeps using normal parsed JSON for business logic, but no
  longer trusts precision-lost numeric snowflakes produced by plain `JSON.parse`.

## Why

Runtime investigation on 2026-04-13 found a real mention tweet visible in the
bot's official `/2/users/{botUserId}/mentions` feed with id:

- `2043555032457674791`

But the webhook event for the same tweet was being recorded and processed as:

- `2043555032457674800`

The same precision drift also affected the author id. That made the mention-feed
confirmation layer treat a valid mention as missing, because the webhook-side id
no longer matched the official mentions feed.

This is a classic JavaScript safe-integer problem: X snowflake ids arrived in
legacy webhook JSON as bare numbers, and `JSON.parse` converted them to
precision-lost `number` values before our extractor turned them back into
strings.

## Product Rule

- A mention is only reply-eligible if it is visible in the bot's official
  mentions feed.
- Webhook legacy tweet events must preserve exact snowflake ids, otherwise
  platform-confirmed mentions can be falsely dropped.

## Document Provenance

- Source: production log `logs.1776056502806.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: proving webhook mention id `2043555032457674800` was not present in
  mentions feed
- Verification: verified in runtime

- Source: direct X API inspection using the stored bot OAuth2 token
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: proving the actual mention tweet was `2043555032457674791` and was
  present in `/2/users/{botUserId}/mentions`
- Verification: verified in runtime

