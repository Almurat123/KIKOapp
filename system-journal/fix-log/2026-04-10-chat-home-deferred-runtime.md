# 2026-04-10 Chat Home Deferred Runtime

## Problem

Even after making the home chat route eager, the homepage still bundled heavy
chat internals that were not needed before the user actually entered the chat
flow.

## Root Cause

`ChatInterface` statically imported:

- the full message rendering stack (`ChatMessageList` -> `MessageBubble` ->
  markdown/cards)
- the full strategy runtime (`useStrategies` + strategy extraction)
- the custom AI settings modal

That meant the homepage shell paid for these dependencies before any messages
were visible and before strategy features were relevant.

## Fix

- Deferred `ChatMessageList` behind a local lazy boundary so it mounts only once
  chat actually starts.
- Deferred `CustomAISettingsModal` until it is opened.
- Moved the strategy owner integration into a separate lazy bridge component so
  `useStrategies` no longer mounts in the homepage shell.

## Guardrail

The eager homepage route should only carry the minimum chat shell. Rich message
rendering, strategy syncing, and deep settings UI must remain behind local
feature boundaries instead of bloating the initial homepage bundle.
