# Fix Log: 2026-04-13 X Mention Feed Confirmation

## What Changed

- Added a second-stage confirmation step before public X replies.
- Webhook-delivered mention candidates are now checked against the bot's official
  `/2/users/{botUserId}/mentions` feed before quota, agent execution, share
  generation, and outbound `replyToMention`.
- If the tweet is not present in the mentions feed, the event is skipped and
  logged as non-replyable platform evidence instead of failing later at the
  outbound reply step.

## Why

Production logs showed a mention event was received and enqueued, but the final
reply call failed with:

`403 Reply to this conversation is not allowed because you have not been mentioned or otherwise engaged by the author of the post you are replying to.`

That means webhook ingress alone was too weak as reply eligibility evidence.
X can still deliver a tweet-shaped webhook event that looks like mention work
while refusing API reply permission for that tweet.

The bot's mentions feed is a stronger signal because it reflects the platform's
own mention eligibility surface that the product is supposed to respond to.

## Product Rule

- The product only auto-replies to tweets that are visible in the bot's official
  mentions feed.
- Webhook payloads remain the fast ingress trigger, but they no longer decide
  reply eligibility on their own.
- If a webhook event cannot be confirmed in `/users/{botUserId}/mentions`, the
  product skips the reply instead of burning quota and failing at the final
  reply request.

## Document Provenance

- Source: X users/mentions API docs
- Kind: official API doc
- Retrieved: 2026-04-13
- Applied To: using the mentions timeline as the confirmation source for replyable mention tweets
- Verification: partially verified

- Source: production log `logs.1776054230484.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: proving webhook ingress can classify a tweet as mention work while
  X still rejects the outbound reply
- Verification: verified in runtime

