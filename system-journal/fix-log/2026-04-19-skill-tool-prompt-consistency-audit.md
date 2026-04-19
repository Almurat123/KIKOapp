# 2026-04-19 Skill Tool Prompt Consistency Audit

## Summary

KiKo now has a working `npm run test:tools` audit that checks whether the
model-visible skill layer, prompt instructions, and runtime tool registry agree.

This pass also fixed several prompt-visible tool mismatches:

- registered `set_zora_notification_threshold`
- registered `show_polymarket_card`
- exposed `get_current_time` and `show_polymarket_card` to Polymarket skill routing
- exposed `switch_wallet_chain` to Swap skill routing
- documented `execute_swap` as an intentional legacy non-exposed tool instead
  of silently treating it as callable
- tightened thin prompt instructions for Zora, Farcaster, Market, Risk,
  CopyTrade, Swap, and Token Alert
- filled weak schema descriptions for Clanker, CrossChain, and swap simulation

## Why

The runtime could execute most tools, but the durable skill layer had drift:

- `npm run test:tools` referenced a missing script.
- `ZoraSkill/skill.json` referenced a threshold tool that was defined but not
  registered.
- `PolymarketSkill/prompt.md` instructed the model to call
  `show_polymarket_card`, but that tool was not exposed through the registry or
  skill metadata.
- Swap chain guard messages could direct a model toward `switch_wallet_chain`
  even though Swap skill routing did not expose it.
- Several prompts described capabilities only generically, leaving the model to
  infer exact tool choice from the generated tool block.
- A few model-facing parameter schemas were empty or too terse.

## Decision

Prompt-visible tools must be executable through the built-in registry, and
skill metadata must expose the tools that a skill prompt explicitly tells the
model to call.

The exception is legacy execution tooling. `execute_swap` remains intentionally
non-exposed because the current chat execution path should stay centralized on
`prepare_swap_transaction`, confirmation gates, and policy-controlled execution.
The test script records that exception explicitly so future audits do not
confuse it with accidental drift.

## Owner Boundaries

### Built-in registry

Owner:
- `kiko-api/src/tooling/bootstrap.ts`

Owns:
- explicit registration of built-in tools
- registration order for model-visible tools
- ensuring prompt-exposed tools are executable

Does not own:
- tool implementation
- permission enforcement
- routing policy

### Consistency audit

Owner:
- `kiko-api/src/scripts/testAllTools.ts`

Owns:
- checking raw `skill.json` references against registered tools
- checking prompt-mentioned tools against skill exposure and context-read tools
- detecting exported but unregistered tool definitions unless intentionally
  allowlisted
- checking exposed tool and parameter descriptions are useful enough for model
  filling

Does not own:
- live tool calls
- network/API availability
- real trading/deployment/image side effects

### Prompt layer

Owners:
- `kiko-api/src/skills_exec/*/prompt*.md`
- `kiko-api/src/skills_exec/*/skill.json`

Owns:
- model-facing tool sequencing rules
- skill-local safety and fallback instructions
- exact tool exposure for business skills

Does not own:
- runtime registration
- backend policy gates
- provider transport

## Verification

Verified with:

- `PYTHONPATH=kiko-python /tmp/kiko-pytest-venv/bin/python -m pytest kiko-python/tests -q`
- `npx tsx --test --test-force-exit src/jobs/chat/nodeSkillResolver.test.ts src/jobs/chat/toolExecutionEngine.test.ts src/jobs/chat/contextReadTools.test.ts src/jobs/chat/pythonGenerationClient.test.ts src/jobs/chat/chatV2ArchitectureSmoke.test.ts`
- `npx tsx --test --test-force-exit src/skills/TokenSkill/tools/tokenInfo.test.ts src/skills/TokenSkill/tools/tokenAnalysisTools.test.ts src/skills/SwapSkill/tools/prepareSwap.test.ts src/skills/SwapSkill/tools/chainExecutionGuard.test.ts src/skills/PolymarketSkill/tools/polymarketTools.test.ts src/skills/PolymarketSkill/tools/polymarketDirectTrading.test.ts src/skills/CopyTradeSkill/tools/copyTradeTools.test.ts src/skills/CrossChainSkill/crossChainTools.test.ts`
- `npm run test:tools`

## Document Provenance

- Source: local runtime audit on 2026-04-19 comparing `skills_exec`,
  `tooling/bootstrap.ts`, exported tool definitions, prompt tool mentions, and
  schema descriptions
  - Kind: runtime observation / test evidence
  - Retrieved: 2026-04-19
  - Applied To: tool registration, skill metadata exposure, prompt instructions,
    schema descriptions, and the new consistency script
  - Verification: verified in code and targeted tests
- Source: `/Users/almurat/KiKo/kiko-api/src/tooling/bootstrap.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: built-in registry ownership and explicit registration policy
  - Verification: verified in code
- Source: `/Users/almurat/KiKo/kiko-api/src/skills/SwapSkill/tools/executeSwap.ts`
  - Kind: repo doc
  - Retrieved: 2026-04-19
  - Applied To: classifying `execute_swap` as legacy non-exposed execution
    tooling rather than model-callable skill surface
  - Verification: verified in code and consistency audit allowlist

## See Also

- [System Journal Index](../INDEX.md)
- [2026-04-17 Chat V2 Context Read Tools](./2026-04-17-chat-v2-context-read-tools.md)
- [2026-04-18 Chat Work Protocol Refactor](./2026-04-18-chat-work-protocol-refactor.md)
- [2026-04-18 Chat V2 Model-Owned Image Generation Tool](./2026-04-18-chat-v2-model-owned-image-generation-tool.md)
