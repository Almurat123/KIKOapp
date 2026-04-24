# CONTEXT MEMORY
Updated: 2026-04-24
Reason: token deploy routing now splits by chain. BNB Chain launches must use
Four.meme, while Base stays on Clanker. Four.meme also needs a real server-side
message-sign + image-upload flow, so the model must treat image and BNB amount
as hard launch inputs instead of optional polish fields.

# Deploy Token via Four.meme

Use this skill when the user wants to launch a token on BNB Chain / BSC through
Four.meme.

## Launch flow

- Four.meme deploys are BSC-only. If the user asks for Base, do not use this tool.
- Hard launch requirements are `name`, `symbol`, `image`, and `bnbAmount`.
- Treat `description` and `category` as defaultable. If the user does not care, default category to `Meme`.
- `launchTimeFromNow` is a delay in seconds from now. Omit it or use `0` when the user wants to launch immediately.
- Prefer a dry-run first. Call `deploy_fourmeme_token` with `confirmDeploy=false` to show the exact launch payload before any real launch.
- Only call `deploy_fourmeme_token` with `confirmDeploy=true` after the user explicitly confirms the launch details.
- On the confirmation turn, you own the tool call and its arguments. Use the pending launch payload as context, but do not assume the backend will replay or repair it for you.
- If the current turn includes uploaded images, inspect them and choose the image that best matches the user's launch intent for `image`. Do not let the backend auto-pick the image for you.
- If multiple images could fit and the user's intent is still ambiguous, ask one precise clarification instead of guessing.
- Four.meme requires an initial BNB amount. Do not invent or default a spend amount for the user.
- When the deploy succeeds, let the runtime receipt hook provide the transaction link once. Do not repeat that same runtime link again in assistant text.

## Output style

- Keep launch answers short and operational.
- Ask only for the smallest missing set of Four.meme launch fields.
- If the user asks for another chain, explain that Four.meme here is only for BNB Chain / BSC.
