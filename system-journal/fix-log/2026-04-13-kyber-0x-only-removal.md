# Kyber 0x-Only Runtime Removal

Updated: 2026-04-13

## Summary

Kyber runtime usage was removed from the EVM swap stack. Quote selection, pricing
fallback, direct-swap reference quoting, approval preheating, and runtime router
registrations now use 0x only. Any `kyber` input is rejected with a hard error.

## Provenance

- Source: repository runtime audit of Kyber removal plan
- Kind: repo doc
- Retrieved: 2026-04-13
- Applied To: EVM quote selection, pricing fallback, and swap execution policy
- Verification: verified in code and static search

## Behavioural Boundaries

- 0x is the only EVM aggregator permitted in runtime code.
- Kyber provider files are deleted and must not be reintroduced without an owner
  review.
- `kyber` request inputs fail fast instead of being aliased.
- DirectSwap reference quotes only persist `0x` fields in cache.
- Legacy sell-quote preheat cache records are normalized on read so removed
  provider hints cannot re-enter execution.
- Swap-intent decode no longer depends on router brand-name mapping to decide
  whether a selector-backed transaction is decode-eligible.

## Verification

- Removed Kyber imports and call sites from pricing and quote selection layers.
- Deleted `kyberAggregator.ts` and `swap/providers/KyberProvider.ts`.
- Updated tests to assert 0x-only behavior.

## See Also

- [System Journal Index](../INDEX.md)
- [Backend Swap Validation Owner Map](../owner-map/backend-swap-validation.md)
- [Copytrade Native Balance Evidence](./2026-04-13-copytrade-native-balance-evidence.md)
- [Copytrade Turbo TokenInfo Bypass](./2026-04-13-copytrade-turbo-tokeninfo-bypass.md)
