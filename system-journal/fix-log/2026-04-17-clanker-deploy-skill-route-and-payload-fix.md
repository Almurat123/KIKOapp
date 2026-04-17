# 2026-04-17 Clanker Deploy Skill Route And Payload Fix

## What Changed

- Added a visible `skills_exec/ClankerSkill` entry with its own prompt so the
  model can read a dedicated Clanker deploy overview before using the deploy
  tool.
- Added a Clanker deploy query signal in
  `/Users/almurat/KiKo/kiko-api/src/jobs/chat/skillIntentMatcher.ts` so deploy,
  launch, and Clanker history requests route to the Clanker skill
  deterministically.
- Updated
  `/Users/almurat/KiKo/kiko-api/src/services/clankerService.ts` so the default
  pool pair resolves to the chain wrapped-native address and dynamic fee
  payloads use `maxLpFee`.
- Updated the Clanker tool schema and skill prompt to describe the correct
  launch defaults and confirmation flow.
- Added `clanker_deploy` to the canonical intent schema and normalization
  prompt so deploy turns are not treated as generic token analysis.
- Added a `token_deploy` resolver envelope and `TOKEN_DEPLOY_MUTATION` control
  policy action class for real Clanker launch execution.
- Updated the execution gate so `deploy_clanker_token` dry-runs do not require
  confirmation, but `confirmDeploy=true` requires an execution confirmation
  token.
- Updated the Grok Python gateway so `TOKEN_DEPLOY_MUTATION` is treated as a
  hard node-controlled mutation class, matching swap/order policy handling.
- Tightened the Clanker prompt so only hard missing requirements block launch
  preparation; image, description, reward split, pool, fees, and creator buy
  remain optional/defaultable.

## Why

Before this change, Clanker was effectively tool-only in the main route, so the
model could miss the deploy guidance entirely. The deploy payload also still
defaulted to a literal `WETH` label and used the legacy `maxFee` field name in
the outgoing HTTP body.

That left two failure modes:

- the model could talk about deploys without seeing the dedicated Clanker
  launch prompt
- the service could build a payload that did not match the documented Clanker
  deploy contract shape

## Product Rule

- Clanker launch requests must resolve to the dedicated Clanker skill before a
  real deploy.
- Dry-run output is the default; real deployment remains opt-in behind
  `confirmDeploy=true`.
- `confirmDeploy=true` must pass the central execution gate under
  `TOKEN_DEPLOY_MUTATION`; prompt-only safety text is not enough.
- Launch preparation should only ask for name and symbol as hard missing
  fields. Admin and chain are conditional, and optional/defaultable launch
  fields should not trigger broad multi-field clarification loops.
- The default pair asset should be the chain wrapped-native address, not the
  literal `WETH` string.
- Dynamic fee payloads must emit `maxLpFee`; `maxFee` survives only as a tool
  input alias.

## Verification

- Verified in code that `skillIntentMatcher.ts` now scores Clanker deploy
  queries onto `clanker_deploy_token`.
- Verified in code that `clankerService.ts` now resolves the wrapped-native
  pair address from local `WETH_ADDRESSES` exports and emits `maxLpFee` in the
  dynamic payload.
- Verified in tests that the Clanker deploy skill appears in the trading
  system prompt and that a dry-run deploy payload uses the chain wrapped-native
  address and `maxLpFee`.
- Added targeted tests for canonical `clanker_deploy`, token deploy resolver
  envelope, policy action-class promotion, execution-gate confirmation, and
  confirmation-state action-class preservation.

## Document Provenance

- Source: `/Users/almurat/KiKo/kiko-api/src/skills_exec/ClankerSkill/prompt.exec.md`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: visible Clanker launch overview and confirmation rules
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/skillIntentMatcher.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: launch-query routing and skill scoring
  - Verification: verified in code and tests
- Source: `/Users/almurat/KiKo/kiko-api/src/services/clankerService.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: wrapped-native default pair and `maxLpFee` payload mapping
  - Verification: verified in code and tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/canonicalIntent.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: `clanker_deploy` canonical intent schema
  - Verification: verified in code and tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/controlPolicy.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: `TOKEN_DEPLOY_MUTATION` mutation action class
  - Verification: verified in code and tests
- Source: `/Users/almurat/KiKo/kiko-api/src/jobs/chat/executionGate.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: `confirmDeploy=true` execution confirmation gate
  - Verification: verified in code and tests
- Source: `/Users/almurat/KiKo/kiko-python/grok/router.py`
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: Grok gateway hard mutation handling for `TOKEN_DEPLOY_MUTATION`
  - Verification: verified in code and syntax check
- Source: Clanker Documentation, Deploy Token (v4.0.0)
  - Kind: official API doc
  - Retrieved: 2026-04-17
  - Applied To: deploy payload shape and confirmation flow
  - Verification: verified in docs
- Source: clanker-sdk local package exports
  - Kind: local dependency evidence
  - Retrieved: 2026-04-17
  - Applied To: wrapped-native asset defaults and fee compatibility
  - Verification: verified in local exports

## See Also

- /Users/almurat/KiKo/system-journal/INDEX.md
- /Users/almurat/KiKo/system-journal/design-language/clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/owner-map/clanker-skill.md
- /Users/almurat/KiKo/system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
- /Users/almurat/KiKo/system-journal/conflicts.md
