# 2026-04-20 Generated Image Source Classification

## Context

`/Users/almurat/KiKo/test.txt` showed a normal Web chat generated-image turn
successfully reached provider generation and output moderation, then failed
while saving:

- prompt moderation passed
- provider returned one generated image
- output moderation passed
- storage failed with `Generated image public URL base is not configured for social publishing.`

The same run showed the task source reached generated-image storage as
Farcaster, even though the user was generating from ordinary Web chat.

## Root Cause

The image-generation tool treated any truthy `toolContext.farcaster` as a
Farcaster-originated task. Web chat attaches linked Farcaster profile data to
tool context as identity/social context, so users with linked Farcaster accounts
were incorrectly routed into social-publication storage. That path requires
`CHAT_GENERATED_IMAGE_PUBLIC_BASE_URL` because Farcaster embeds durable public
URLs.

## Decision

- Only classify a generated-image task as Farcaster when the task has explicit
  Farcaster runtime provenance: `currentPage === "farcaster"` or
  `pageContext === "farcaster_agent"`.
- Treat linked Farcaster profile data in ordinary Web chat as identity context
  only.
- Keep Farcaster-originated generated images fail-closed when public URL
  publishing is not configured.

## Provenance

- Source: `/Users/almurat/KiKo/test.txt`
- Kind: runtime observation
- Retrieved: 2026-04-20
- Applied To:
  `/Users/almurat/KiKo/kiko-api/src/skills/ImageGenerationSkill/tools/generateImageFromIntent.ts`
- Verification: verified in code and targeted test.

## Owner Boundaries

- Source classification:
  `/Users/almurat/KiKo/kiko-api/src/skills/ImageGenerationSkill/tools/generateImageFromIntent.ts`
- Private/public image storage boundary:
  `/Users/almurat/KiKo/kiko-api/src/services/chatImageUploads.ts`
- Farcaster chat ingress:
  `/Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterChatBridge.ts`
