# ADR: Model-Led Tool Orchestration

Date: 2026-04-19

## Decision

KiKo chat now uses model-led tool orchestration as the default path.

The main GPT model sees the registered tool catalog and decides whether to answer directly or call a tool. Backend skill and intent code remains as hints, context-contract generation, logging, and rollback support, not as the primary semantic gate for tool visibility.

## Reason

Runtime review showed that keyword and backend intent gates can incorrectly hide obvious tools from a stronger main model. Example: a user asking “Generate a screenshot of the instagram with a beautiful views” is plainly asking for an image deliverable, but a scoped router can fail before the model can call the image tool.

The target behavior is closer to ChatGPT-style tool use:

- The main model decides whether a request needs a tool.
- Image creation/editing requests can call `generate_image_from_intent` directly.
- Prompt optimization and generated-image task execution stay inside the image tool owner.
- Backend policy still owns side-effect safety, quota, billing, storage, confirmation, and mutation blocking.

## Architecture Boundary

- `modelLedToolOrchestration.ts` owns default model-led enablement and the full tool-name exposure helper.
- `nodeSkillResolver.ts` owns legacy scoped routing, strategy notes, preferred tools, and context contracts. In model-led mode it must not hide registered tools.
- `controlPolicy.ts` owns execution authorization. Tool visibility is not execution permission.
- `nodePromptAssembler.ts` owns model-facing instructions. In model-led mode it suppresses `TASK_MENU` and backend-style state-machine prompting.
- `chatV2TurnRunner.ts` and `nodeOrchestrator.ts` must not create fake pre-tool plan cards in model-led mode. Real tool execution and generated-image placeholders remain visible through their own owners.
- `kiko-python/orchestration/model_led_tool_orchestration.py`, `skill_resolver.py`, and `prompt_assembler.py` mirror the same visibility boundary for the Python generation path. Python may still prune side-effect execution through policy, but it must not hide registered tools on the default model-led path.

## Non-Goals

- This does not remove provider adapters or generated-image task infrastructure.
- This does not let the model bypass mutation confirmation, safety checks, quota, or billing.
- This does not remove Python orchestration; Python and Node both keep their own transport and policy owners, but each path must honor the same model-led visibility contract where it assembles prompts and tool lists.

## Document Provenance

- Source: operator architecture review in local runtime thread
- Kind: product instruction / runtime observation
- Retrieved: 2026-04-19
- Applied To: always-on model-led visibility, prompt mode, plan-card suppression
- Verification: verified in code and targeted tests

## Verification Targets

- Resolver output includes every registered tool, including `generate_image_from_intent`.
- `controlPolicy` includes all registered tools in `allowedTools`, but READ_ONLY still blocks mutation tools.
- `nodePromptAssembler` emits `[MODEL_LED_TOOL_ORCHESTRATION]` and omits `[TASK_MENU]`.
- Chat runtime skips synthetic warmup/model-plan cards before real tool use in model-led mode.
- Python orchestration emits the same model-led tool guidance block and exposes the full registered tool catalog by default.
