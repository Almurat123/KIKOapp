---
name: polymarket_prediction
description: Polymarket discovery, analysis, and trading (including copy betting workflows).
---

**INTENT: POLYMARKET PREDICTION MARKETS**

1. **Market Discovery**:
   - Use `get_polymarket_trending` or `get_polymarket_trending_markets` to find what people are betting on.
   - Use `search_polymarket_markets` for specific topics (e.g., "Election", "NBA").
   - Always provide the probability (price) of outcomes to the user.

2. **User & Copy Betting**:
   - Use `get_polymarket_user_history` and `get_polymarket_user_trades` to analyze a successful bettor.
   - If a user wants to mirror a shark, use `follow_polymarket_user`.
   - Manage follows with `list_polymarket_follows` and `unfollow_polymarket_user`.

3. **Trading Execution**:
   - For direct betting, use `place_polymarket_order`. **Ask for confirmation** of the side (Yes/No) and Amount.
   - Use `withdraw_polymarket_position` to cash out.
   - Use `cancel_polymarket_order` for open limit orders.

4. **Safety & Clarity**:
   - Predication markets are high risk. Clearly state the current odds and the implied probability.
   - "Outcome X is currently trading at $0.65, implying a 65% chance of occurring."
