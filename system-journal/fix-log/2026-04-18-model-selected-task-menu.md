# 2026-04-18 Model-Selected Task Menu

## Requirement Change

Product owner correction: KiKo must not treat backend canonical intent as the
model-visible task decision. The model should see the available task modes and
choose one or more matching modes itself. Backend inference may still exist as
a safety, context, and tool-exposure envelope.

## Target Behavior

- The prompt exposes a `[TASK_MENU]` with lean chat, image chat, social thread,
  wallet read, token analysis, market research, swap quote, trade confirmation,
  token deploy, Polymarket, and meta-debug modes.
- The model is told that it owns task selection and should start from
  `lean_chat`, then add specialist modes only when needed.
- Multi-mode requests are valid. The model should keep a primary task plus
  supporting tasks instead of collapsing image, social, wallet, token, and
  execution work into one intent.
- `CONTEXT_CONTRACT` is framed as a safety/read gate, not as a selected intent.
- Backend resolver strategy notes no longer say `Structured intent:` to the
  model.
- New unnormalized turns bypass the separate LLM canonical normalizer by
  default and enter orchestration with `model_selected_task_menu` state.
- Backend trade confirmation and mutation gates remain enforced by server code.

## Owner Boundaries

- `kiko-api/src/jobs/chat/nodePromptAssembler.ts` owns model-visible task menu
  and prompt wording, including multi-mode selection rules.
- `kiko-api/src/jobs/chat/nodeSkillResolver.ts` owns backend tool exposure,
  context-read requirements, phase policy, and mutation safety.
- `kiko-api/src/jobs/chat/chatV2TurnRunner.ts` owns the default bypass from
  canonical normalization into model-selected task-menu orchestration.
- `kiko-api/src/jobs/chat/canonicalIntent.ts` owns the explicit
  `model_selected_task_menu` normalization-state marker.
- `kiko-api/src/jobs/chat/controlPolicy.ts` and execution tools still own hard
  mutation validation.

## Document Provenance

- Source: product owner correction in local runtime thread.
- Kind: product instruction / runtime observation.
- Retrieved: 2026-04-18.
- Applied To: model-owned, multi-mode task selection language in Node chat v2
  prompt.
- Verification: verified in code and targeted tests.

## Verification

- `nodePromptAssembler.test.ts` checks `[TASK_MENU]` appears and context
  contracts are safety/read gates, with one-or-more task selection wording.
- `nodeSkillResolver.test.ts` checks phase notes say model task selection is
  one-or-more from `TASK_MENU` and no longer expose `Structured intent:`.
- `chatV2TurnRunner.test.ts` checks unnormalized turns do not call
  `taskId:normalize` and do carry `model_selected_task_menu` with
  one-or-more cardinality.
