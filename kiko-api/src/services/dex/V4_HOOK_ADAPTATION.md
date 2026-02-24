# V4 Hook Adaptation Guide

This project supports fast adaptation for new Uniswap v4 hook families without code redeploy.

## Runtime Registry

Use env var `DIRECT_SWAP_V4_HOOK_PROFILES_JSON`:

```json
{
  "8453": {
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": {
      "family": "custom",
      "requiresWalletAddress": false,
      "quoteHookData": ["0x"],
      "executeHookData": ["0x"]
    }
  }
}
```

## Profile Fields

- `family`: `none | clanker | zora | doppler | flaunch | custom | unknown`
- `requiresWalletAddress`: whether hook data depends on user wallet
- `quoteHookData`: candidate list used by quoter
- `executeHookData`: candidate list used by execution

## Built-in Flaunch Support

- Base built-in flaunch position manager hooks are pre-registered.
- For flaunch hooks, runtime candidates include:
  - `abi.encode(address(DIRECT_SWAP_FLAUNCH_REFERRER_ADDRESS))` when provided
  - `abi.encode(address(0))`
  - `0x`
- Optional env:
  - `DIRECT_SWAP_FLAUNCH_REFERRER_ADDRESS=0x...`

## Execution Behavior

- Direct swap resolves hook profile by `PoolKey.hooks`.
- Quoter tries hook data candidates and selects best output.
- Pre-sim uses selected candidate and can retry remaining candidates before failing.
- Unknown hooks fail with structured error prefix:
  - `unsupported_hook:*`
  - `hook_candidate_failed:*`

## Where to Change

- Registry + resolution: `src/services/dex/v4Hooks.ts`
- Execution plan: `src/services/dex/v4ExecutionPlan.ts`
- V4 quote/execute flow: `src/services/dex/directSwapService.ts`
- V4 pool discovery known hooks: `src/services/dex/uniswapV4.ts`
