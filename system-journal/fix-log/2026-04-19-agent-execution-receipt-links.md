# Fix Log: Agent Execution Receipt Links

Date: 2026-04-19
Author: Renata

## Requirement Change

Agent-mode replies for side-effecting tools must expose concrete receipts, not just
short success summaries. When tools submit or create something, the user should see
the exact hash, order id, config/rule id, token address, and product or explorer
URL that proves what happened.

## Applied Scope

- Swap execution results now include `txHash`, `txUrl`, and `explorerUrl`.
- Cross-chain execution results now include source-chain explorer URLs and LI.FI
  tracker URLs.
- Clanker deploy results now include `tokenAddress`, `tokenUrl`,
  `tokenExplorerUrl`, and deployment transaction URL fields when a hash is returned.
- Polymarket bet preparation now carries market links into order confirmation
  payloads.
- Polymarket order mutation tools now return order ids plus market URLs when
  available.
- Copy-trade and token-alert configuration receipts now include target/token
  URLs where the underlying chain or product URL is known.
- Chat worker state preserves receipt URL fields for follow-up turns.
- Chat orchestration now hooks successful side-effecting tool results and emits a
  deterministic receipt answer without asking the model to summarize the same
  result again.
- Skill prompts no longer carry repeated receipt-link wording; the prompt only
  selects and sequences tools, while the runtime hook owns receipt formatting.

## Document Provenance

- Source: operator requirement in local KiKo runtime thread
- Kind: product instruction / runtime observation
- Retrieved: 2026-04-19
- Applied To: Agent-mode final-answer receipt contract and tool result shaping
- Verification: verified in code and targeted tests

- Source: `/Users/almurat/KiKo/kiko-web/src/components/Chat/TransactionStatusCard.tsx`
- Kind: repo doc
- Retrieved: 2026-04-19
- Applied To: chain explorer URL base list for chat transaction cards
- Verification: verified in code

- Source: `/Users/almurat/KiKo/kiko-api/src/services/clankerService.ts`
- Kind: repo code
- Retrieved: 2026-04-19
- Applied To: Clanker token page URL behavior
- Verification: verified in code

## Owner Boundaries

- Tool implementations own returning concrete ids and URLs.
- Chat orchestration owns deterministic post-tool receipt formatting.
- Frontend transaction cards may still render richer UI, but the text answer must
  not depend on the card as the only place a user can find a receipt.
- No layer may fabricate missing URLs. Missing product or explorer links must be
  reported as unavailable.
- Prompt files must not reintroduce long receipt-link instructions when a
  structured tool result can be handled by the runtime hook.

## Verification Plan

- `npm run test:tools`
- `npx tsc --noEmit --pretty false`
- Targeted chat/tool and skill tests covering swap, cross-chain, Polymarket, and
  worker receipt state.
- `executionReceiptAnswer` unit tests for prompt-free receipt formatting.
