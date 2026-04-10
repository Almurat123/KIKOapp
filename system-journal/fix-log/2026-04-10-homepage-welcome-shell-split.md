# 2026-04-10 Homepage Welcome Shell Split

## Problem

The first homepage timeout fix removed route-level lazy loading for chat, but it
still left the full chat runtime inside the main bundle. Mobile users could
still wait on a very large entry bundle before the homepage became visible.

## Root Cause

The default `/` route still imported `ChatInterface` directly.

That meant the homepage always paid for:

- full chat runtime boot logic
- conversation loading owners
- rich chat UI dependencies

before the user had actually started a conversation.

`WelcomeScreen` also statically imported its settings modal, which blocked that
optional surface from being split away from the home shell.

## Fix

- Added a dedicated `HomePage` owner for `/` that renders only the welcome shell.
- Deferred the full `ChatInterface` runtime until the user commits the first prompt.
- Added an explicit prompt handoff path so the first prompt auto-submits after
  the chat runtime mounts.
- Deferred the welcome-screen settings modal behind a lazy boundary.
- Restored route-level lazy loading for direct `/chat/:conversationId` entries,
  while keeping `/` itself lightweight.

## Guardrail

The homepage should own first paint, not the full chat runtime.

If new chat features are added, they must not be imported into the `/` shell
unless they are required before the user starts a conversation.
