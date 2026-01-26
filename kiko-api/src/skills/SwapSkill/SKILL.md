---
name: swap
description: Exchange tokens on DEX (Base/Ethereum/Solana/BSC) with safe, tool-first workflows.
---

**INTENT: TRADING EXECUTION (SwapSkill)**

Purpose:
- Execute swaps when the user clearly intends to trade.
- Default to “result-first” execution, not long analysis.
- NEVER ask for wallet address - it is ALREADY provided in [CONTEXT] section. Use it directly.

Primary tools:
- `prepare_swap_transaction` (prepare or execute depending on user settings/tool behavior; follow tool output)
- `simulate_swap` (execution risk estimate only; do not execute)
- `get_token_info` (resolve contract metadata + launchpad detection)
- `check_token_risk` (only when required by user/settings; see rules)
- `get_wallet_info` (fresh balances for "all/max" - do NOT pass address, it uses context automatically)

Tool input contracts (use only these parameters):
- `prepare_swap_transaction`: `token_in`, `token_out`, `amount_in`, `chain_id`, optional `slippage`, `execute` (CRITICAL - set true for allowance_trade mode)
- `simulate_swap`: `token_in`, `token_out`, `amount_in`, `chain_id`, optional `slippage`.
- `get_token_info`: `address`, `chain`.
- `check_token_risk`: `address`, optional `chain`.
- `get_wallet_info`: optional `address`, optional `chain`, optional `includeHistory`.

Tool output contracts (do not guess fields):
- `prepare_swap_transaction` returns one of:
  - Prepared confirmation: `mode="prepared"`, `requires_user_confirmation=true`, `__client_action.type="show_swap_card"`.
  - Client-side instant execute fallback: `mode="execute_client"`, `__client_action.type="execute_swap_instant"` (no tx hash yet).
  - Executed: `mode="executed"`, `success=true`, `txHash` present.
  - Error: `mode="error"` with `error`.
- `simulate_swap` returns: `expected_out_human`, `price_impact_pct` (number), `is_safe`, optional `warning`.
- `get_token_info` returns normalized aliases: `tokenSymbol`, `tokenName`, `priceUsd`, `liquidityUsd`, `fdvUsd`, `volume24hUsd`, plus `launchpad` and `isLaunchpad`.
- `get_wallet_info` returns: `ethBalance` (string) and `tokens[]` with `symbol` + `balance` (use exact string as amount).

Decision rules:
- Respect `[USER_PREFERENCES_MODULE]` as hard constraints (quick vs safe, slippage, default amount, swap method).
- For allowance_trade mode: Always set execute=true in prepare_swap_transaction.
- If token + amount are clear, prepare the trade directly.
- If token is clear but amount is missing, ask exactly one question for amount unless user settings provide a default.
- If the user provides only a non-major symbol without a contract address, ask for the contract address (avoid guessing).

Guardrails:- NEVER ask for wallet address - it is already provided in [CONTEXT]. Use tools directly without asking.- Do not start multi-step analysis unless the user asked for analysis.
- Do not repeatedly call tools “one-by-one”; keep the pre-trade tool chain minimal.
- Only run a risk scan when the user explicitly asks about risk/safety, or when user settings mandate it (launchpad tokens are typically exempt).
- One-question rule: if something is missing, ask exactly one key question, then wait.
- No-loop rule: avoid repeated `get_token_info` / `simulate_swap` calls for the same token+amount.

Red alert thresholds (raise caution / ask for confirmation):
- If `simulate_swap.price_impact_pct` >= 10, warn and ask whether to proceed.
- If `simulate_swap.expected_out_human` is `0` or empty, stop and ask to recheck token/amount.
- If `get_token_info.liquidityUsd` is extremely low (< 1000), warn strongly (even if quick mode).
- Never claim execution unless `prepare_swap_transaction` returns `mode="executed"` or a `txHash`.

Examples:
- “Swap 100 USDC to ETH” -> prepare trade.
- “Buy 0x…” -> use default amount if configured; otherwise ask amount.
- “Buy PEPE” -> ask for contract address.
