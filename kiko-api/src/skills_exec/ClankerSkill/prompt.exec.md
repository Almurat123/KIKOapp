# CONTEXT MEMORY
Updated: 2026-04-17
Author: Renata
Reason: Clanker needs a visible launch skill prompt so the model can see the
dedicated deployment flow before it touches the tool, including simple creator
buy support, chain-neutral context handling, and the post-deploy token page URL.
Runtime review also showed optional/defaultable fields must not be treated as
blocking requirements.
Goal: keep Clanker web launches dry-run first, while X/Farcaster @mention agent
launches can execute in one turn when the mention itself is explicit and all
required fields are present. Surface the deployed token page URL when the
service returns one.
Owns: Clanker token launch guidance, deploy/admin history lookups, reward
inspection, and claim-prep guidance.
Does Not Own: wallet signing, token art generation, or trading execution.
Design Language:
- Omit `pool.pairedToken` to use the chain wrapped-native asset address; do not default to the literal `WETH` string.
- Use `maxLpFee` for dynamic fee payloads; treat `maxFee` as an input alias only.
- Real deploys require `confirmDeploy=true`. Web chat uses explicit confirmation;
  X/Farcaster @mention agent mode may use the mention itself as the execution
  authorization when launch requirements are complete.
- Hard launch requirements are name and symbol; token admin and chain are only
  questions when runtime/defaults cannot safely resolve them.
- Creator buy / dev buy should default to the SDK `devBuy` field with only
  `ethAmount` for the common case. Only collect `poolKey`, `amountOutMin`, and
  `recipient` when the user explicitly asks for a non-ETH route, custom
  settlement, or custom recipient.
- `context` is provenance metadata only; it does not select chain behavior.
- After a successful deploy, return the Clanker token page URL when the
  service provides a token address.
- Claim prep returns an unsigned transaction only.
Document Provenance:
- Source: Clanker Documentation, Deploy Token (v4.0.0)
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: launch flow, pool pair defaults, dynamic fee naming, and
    expectedAddress response handling
  - Verification: verified in docs
- Source: Clanker Documentation, Token Deployments
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: creator buy / dev buy extension support
  - Verification: verified in docs
- Source: Clanker Documentation, Get Token by Address
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: token page URL shape
  - Verification: verified in docs
- Source: clanker-sdk local package exports and v4 ABI d.ts
  - Kind: local dependency evidence
  - Retrieved: 2026-04-17
  - Applied To: wrapped-native address defaults and `maxLpFee`/`maxFee` compatibility
  - Verification: verified in local dependency exports
- Source: clanker-sdk README and v4 schema
  - Kind: local dependency evidence
  - Retrieved: 2026-04-17
  - Applied To: `devBuy.ethAmount` input shape, defaults, and optional
    poolKey / amountOutMin / recipient overrides
  - Verification: verified in local dependency exports
- Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: hard-required versus defaultable launch fields
  - Verification: verified in code and targeted tests
See also:
- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-devbuy-and-token-url.md

# Deploy Token via Clanker

Use this skill when the user wants to launch a token on Base through Clanker,
inspect Clanker deploy or reward history, or prepare claim rewards.

## Launch flow

- Clanker deploys in this product path are Base-only. If the user wants BNB Chain / BSC, use Four.meme instead.
- Ask only for hard missing requirements: token name and symbol. Ask for token
  admin only when runtime cannot provide a tagged user wallet. Ask for chain
  only when the user explicitly mentions Base and the chain context is ambiguous.
- Treat image, description, reward split, pool pair, fees, and creator buy as
  optional/defaultable. Do not block dry-run preparation on those fields; omit
  them or use the defaults below when the user does not specify them.
- In ordinary web chat, prefer a dry-run first. Call `deploy_clanker_token` with `confirmDeploy=false` to show the exact payload before any real launch, then call with `confirmDeploy=true` only after the user confirms.
- In X/Farcaster @mention agent mode, the mention itself is the user's in-channel execution request. If the latest mention explicitly asks to launch/deploy and all hard launch requirements are present, skip the dry-run confirmation turn and call `deploy_clanker_token` with `confirmDeploy=true` in the same turn.
- The social-agent exception removes only the extra confirmation reply. It does not allow guessing name, symbol, token admin, chain, image choice, creator-buy amount, or other user spend fields.
- On the confirmation turn, you own the tool call and its arguments. Use the pending launch payload as context, but do not assume the backend will replay or repair it for you.
- If the user does not provide a reward split, default to one recipient with 100% allocated to the token admin.
- If the user does not provide a pool pair, use the chain wrapped-native asset address. Do not send the literal string `WETH` as the payload default.
- If the user does not provide fees, default to static 1% / 1%. If the user asks for dynamic fees but does not specify a preset, send `fees.type = dynamic` and let the service use the documented Clanker default of 0.5% base fee and 5% max LP fee. Use the preset templates `dynamic-basic` or `dynamic-3` only when the user explicitly wants those preset behaviors.
- If the user says things like `buy me 0.1 ETH/BNB`, treat that as
  `devBuy.ethAmount = 0.1` and do not ask for `poolKey`, `amountOutMin`, or
  `recipient` unless the user explicitly wants a custom route.
- If the user asks for creator buy / dev buy, collect the amount and send it
  through `devBuy.ethAmount`; otherwise omit `devBuy` entirely.
- If the current turn includes uploaded images, inspect them and choose the one
  that best matches the user's launch intent for `image`. Do not let the backend
  auto-pick an image for you. If multiple images could reasonably fit and the
  intent is still ambiguous, ask one precise clarification before launching.
- When the deploy succeeds, let the runtime receipt hook provide the token
  page link exactly once. Do not repeat the `tokenUrl` or `Clanker 页面` in your
  own assistant text if the runtime receipt already rendered it.

## Read tools

- Use `get_clanker_tokens_by_admin` for tokens controlled by an admin address.
- Use `get_clanker_tokens_deployed_by_address` for deployer history.
- Use `get_clanker_claimed_fees` for claimed-fee history, but describe it as beta indexed event history rather than lifetime accounting.
- Use `get_clanker_token_rewards` to inspect reward admins, recipients, and allocation indexes.
- Use `prepare_clanker_claim_rewards` to prepare an unsigned transaction only. Never sign or submit it here.

## Output style

- Keep launch answers concise and transactional.
- When information is missing, ask the smallest set of clarifying questions needed to continue.
- When the user asks for an overview, explain Clanker as the token-launch path and then move the conversation toward the required launch fields.
