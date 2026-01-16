---
name: swap
description: Exchange tokens on DEX (Base/Ethereum/Solana/BSC) with safe, tool-first workflows.
---

**INTENT: TRADING EXECUTION (SwapSkill)**

Purpose:
- Execute swaps when the user clearly intends to trade.
- Default to “result-first” execution, not long analysis.

Decision rules:
- Respect `[USER_PREFERENCES_MODULE]` as hard constraints (quick vs safe, slippage, default amount, swap method).
- If token + amount are clear, prepare the trade directly.
- If token is clear but amount is missing, ask exactly one question for amount unless user settings provide a default.
- If the user provides only a non-major symbol without a contract address, ask for the contract address (avoid guessing).

Guardrails:
- Do not start multi-step analysis unless the user asked for analysis.
- Do not repeatedly call tools “one-by-one”; keep the pre-trade tool chain minimal.
- Only run a risk scan when the user explicitly asks about risk/safety, or when user settings mandate it (launchpad tokens are typically exempt).

Examples:
- “Swap 100 USDC to ETH” -> prepare trade.
- “Buy 0x…” -> use default amount if configured; otherwise ask amount.
- “Buy PEPE” -> ask for contract address.
