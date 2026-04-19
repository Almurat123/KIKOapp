# 2026-04-19 Farcaster Generated Image Reply And Watermark Removal

## What Changed

- Generated-image execution no longer applies any server-side watermark to the
  final image asset.
- The image prompt optimizer no longer emits the plain `no watermark` default
  that conflicts with provider output. It only blocks
  extra provider/artist marks inside the generated scene.
- Farcaster generated-image assistant rows are now converted into reply payloads
  containing:
  - short fallback text, currently `Generated.`
  - durable generated-image public URLs as cast embeds
- Farcaster outbound delivery now persists those embed URLs and passes them to
  both the Neynar signer publish path and the Hub fallback publish path.
- Farcaster-originated generated-image tasks now request an opt-in public R2/CDN
  copy through the chat image storage owner. Ordinary web generated images stay
  private and continue using signed preview hydration.
- Farcaster generated-image reply waiting now synthesizes image-aware fallback
  text from the assistant message type and task status. A successful
  tool-managed image turn no longer falls back to the generic English
  `I ran into an issue processing that request. Please try again.` string just
  because the assistant text field is empty.
- 2026-04-20 follow-up: the Farcaster public fallback text was changed to
  English-only and task-output media is now used as a publication fallback when
  the assistant message image payload cannot supply embed URLs.
- The ImageGenerationSkill prompt now tells the main model how to handle
  Farcaster attached images: summarize visible traits into a new-image prompt
  rather than pretending true reference-image editing is wired.

## Why

Farcaster `@KiKo` ingress already supported mention/reply processing and
attached-image context, and model-owned image generation already existed through
`generate_image_from_intent`. The missing production boundary was outbound:
generated-image turns finish as structured `generated-image` assistant messages,
not normal text, and Farcaster reply publication only accepted text.

Without this change, a successful Farcaster image generation could leave the
public reply with only fallback text or an error-like empty assistant response.

Production runtime logs on 2026-04-19 confirmed that this was still happening
for at least one real mention: the turn ended as
`tool_managed_side_effect_response`, generated-output moderation saw
`imageCount=1`, but the public Farcaster reply still published with the generic
English empty-text fallback. The root bug was the bridge treating an empty
assistant `content` field as failure even when the assistant message type had
already switched to `generated-image`.

## Login And Model Boundary

Web chat:

- The dedicated image route is authenticated: the user must be logged into KiKo.
- The direct image-model path is selected from the Image section, currently
  `Grok Imagine`, and sends to `/api/chat/sessions/:sessionId/generated-images`.
- Normal text chat can still trigger image generation through the internal
  `generate_image_from_intent` tool when the main model decides the user is
  asking for a visual deliverable.

Farcaster:

- There is no Farcaster-side model selector.
- The user must have a linked KiKo account; otherwise ingress replies with the
  existing public bind/login prompt.
- The linked user's chat session text model runs the main reasoning turn.
- When that model calls `generate_image_from_intent`, the tool selects
  `grok-imagine-image` internally for the generated-image task.

## Current Limitation

Farcaster attached photos are model-visible context, but true provider-level
image edit/reference-image execution is still not wired. The supported behavior
is "generate a new image inspired by or based on the visible context." The model
must summarize the attached photo's subject/style/composition into the prompt
instead of passing `reference_images` as a real edit request.

Farcaster embeds now prefer `publicUrl` from the generated-image record. This
requires production to configure `CHAT_GENERATED_IMAGE_PUBLIC_BASE_URL` to a
public R2/custom-domain or CDN origin that maps to the configured bucket root.
Without that env var, Farcaster-generated image storage fails closed instead of
publishing an expiring signed preview URL.

## Verification

- Added/updated targeted tests for:
  - Neynar cast-reply embed parameter mapping
  - Farcaster reply-service embed persistence and publication handoff
  - Farcaster generated-image assistant reply extraction
  - prompt optimizer no longer emitting the exact `no watermark` constraint
- Verified in code that Farcaster-originated tool calls pass source
  `farcaster` into generated-image execution, which makes storage require a
  public generated-image URL.
- Verified in code that generated-image execution now moderates, previews, and
  stores `providerResult.imageBuffer` directly without watermark rewriting.
- Verified in runtime log
  `/Users/almurat/Downloads/logs.1776611031853.json` that the affected mention
  finished with `tool_managed_side_effect_response`, `finalTextLength: 0`, and
  generated-output moderation `imageCount: 1`, which matches the empty-text
  fallback failure mode this fix hardens.
- Verified in local SDK typings:
  - Neynar `publishCast` accepts `embeds?: Array<{ url: string }>`
  - Hub `CastAddBody.embeds` accepts `{ url }` entries

## Document Provenance

- Source: operator correction on 2026-04-19 to remove generated-image
  watermarking entirely
  - Kind: product doc
  - Retrieved: 2026-04-19
  - Applied To: deleting all server-side pixel watermark rewriting while
    retaining Farcaster generated-image reply behavior
  - Verification: verified in code
- Source: operator correction on 2026-04-19 for production-stable Farcaster
  image embeds
  - Kind: product doc
  - Retrieved: 2026-04-19
  - Applied To: replacing signed preview embed publication with opt-in public
    generated-image URL publication
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/node_modules/@neynar/nodejs-sdk/build/clients/NeynarAPIClient.d.ts`
  - Kind: local SDK source
  - Retrieved: 2026-04-19
  - Applied To: Neynar `publishCast` embed request shape
  - Verification: verified in local SDK typings
- Source: `/Users/almurat/KiKo/kiko-api/node_modules/@farcaster/hub-nodejs/dist/index.d.ts`
  - Kind: local SDK source
  - Retrieved: 2026-04-19
  - Applied To: Hub fallback `CastAddBody.embeds` URL shape
  - Verification: verified in local SDK typings
- Source: `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterIngressWorker.ts`
  - Kind: repo code
  - Retrieved: 2026-04-19
  - Applied To: confirming linked-user Farcaster session routing and absence of
    a Farcaster-side model selector
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/skills/ImageGenerationSkill/tools/generateImageFromIntent.ts`
  - Kind: repo code
  - Retrieved: 2026-04-19
  - Applied To: confirming internal generated-image model selection uses
    `grok-imagine-image`
  - Verification: verified in code
- Source: `/Users/almurat/Downloads/logs.1776611031853.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-19
  - Applied To: confirming that a Farcaster mention could finish image
    generation successfully while still publishing the generic empty-text
    fallback
  - Verification: verified in runtime log

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-v2-model-owned-image-generation-tool.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-generated-image-client-preview-hydration.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-billing.md
- /Users/almurat/KiKo/system-journal/conflicts.md
