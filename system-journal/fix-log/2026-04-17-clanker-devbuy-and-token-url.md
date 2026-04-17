# 2026-04-17 Clanker Dev Buy And Token Url

## What Changed

- Added `devBuy` support to the Clanker deploy input and tool schema so the
  model can request a creator buy during deployment.
- Extended `devBuy` to carry optional `poolKey`, `amountOutMin`, and
  `recipient` overrides for non-ETH pair routes.
- Simplified the default launch prompt so natural phrases like
  `buy me 0.1 ETH/BNB` map directly to `devBuy.ethAmount` without forcing the
  model to ask for advanced route fields.
- Updated `kiko-api/src/services/clankerService.ts` to pass the creator-buy
  amount and optional route overrides through to the Clanker deploy payload
  when present.
- Updated the deploy success shape so KiKo returns both the deployed token
  address and the Clanker token page URL:
  `https://www.clanker.world/clanker/<tokenAddress>`.
- Updated the visible Clanker skill prompt and skill metadata to mention
  creator buy support and the post-deploy token page URL.

## Why

Clanker v4 supports creator buy / dev buy as part of the deployment flow, but
the KiKo skill previously had no explicit input for it. The deploy response also
needed a stable user-facing URL so the assistant can point the user directly to
the token page after a successful launch.

## Product Rule

- `devBuy` is optional and should only be included when the user explicitly
  wants a creator buy.
- Simple creator-buy phrases should be treated as `devBuy.ethAmount` only;
  `poolKey`, `amountOutMin`, and `recipient` remain opt-in advanced overrides.
- `context` is chain-neutral provenance metadata and should pass through
  unchanged across supported deploy chains.
- Successful deploys should surface the Clanker token page URL when the API
  returns a token address or `expectedAddress`.
- The token page URL is the canonical `clanker.world/clanker/<address>` page,
  not the admin page.

## Verification

- Verified in the local `clanker-sdk` v4 schema that `devBuy.ethAmount` is a
  supported deployment field and that `poolKey` / `amountOutMin` / `recipient`
  are supported overrides in the SDK.
- Verified in the updated Clanker skill prompt and metadata that the default
  creator-buy path stays ethAmount-first and does not ask for advanced fields
  unless the user explicitly wants them.
- Verified in Clanker documentation that creator buy / dev buy is a supported
  deployment extension and that successful deploys lead to a token page.
- Verified in Clanker documentation that the token info page lives at
  `https://www.clanker.world/clanker/[TOKEN CONTRACT ADDRESS]`.

## Document Provenance

- Source: Clanker Documentation, Token Deployments
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: creator buy / dev buy availability
  - Verification: verified in docs
- Source: Clanker Documentation, Deploy Token (v4.0.0)
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: deploy response `expectedAddress` handling
  - Verification: verified in docs
- Source: Clanker Documentation, Get Token by Address
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: token page URL structure
  - Verification: verified in docs
- Source: clanker-sdk README and v4 schema
  - Kind: local dependency evidence
  - Retrieved: 2026-04-17
  - Applied To: `devBuy.ethAmount` input shape and defaults
  - Verification: verified in local dependency exports

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
