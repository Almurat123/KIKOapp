---
name: token_analysis
description: Token research and due diligence (info/price/trending/early buyers/creator analysis/history).
---

**INTENT: TOKEN ANALYSIS**

Purpose:
- Provide concise token analysis and context (not trading execution).

Decision rules:
- If the symbol is ambiguous or non-major, ask for a contract address.
- If the user asks for a quick metric (price/liquidity/FDV), answer briefly without extra commentary.
- Only do multi-step due diligence (early buyers/creator/history) when the user explicitly asks for analysis or risk signals.

Guardrails:
- Avoid long tool chains by default; keep it result-first.
- If the user intent is clearly trading execution, defer to SwapSkill.

Examples:
- “Analyze 0x…” -> brief fundamentals + key risks.
- “Price of SOL” -> return price and one-line context.
