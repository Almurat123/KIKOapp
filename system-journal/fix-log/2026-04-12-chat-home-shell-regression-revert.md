# 2026-04-12 Chat Home Shell Regression Revert

## Problem

The homepage shell split introduced a visible `Preparing chat...` stage and made
the first send enter chat through two different runtime paths.

Users then saw:

- a temporary preparing state after send
- chat-page loading during the first conversation creation
- repeated refresh/repaint of streaming reply content and plan cards

## Root Cause

The first send path became:

`WelcomeScreen -> HomePage -> LazyChatInterface -> create session -> navigate(/chat/:id) -> ChatInterface`

That meant the chat runtime could mount once inside `HomePage`, then mount again
through the routed `/chat/:conversationId` owner immediately after session creation.

The extra owner boundary and pending-prompt auto-submit handoff introduced UI
churn during the most latency-sensitive part of chat.

## Fix

- Removed the `HomePage` chat shell split.
- Restored `ChatInterface` as the direct owner for both `/` and `/chat/:conversationId`.
- Removed the extra pending-prompt auto-submit handoff path from `ChatInterface`.

## Guardrail

Do not introduce a separate route-level shell for the primary chat entry if the
first-send path must immediately transition into the full chat runtime. The
primary chat owner must remain stable across welcome, send, and route creation.
