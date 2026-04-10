# 2026-04-10 Chat Home Route Eager Entry

## Problem

Users opening the site on mobile were seeing a full-screen loading state or a
route chunk timeout before the homepage chat UI appeared.

## Root Cause

The default `/` route and `/chat/:conversationId` route both lazy-loaded
`ChatInterface` through the route-level `lazyRoute()` wrapper.

That wrapper enforces a 12 second timeout. In production, the chat route chunk
had grown large enough that mobile users could hit the timeout before the route
finished loading.

## Fix

- Removed route-level lazy loading for `ChatInterface`.
- Made the default chat entry eager so the homepage can render immediately after
  app boot.
- Kept route-level lazy loading for secondary pages only.

## Guardrail

The primary home route must never depend on a full-screen route fallback to
become visible. If chat internals need more splitting later, that work should
happen inside the chat surface rather than by delaying the entire home route.
