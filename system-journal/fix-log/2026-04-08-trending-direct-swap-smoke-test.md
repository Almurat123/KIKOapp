# Fix Log: Trending Direct Swap Smoke Test

Updated: 2026-04-08

## Problem

We needed a repeatable way to verify whether live hot-token discovery on
Ethereum, Base, BNB Chain, and Solana still resolves into executable direct-swap
paths without broadcasting real trades.

## What Changed

- Added `kiko-api/src/scripts/testTrendingDirectSwapSmoke.ts`.
- The script fetches the top 50 trending tokens for the four target networks.
- The script runs a bounded smoke sample through the direct-swap path.
- EVM chains use simulation mode and a local/forked wallet address.
- Solana validates quote and swap-transaction construction instead of broadcast.

## Target Behavior

- Read paths should stay read-only.
- The smoke test should report both successes and concrete failures.
- No code path in this harness should broadcast a production transaction.

## Notes

This is a validation harness, not a production routing change.

