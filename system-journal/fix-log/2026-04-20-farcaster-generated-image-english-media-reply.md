# 2026-04-20 Farcaster Generated Image English Media Reply

## What Changed

- Farcaster generated-image fallback text is now English:
  - success: `Generated.`
  - pending: `Image generation is still running. Please try again in a moment.`
- Generated-image task completion now records the terminal image output in
  `AITask.toolContext.generatedImage.output` before the task is marked done.
- Farcaster reply assembly now falls back to that task output when the assistant
  message does not provide usable embed URLs.
- Farcaster publish logging now records `embedCount` without logging the media
  URLs themselves.

## Why

Production runtime logs showed the image-generation tool completed successfully:
prompt and output moderation passed, the local image tool returned `ok: true`,
and the Farcaster reply was published. The public cast still contained only the
Chinese fallback text `已生成。` and no visible image attachment.

The repair has two parts:

- Remove Chinese generated-image fallback copy from public Farcaster replies.
- Keep a deterministic media fallback in task context so publication does not
  depend only on rereading the assistant message payload.

## Verification

- Verified from `/Users/almurat/Downloads/logs.1776622156347.json` that trace
  `6acafa9e-0a25-479a-b5b4-7975d51fe632` completed generated-image output
  moderation with `imageCount=1`, then published a Farcaster reply.
- Added a targeted test for task-output generated-image embed fallback.
- Updated existing Farcaster generated-image tests to expect English public
  fallback text.

## Document Provenance

- Source: `/Users/almurat/Downloads/logs.1776622156347.json`
  - Kind: runtime observation
  - Retrieved: 2026-04-20
  - Applied To: diagnosing successful image generation followed by text-only
    Farcaster publication
  - Verification: verified in runtime log and code
- Source: operator correction on 2026-04-20 that Farcaster replies must not use
  Chinese generated-image status text and must include the generated image
  - Kind: product instruction
  - Retrieved: 2026-04-20
  - Applied To: English fallback text and media fallback for public casts
  - Verification: verified in targeted tests

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-farcaster-generated-image-reply-and-watermark.md
- /Users/almurat/KiKo/system-journal/design-language/generated-image-safety.md
