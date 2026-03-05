# Copytrade ETH/BSC Rollout Checklist (No Auto-Pause)

## Scope
- Apply to ETH first, then BSC.
- No automatic pause is allowed.
- Any incident response is manual and explicit.

## Rollout Stages
1. Stage A: 5% traffic for 30-60 minutes.
2. Stage B: 25% traffic for 30-60 minutes.
3. Stage C: 100% traffic after all gates pass.

## Promotion Gates
- `signal_wallet_mismatch` remains `0`.
- `open mirror_sell positions age>10m` is non-increasing and trends to `0`.
- `exit_confirmation_unresolved_retry` does not spike abnormally.
- Incident replay output from `diagnose:copytrade-signal-mapping` has 100% source consistency for the sampled window.

## Required Commands
```bash
npm run diagnose:copytrade-signal-mapping -- --chains 1 --from 2026-03-05T00:00:00Z --to 2026-03-05T01:00:00Z --limit 500
npm run diagnose:copytrade-signal-mapping -- --chains 56 --from 2026-03-05T00:00:00Z --to 2026-03-05T01:00:00Z --limit 500
```

## Solana Forensics Window
- Keep trading logic unchanged during forensics.
- Collect at least 7 days of `solana_target_resolution_observed` logs.
- Summarize with:
```bash
npm run diagnose:solana-target-resolution -- --log /path/to/app.log
```
