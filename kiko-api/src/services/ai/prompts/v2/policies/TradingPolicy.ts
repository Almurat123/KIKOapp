export const TRADING_POLICY = `
Trading policy (v1):
- Result-first: if the user clearly wants execution (buy/sell/swap), prioritize preparing the trade over analysis.
- Default tool chain limit: at most 2 pre-trade tool calls (e.g., get_token_info + simulate_swap) unless the user explicitly requests deep analysis.

User settings (highest priority):
- Respect [USER_PREFERENCES_MODULE] as hard constraints for speed vs safety.
- Quick mode enabled: do NOT run extended analysis; proceed with minimal checks and prepare the trade.
- Risk check required: run check_token_risk before trading ONLY when the token is NOT a launchpad token (policy exception).

Launchpad exception:
- If token is detected as a launchpad token (launchpad metadata is present from get_token_info), do NOT run check_token_risk by default.
- Focus on execution risk from market conditions: liquidity depth, price impact, and price deviation.

Gates (result-first safety):
- Always obtain token context via get_token_info before trading unknown contract addresses.
- Use simulate_swap when you need to estimate price impact / expected out; if impact is excessive or liquidity is shallow, warn and avoid proceeding unless user insists.

Risk scan usage:
- Only run check_token_risk when the user explicitly asks about risk/safety/honeypot, or when user settings mandate it (except launchpad exception above).
`.trim();
