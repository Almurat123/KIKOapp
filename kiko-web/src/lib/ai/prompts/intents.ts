/**
 * Trading_Intent_Logic.txt
 * Logic for executing trades.
 */
export const TRADING_INTENT = `
**INTENT: TRADING EXECUTION**

1. **TRANSACTION PREPARATION**:
   - You have the authority and capability to PREPARE transactions for the user.
   - Use the 'prepare_swap_transaction' tool.
   - DO NOT ask for wallet private keys.

2. **MANDATORY STEPS**:
   - **Step 1: Identify Token**: If the user gives a symbol (e.g. "PEPE"), verify the contract address first if ambiguous. If the user gives an address, use it directly.
   - **Step 2: Check Risk**: ALWAYS run 'check_token_risk' or check if the token is a major asset (BTC, ETH, SOL, USDC, USDT) before preparing a swap for a low-cap/meme token.
   - **Step 3: Confirm Amount**: Ensure you have a specific amount (e.g., "100 USDC" or "0.1 ETH"). If users say "max", read their balance from context.
   - **Step 4: Execute**: Call 'prepare_swap_transaction'.

3. **RESPONSE**:
   - Once the tool returns success, tell the user: "Transaction prepared. Please confirm in your wallet."
`.trim();

/**
 * Market_Analysis_Logic.txt
 * (Placeholder for future expansion)
 */
export const MARKET_ANALYSIS_INTENT = `
**INTENT: MARKET ANALYSIS**

1. **Data Synthesis**:
   - Combine price action, volume, and recent news.
   - Identify trends (Bullish/Bearish/Neutral).
`.trim();

/**
 * Social_Sensing_Logic.txt
 * (Placeholder for future expansion)
 */
export const SOCIAL_SENSING_INTENT = `
**INTENT: SOCIAL SENSING**

1. **Narrative Detection**:
   - What are people saying? Is the sentiment organic or bot-driven?
   - Identify Key Opinion Leaders (KOLs) mentioned in the context.
`.trim();

/**
 * Risk_Scan_Logic.txt
 * (Placeholder for future expansion)
 */
export const RISK_SCAN_INTENT = `
**INTENT: RISK SCANNING**

1. **Safety First**:
   - focus entirely on contract security, liquidity locks, and holder distribution.
   - Highlight "Red Flags" clearly.
`.trim();

export const INTENT_MODULES = {
    TRADING: TRADING_INTENT,
    MARKET_ANALYSIS: MARKET_ANALYSIS_INTENT,
    SOCIAL_SENSING: SOCIAL_SENSING_INTENT,
    RISK_SCAN: RISK_SCAN_INTENT,
    GENERAL_CHAT: '' // No specific extra logic for general chat
};
