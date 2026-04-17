# Design Language: Clanker Token Deploy Skill

Updated: 2026-04-17
Author: Renata

## Purpose

KiKo can help users launch Clanker v4 tokens and inspect Clanker deploy/reward
history, but deployment is a write action with market consequences. The Clanker
skill must therefore be visible as a first-class skill entry, not just a tool
bundle, and it must separate preview, deploy, indexed analytics, and wallet
claim preparation.

## Rules

- Deployment tools must dry-run by default and return the exact payload that
  would be sent to Clanker.
- Real deployments require an explicit `confirmDeploy=true` argument after the
  user has confirmed the exact launch payload, including any defaults that will
  be used for omitted optional fields.
- Runtime policy must classify `confirmDeploy=true` Clanker launches as
  `TOKEN_DEPLOY_MUTATION`; prompt-only confirmation rules are not sufficient.
- Provider gateways must treat `TOKEN_DEPLOY_MUTATION` as node-controlled hard
  mutation and must not expose provider-native or extra SDK tools for that turn.
- Hard missing launch requirements are token name and symbol. Token admin is
  required only when runtime cannot supply a tagged wallet, and chain is
  required only when the user asks for a non-default ambiguous chain.
- Image, description, reward split, pool pair, fees, and creator buy are
  optional/defaultable and must not block dry-run payload preparation.
- The Clanker deploy skill must be selected by query routing when the user asks
  to deploy, launch, or inspect Clanker launches, even if canonical normalization
  does not produce a specialized intent.
- If the user does not specify reward splits, the default launch path is one
  recipient who receives 100% of the rewards.
- If the user does not specify a pool, the default launch path is a standard
  pool paired with the chain's wrapped native asset address.
- If the user does not specify fees, the default launch path is fixed fees at
  1% on the token side and 1% on the paired side.
- Dynamic fee details should only be expanded when the user asks for them, and
  the assistant should recommend the `dynamic-basic` and `dynamic-3` templates.
- Dynamic deploy payloads should use `maxLpFee` as the outgoing field name;
  `maxFee` is only a compatibility alias in the tool input.
- Creator buy / dev buy is an optional SDK extension and may include
  `poolKey`, `amountOutMin`, and `recipient` overrides when the user wants a
  non-ETH route or custom settlement.
- Simple creator-buy phrases like `buy me 0.1 ETH/BNB` should map to
  `devBuy.ethAmount` first; do not ask for `poolKey`, `amountOutMin`, or
  `recipient` unless the user explicitly asks for a non-ETH route, slippage
  control, or custom settlement.
- Context is provenance metadata only; it must remain chain-neutral and must
  not be used to infer deploy chain support.
- Successful deploy responses should be converted into a Clanker token page
  URL using the returned token address.
- Reward splits for the HTTP API are expressed as `allocation` percentages and
  must sum to 100 across 1 to 7 recipients.
- Claimed-fee history must be described as beta indexed event history, not a
  guaranteed lifetime accounting ledger.
- Claiming rewards must be prepared as an unsigned transaction; this layer must
  not sign or submit on behalf of the user.
- Admin history and deployer history are separate lookups and must not be
  treated as interchangeable.

## Document Provenance

- Source: Clanker Documentation, Deploy Token (v4.0.0)
- Kind: official API doc
- Retrieved: 2026-04-17
- Applied To: deployment payload, reward allocation, fee and pool fields
- Verification: verified in docs

- Source: Clanker Documentation, Token Deployments
- Kind: official API doc
- Retrieved: 2026-04-17
- Applied To: creator buy / dev buy availability
- Verification: verified in docs

- Source: Clanker Documentation, Get Token by Address
- Kind: official API doc
- Retrieved: 2026-04-17
- Applied To: token page URL structure for deploy success output
- Verification: verified in docs

- Source: Clanker Documentation, Get Claimed Fees [beta]
- Kind: official API doc
- Retrieved: 2026-04-17
- Applied To: indexed claimed-fee caveat and query tool semantics
- Verification: verified in docs

- Source: /Users/almurat/KiKo/kiko-api/src/skills_exec/ClankerSkill/prompt.exec.md
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: visible launch prompt wording, simple creator-buy phrasing, and deploy confirmation guidance
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-api/src/skills/ClankerSkill/tools/clankerTools.ts
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: launch tool schema wording for ethAmount-first creator buy defaults
  - Verification: verified in code

- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/skillIntentMatcher.ts
- Kind: repo doc
- Retrieved: 2026-04-17
- Applied To: first-class Clanker deploy query routing
- Verification: verified in code and tests

- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/controlPolicy.ts
- Kind: repo doc
- Retrieved: 2026-04-17
- Applied To: `TOKEN_DEPLOY_MUTATION` mutation classification for Clanker launches
- Verification: verified in code and tests

- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/executionGate.ts
- Kind: repo doc
- Retrieved: 2026-04-17
- Applied To: `confirmDeploy=true` confirmation-token gate
- Verification: verified in code and tests

- Source: /Users/almurat/KiKo/kiko-python/grok/router.py
- Kind: repo doc
- Retrieved: 2026-04-17
- Applied To: provider gateway hard mutation enforcement
- Verification: verified in code and syntax check

- Source: /Users/almurat/KiKo/kiko-api/src/services/clankerService.ts
- Kind: repo doc
- Retrieved: 2026-04-17
- Applied To: wrapped-native pair default and `maxLpFee` payload mapping
- Verification: verified in code and tests

- Source: clanker-sdk examples/v4/getTokenRewards.ts
- Kind: official SDK source
- Retrieved: 2026-04-15
- Applied To: reward index/admin/recipient interpretation
- Verification: partially verified in local SDK exports

- Source: clanker-sdk README and v4 schema
- Kind: local dependency evidence
- Retrieved: 2026-04-17
- Applied To: `devBuy.ethAmount` input shape, defaults, and optional creator
  buy overrides
- Verification: verified in local dependency exports

## See Also

- system-journal/INDEX.md
- system-journal/owner-map/clanker-skill.md
- system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
- system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
- system-journal/fix-log/2026-04-17-clanker-devbuy-and-token-url.md
