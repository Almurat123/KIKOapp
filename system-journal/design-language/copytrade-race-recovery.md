# Design Language: Copytrade Race Recovery

Updated: 2026-04-10

## Problem Shape

Copytrade buy confirmation and target-sell detection do not arrive in one stable
order. A production-safe design must treat these as racing signals, not as one
linear happy path.

## Canonical Rules

- Buy confirmation is the owner boundary that converts pending exposure into
  durable open exposure.
- Webhook ingress is an evidence-entry layer; it may accelerate runtime
  handling, but it is not the durable truth owner for target sells.
- Target-sell detection must be durable before it is actionable. Webhook memory
  alone is insufficient.
- If a target sell was already durably recorded, buy confirmation must replay it
  into exit scheduling before leaving the position in the open monitor pool.
- Replay must be bounded to the active buy lifecycle window so stale sells are
  not reused for unrelated buys.
- Order state may say `EXIT_ARMED` only when durable exit work exists or has
  been explicitly re-released.

## Forbidden Patch Patterns

- Do not rely on TP/SL monitor warnings as a recovery mechanism.
- Do not mark a position or order as "armed" without an exit intent or durable
  replay path behind it.
- Do not trust only in-memory race state for copytrade sell preemption.
- Do not turn webhook ingress or ingress TTL state into a second durable truth
  system for target sells.

## Practical Consequence

For buy-confirmation code, the signal priority is:

1. Pending lot / active exit intent
2. Canonical order metadata
3. Durable historical target-sell event replay

If all three are absent, only then may the position remain in ordinary open
monitoring.
