# Owner Map: Clanker Skill

Updated: 2026-04-19
Author: Renata

## Owners

- `kiko-api/src/services/clankerService.ts` owns Clanker API URLs, API-key
  request construction, deployment payload normalization, documented chain
  allowlists, token page URL synthesis, v4 locker reward reads, and unsigned
  claim transaction prep.
- `kiko-api/src/skills/ClankerSkill/tools/clankerTools.ts` owns agent-facing
  tool schemas and result shaping.
- `kiko-api/src/jobs/chat/skillIntentMatcher.ts` owns the Clanker deploy query
  signal and the skill-scoring path that makes the launch prompt visible.
- `kiko-api/src/jobs/chat/canonicalIntent.ts` and
  `kiko-api/src/jobs/chat/canonicalIntentNormalizer.ts` own the
  `clanker_deploy` canonical intent schema and normalization prompt contract.
- `kiko-api/src/jobs/chat/nodeSkillResolver.ts` owns the `token_deploy`
  intent envelope that tells policy a launch is a mutation workflow.
- `kiko-api/src/jobs/chat/controlPolicy.ts` owns the
  `TOKEN_DEPLOY_MUTATION` action class and Clanker deploy mutation allowlist.
- `kiko-api/src/jobs/chat/executionGate.ts` owns the `confirmDeploy=true`
  confirmation-token gate for real deploy execution.
- `kiko-api/src/jobs/chat/conversationStateResolver.ts` owns turning Clanker
  dry-run previews into reusable confirmation state and preserving the
  `TOKEN_DEPLOY_MUTATION` action class.
- `kiko-api/src/jobs/chat/workerStateBuilder.ts` owns replaying the prepared
  Clanker launch payload on the execute handoff and rebuilding the binding
  token from the normalized execute args.
- `kiko-api/src/jobs/chat/nodePromptAssembler.ts` owns surfacing pending
  Clanker deploy confirmation payloads in worker memory so the model can help
  confirm them.
- `kiko-python/grok/router.py` owns Grok gateway enforcement that keeps
  `TOKEN_DEPLOY_MUTATION` node-controlled and prevents extra SDK tool exposure.
- `kiko-api/src/skills_exec/ClankerSkill/skill.json` and
  `kiko-api/src/skills_exec/ClankerSkill/prompt.exec.md` own the visible
  Clanker skill entry, launch overview, ethAmount-first creator-buy phrasing,
  and dry-run-first prompt guidance.
- `kiko-api/src/tooling/bootstrap.ts` owns explicit registration of Clanker
  tools in the built-in registry.

## Non-Owners

- The Clanker skill does not own user wallet signing or transaction submission.
- The Clanker skill does not generate token art; it accepts image URLs or IPFS
  URIs supplied by an upstream flow.
- The Clanker skill does not persist a KiKo-local deployment ledger yet.
- The Clanker skill does not treat Clanker beta claimed-fee indexing as
  complete lifetime accounting.
- The Clanker skill does not own the local `confirmDeploy` execution flag; that
  flag is replayed only at the worker execute handoff.
- The Clanker skill hard-requires name and symbol for payload preparation.
  Admin is only a blocking question when runtime cannot provide a tagged user
  wallet, and chain is only blocking when a user-requested non-default chain is
  ambiguous.
- The Clanker skill defaults to a single 100% reward recipient, standard pool,
  wrapped-native pair asset address, and fixed fees unless the user asks for more.
  Dynamic deploy payloads use `maxLpFee`; `maxFee` remains an input alias only.
- Creator buy / dev buy is optional and follows the SDK `devBuy` shape, with
  `ethAmount` as the common path and optional `poolKey`, `amountOutMin`, and
  `recipient` overrides only when the user explicitly asks for them.
- Simple phrases like `buy me 0.1 ETH/BNB` should be treated as an
  ethAmount-only creator buy unless the user explicitly wants a custom route.
- `context` is chain-neutral provenance metadata and must not be used to infer
  deploy-chain behavior.
- Successful deploys should return the Clanker token page URL when the API
  returns a token address.

## Document Provenance

- Source: Clanker Documentation, Deploy Token (v4.0.0)
- Kind: official API doc
- Retrieved: 2026-04-17
- Applied To: service/tool ownership split for deploy payload construction,
  pair defaults, dynamic fee naming, dev buy handling, and token URL synthesis
- Verification: verified in docs and code

- Source: Clanker Documentation, Token Deployments
- Kind: official API doc
- Retrieved: 2026-04-17
- Applied To: creator buy / dev buy handling
- Verification: verified in docs

- Source: Clanker Documentation, Get Token by Address
- Kind: official API doc
- Retrieved: 2026-04-17
- Applied To: clanker.world token page URL synthesis
- Verification: verified in docs

- Source: Clanker SDK README and local `clanker-sdk` package exports
- Kind: official SDK source / local dependency evidence
- Retrieved: 2026-04-17
- Applied To: SDK claim transaction and v4 locker reward-read boundaries
- Verification: partially verified in local SDK exports

- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/skillIntentMatcher.ts
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: Clanker deploy routing and prompt visibility
  - Verification: verified in code and tests
- Source: /Users/almurat/KiKo/kiko-api/src/skills_exec/ClankerSkill/prompt.exec.md
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: visible launch prompt wording and creator-buy phrasing
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-api/src/skills_exec/ClankerSkill/skill.json
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: skill visibility examples for simple creator-buy launch phrasing
  - Verification: verified in code
- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/controlPolicy.ts
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: `TOKEN_DEPLOY_MUTATION` action-class ownership
  - Verification: verified in code and tests
- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/executionGate.ts
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: `confirmDeploy=true` confirmation-token gate
  - Verification: verified in code and tests
- Source: /Users/almurat/KiKo/kiko-python/grok/router.py
  - Kind: repo doc
  - Retrieved: 2026-04-17
  - Applied To: Grok gateway mutation-class enforcement
  - Verification: verified in code and syntax check

- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/conversationStateResolver.ts
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: Clanker dry-run preview confirmation reconstruction
  - Verification: verified in code and tests

- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/workerStateBuilder.ts
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: Clanker execute-handoff binding replay
  - Verification: verified in code and tests

- Source: /Users/almurat/KiKo/kiko-api/src/jobs/chat/nodePromptAssembler.ts
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: pending Clanker deploy payload visibility in prompt memory
  - Verification: verified in code and tests

## See Also

- system-journal/INDEX.md
- system-journal/design-language/clanker-token-deploy-skill.md
- system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
- system-journal/fix-log/2026-04-17-clanker-deploy-skill-route-and-payload-fix.md
- system-journal/fix-log/2026-04-19-clanker-dry-run-confirmation-continuity.md
- system-journal/fix-log/2026-04-17-clanker-devbuy-and-token-url.md
