# CopyTrade V2 Hotfix Runbook

## Runtime Switches

- Global Freeze: `COPYTRADE_V2_GLOBAL_FREEZE=true`
- Exit Only Mode: `COPYTRADE_V2_EXIT_ONLY=true`
- Force Mode: `COPYTRADE_V2_FORCE_MODE=turbo|normal|safety`

## Recommended Incident Sequence

1. Set `COPYTRADE_V2_GLOBAL_FREEZE=true` to stop all new orders.
2. If buy path is unhealthy but exits must continue:
   - `COPYTRADE_V2_GLOBAL_FREEZE=false`
   - `COPYTRADE_V2_EXIT_ONLY=true`
3. Reduce aggressiveness globally:
   - `COPYTRADE_V2_FORCE_MODE=normal` or `COPYTRADE_V2_FORCE_MODE=safety`
4. After hotfix validation, clear temporary controls:
   - `COPYTRADE_V2_EXIT_ONLY=false`
   - `COPYTRADE_V2_FORCE_MODE=` (empty)

## Validation Checklist

- New ingress logs include `[CopyTradeV2] ingress blocked by runtime controls` when switch is active.
- `/api/copy-trade/v2/orders` still returns historical data while freeze is active.
- No unexpected spike in `FAILED_TERMINAL` after switching to `safety` mode.
