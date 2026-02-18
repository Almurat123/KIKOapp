# AutoTrade Knowledge Pack (Base + BSC)

This document is the operational knowledge baseline for validating and debugging copytrade/direct-swap logic.

## 1) Wallet-Centric Swap Semantics

- `tokenIn`: asset spent by the tracked wallet.
- `tokenOut`: asset received by the tracked wallet.
- Buy token (wallet perspective): `cash-like -> non-cash-like`.
- Sell token (wallet perspective): `non-cash-like -> cash-like`.
- Token-to-token: both sides non-cash-like.

Cash-like set per chain:
- Native alias: `0xeeee...`
- Wrapped native: Base `WETH`, BSC `WBNB`
- Stablecoins from chain config.

## 2) Transaction Truth Layers

### L1: On-chain state/RPC (highest truth)

Use RPC for:
- `eth_getTransactionByHash`
- `eth_getTransactionReceipt`
- `eth_call` (pool quote/simulation)
- `eth_getLogs` (when supported/stable)

Interpretation rules:
- Receipt/logs decide if swap actually happened.
- API quote availability (`liquidityAvailable=false`) does **not** prove no pool.

### L2: Route/quote providers

- 0x, Kyber for executable routes and calldata.
- Useful for fallback and reference pricing.
- Can fail under rate limits, token restrictions, tax/fee quirks, or temporary provider degradation.

### L3: Market discovery

- GeckoTerminal, DexScreener for discovery/ranking/trending.
- Great for token/pool universe building.
- Not sufficient alone for execution correctness.

## 3) DEX Family Decode Notes

- Uniswap/Pancake V2/V3: decode swap events plus transfer context.
- Uniswap V4: hook-aware interpretation needed.
- Aerodrome: router/transfer patterns differ from Uniswap.
- Pancake Infinity (BSC): dedicated quote/execute path and pre-sim behavior.

## 4) V4 Hook Realities

- V4 hooks can alter transfer and simulation behavior.
- Unknown hooks should not be silently treated as standard pools.
- Hook profile registry (`DIRECT_SWAP_V4_HOOK_PROFILES_JSON`) allows runtime adaptation.
- Failure classes to track: `unsupported_hook:*`, `hook_candidate_failed:*`.

## 5) Webhook vs Pending

- Webhook can arrive with grouped activity; tx dedup is mandatory.
- Pending predecode can accelerate decode but must reconcile with confirmed receipt.
- Missing receipt at webhook time should move to retry/recovery path, not hard-drop.

## 6) Common Failure Taxonomy

Use deterministic labels:
- `decode_missing`
- `direction_conflict`
- `pool_not_found`
- `reference_unavailable`
- `route_unavailable`
- `rpc_timeout`
- `rpc_rate_limited`
- `hook_unsupported`
- `simulation_revert`
- `queue_drop`
- `dedup_false_positive`

## 7) Chain-Specific Operational Caveats

### Base

- Public RPC quality varies under burst load.
- Fast-path should prioritize stable endpoints and strict timeout budgets.

### BSC

- Some public endpoints degrade on `eth_getLogs`/heavy queries.
- Infinity + V2/V3 fallback needs explicit diagnostics to avoid false "no pool".

## 8) Data Collection Strategy for Large Replay

Target order:
1. Gecko pool trades (primary tx hash source)
2. DexScreener pool universe enrichment
3. Free RPC enrichment (`tx/receipt`, optional logs)
4. Explorer fallback (BaseScan/BscScan/Etherscan V2)

## 9) Minimal Correctness Invariants

For each replayed tx:
- Must be classified into one outcome bucket.
- If failed, must contain stage + failure code + reason snippet.
- Must be traceable with `traceId` across webhook/decode/swap path.

## References

- [Uniswap v4 hooks guide](https://docs.uniswap.org/contracts/v4/guides/hooks/your-first-hook)
- [Uniswap v4 deployments](https://docs.uniswap.org/contracts/v4/deployments)
- [DexScreener API](https://docs.dexscreener.com/api/reference)
- [CoinGecko Onchain DEX API](https://docs.coingecko.com/reference/endpoint-overview)
- [GeckoTerminal API guide](https://apiguide.geckoterminal.com/getting-started)
- [Alchemy `alchemy_getAssetTransfers`](https://www.alchemy.com/docs/reference/alchemy-getassettransfers)
- [BNB Chain JSON-RPC endpoint notes](https://docs.bnbchain.org/bnb-smart-chain/developers/json_rpc/json-rpc-endpoint/)
