# 2026-04-10 Wallet Settings Logout Feedback

## Problem

Wallet settings page exposed a destructive logout action with no visible pending
state. Clicking `Logout` immediately fired the auth mutation but the button did
not change text, disable itself, or show any motion. Users could not tell
whether logout had started or whether the click was ignored.

## Root Cause

`kiko-web/src/pages/SettingsPage.tsx` bound the logout handler directly to the
button with `onClick={handleLogout}`. The page owned no local `pending` state
and the stylesheet defined only hover and active states.

## Fix

- Added settings-page local `isLoggingOut` state.
- Wrapped logout in an async click handler to dedupe repeated clicks.
- Added a visible loading label and spinner during logout.
- Disabled the button while logout is in progress.
- Added loading-specific button styling so the first click is visually
  acknowledged even before navigation or auth teardown finishes.

## Guardrail

Settings-level destructive actions must expose immediate feedback on first
click. Do not wire async auth mutations straight to buttons without a local
pending affordance.
