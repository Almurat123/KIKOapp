# 2026-04-17 Chat Input Borderless Model Reasoning Selector

## What Changed

- Replaced the old single bordered model pill in the chat composer and welcome
  shell with `ChatModelSelector`, which splits the choice into two inline
  controls: model family and reasoning strength.
- Reordered the add-image `+` button after the model selector in both the live
  composer and the welcome shell so the model control stays left-most in the
  action row.
- Increased horizontal breathing room around the model and reasoning pills so
  the highlighted state no longer feels cramped against the row edges.
- Removed visible borders from the `+`, settings, model-family, reasoning, and
  send controls in the chat input row so the layout matches the supplied
  borderless reference screenshot.
- Removed the lingering white/default fill from the `+` and settings icon
  buttons so they now stay transparent at rest and only highlight on hover like
  the rest of the borderless row.
- Updated the model catalog to preserve a single persisted model id while
  exposing family/reasoning metadata to the UI.
- Kept the add-image `+` control unhighlighted at rest and moved its highlight
  to hover, matching the other input-row actions.
- Restored a visible GPT-5.4 mini reasoning selector, but narrowed it to the
  product-visible `Low / Medium` subset of the documented ladder and threaded
  the chosen effort through task context into the OpenAI adapter.
- Made the GPT reasoning button derive its visible label from the active
  effort state so stale serialized `Fast` labels do not leak back into the UI.
- Removed the separate family-default reasoning table so fallback selection now
  comes from the actual options declared for that model family.
- Removed the old `ChatInterface` dropdown ownership and outside-click state so
  the picker chrome now lives entirely in the composer/welcome owners.

## Why

The requested visual target was the Codex-style input row: one inline model
selector on the left and one inline reasoning selector on the right, with no
box borders around the surrounding control buttons. The prior glass/boxed model
chip made the input row heavier than the reference and bundled model family and
reasoning into a single visual control. GPT-5.4 mini also needs the real
reasoning-effort ladder surfaced because the API documents `none` as the
default and `low / medium / high / xhigh` as the real knobs.

## Product Rule

- Chat input controls should read as lightweight inline actions.
- Model family and reasoning strength are separate UI controls but still map to
  one persisted model id.
- The same borderless control language should apply to the welcome shell and
  the live chat composer.
- Selected pills need enough left/right space to read clearly at rest and in
  the highlighted state.
- Add-image affordance should be neutral at rest and only highlight on hover.
- Icon-only buttons should stay transparent at rest, not white-filled.
- Per-family fallback must resolve through the family's real declared options.
- GPT-5.4 mini should expose only `Low / Medium` in the selector; do not show
  `Fast`, `High`, or `Extra High` for GPT.
- Reasoning strength must be preserved from the chat task context into the
  provider request so OpenAI receives the selected effort.

## Verification

- Verified in code that `ChatComposer` and `WelcomeScreen` both render
  `ChatModelSelector`.
- Verified in code that the add-image button now follows the model selector in
  both input rows.
- Verified in code that the selected model/reasoning pills now have more
  horizontal padding and row breathing room in both input shells.
- Verified in code that `ChatInterface` no longer owns the old dropdown state.
- Verified in code that the add-image button is neutral at rest and only
  highlights on hover in both chat and welcome shells.
- Verified in code that family fallback now uses the actual option list instead
  of a guessed reasoning-default map.
- Verified in code that GPT-5.4 mini reasoning effort now flows through
  `routes/chat.ts` -> `providerPolicyBuilder.ts` -> `nodeOrchestrator.ts` ->
  `llm_gateway/adapters/openai_like.py`.
- Verified in code that GPT-5.4 mini now surfaces only `Low / Medium` in the
  selector and hydrates older GPT saves onto the remaining choices.
- Verified in code that the GPT reasoning button now derives its label from
  the active effort state rather than a cached serialized label.
- Verified `npm exec tsc --noEmit` in `kiko-web`.
- Verified `npm exec tsc --noEmit` in `kiko-api`.
- Verified Python syntax for the modified OpenAI gateway adapter.

## Document Provenance

- Source: user screenshot request showing a borderless model + reasoning row
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: removing borders and splitting the selector into two inline
    controls
  - Verification: inferred
- Source: OpenAI GPT-5.4 model page and reasoning guide
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: confirming GPT-5.4 mini supports a real reasoning-effort
    ladder that can be narrowed in the product UI
  - Verification: verified in docs
- Source: user request to remove `Fast`, `High`, and `Extra High` from GPT
  - Kind: product doc
  - Retrieved: 2026-04-17
  - Applied To: exposing only `Low / Medium` for GPT-5.4 mini
  - Verification: inferred
- Source: `/Users/almurat/KiKo/kiko-api/src/routes/chat.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: capturing the selected reasoning hint in task context
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/providerPolicyBuilder.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: normalizing GPT reasoning effort before provider handoff
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-python/llm_gateway/adapters/openai_like.py`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: forwarding `reasoning_effort` into OpenAI chat/completions
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/ChatComposer.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: composer control layout and picker ownership
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: welcome shell control layout and picker ownership
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: family/reasoning mapping metadata
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/ChatInterface.tsx`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: preserving the selected reasoning strength in local storage
  - Verification: verified in code

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-homepage-welcome-stardust-background-removal.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md
- /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
- /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
