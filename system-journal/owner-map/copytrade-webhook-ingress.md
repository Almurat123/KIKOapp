# Owner Map: Copytrade Webhook Ingress

Updated: 2026-04-13

## Owns

- Receiving address-activity webhook signals and `/process-tx` ingress requests
- Collecting tx, receipt, activity, and pending-hint evidence for a tx identity
- Narrow candidate-wallet recovery for explicit relayer calldata cases
- Writing temporary ingress markers and scheduling recovery when evidence is incomplete
- Fast-dispatching already-decoded target swaps into copytrade runtime work

## Does Not Own

- Durable target-sell truth
- Buy-confirmation truth
- Canonical order truth
- Exit-intent scheduling
- Final mirror-sell execution success

## Boundary Rule

`webhook.ts` is an evidence-entry layer. It may dispatch a decoded target swap
into runtime handling, but it must not become a second durable truth store for
target sells or buy confirmation.

If evidence is weak or incomplete, ingress must prefer recovery over broad live
attribution.

## Durable Handoff Rule

- Observed target buys continue through the existing buy confirmation path.
- Observed target sells become durable only after runtime target-sell handling
  persists them into `targetSellEventStore`.
- Exit work must be released from durable sell facts and exit-intent owners, not
  from ingress memory alone.

## Practical Consequence

- `tx.from` remains the first-pass EVM owner signal.
- Explicit calldata wallet recovery is allowed only as a narrow relayer repair.
- `copyTradeIngressState` and `copyTradeTxStateService` are temporary
  coordination memory, not business truth.
- `dispatchCopyTradeIfReady` is an enqueue gate, not a semantic attribution
  layer.

## Owned Files

- `kiko-api/src/routes/webhook.ts`
- `kiko-api/src/services/copytrade-v2/ingress/copyTradeFastDispatcher.ts`
- `kiko-api/src/services/copytrade-v2/ingress/copyTradeIngressState.ts`
- `kiko-api/src/services/copyTradeTxStateService.ts`

## Downstream Durable Owners

- `kiko-api/src/services/copytrade-v2/runtime/legacyCopytradeBuyRuntime.ts`
- `kiko-api/src/services/copytrade-v2/exit/targetSellEventStore.ts`
- `kiko-api/src/services/copytrade-v2/exit/positionExitIntentScheduler.ts`
- `kiko-api/src/services/copytrade-v2/exit/positionExitIntentWorker.ts`

## Document Provenance

- Source: `system-journal/design-language/copytrade-race-recovery.md`
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: preserving the race-safe split between ingress memory and durable
  sell replay
- Verification: verified in code

- Source: `/Users/almurat/Downloads/logs.1776050120896.json`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: relayer sell regression that proved webhook cannot be treated as
  final durable truth
- Verification: verified in runtime
