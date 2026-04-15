# 2026-04-16 Address Preclassification For Chat

## Summary

Literal addresses in chat were still too dependent on model interpretation. In
short Farcaster and copy-trade-adjacent turns, the same `0x...` string could be
routed as a token contract in one branch and as a wallet in another branch.
That made token-analysis requests unstable even after transport-wrapper cleanup.

## What Changed

- Added `requestedAddressClassifications` to `ChatContextSnapshot` so address
  type hints travel with the orchestration snapshot instead of living only in
  transient model reasoning.
- Added `addressEntityClassifier.ts` to enrich requested addresses before
  canonical intent normalization.
- Reused existing chain-aware checks instead of adding a second token detector:
  - EVM: `isErc20ContractAddress()` first, then `eth_getCode`
  - Solana: `getTokenInfo()` fast lookup
- Updated `canonicalIntentNormalizer.ts` so
  `requested_address_classifications` is sent to the model and explicitly
  outranks raw `0x...` / base58 shape when deciding wallet-vs-token intent.
- Updated `nodePromptAssembler.ts` so generation-phase `USER_CONTEXT` exposes
  the same classification summary to the response model.

## Why

The earlier Farcaster wrapper fix removed transport noise, but it did not solve
the deeper ambiguity that an address-shaped string does not identify itself.
When the user writes only an address or a very short ask, leaving the decision
to the model keeps routing unstable.

This fix moves the first classification step into deterministic code:

- token contract when existing token checks confirm it
- wallet when EVM code lookup proves it is an EOA
- generic contract when bytecode exists but token traits are absent
- unknown when confidence is not high enough

That keeps the model in a constrained interpretation space instead of forcing
it to infer entity type from wording alone.

## Document Provenance

- Source: production/runtime follow-up after Farcaster token-address misroutes
- Kind: runtime observation
- Retrieved: 2026-04-16
- Applied To: requested-address preclassification before canonical normalization
- Verification: verified in code and targeted tests

## Verification

Targeted tests added or updated:

- `src/jobs/chat/addressEntityClassifier.test.ts`
- `src/jobs/chat/canonicalIntentNormalizer.test.ts`
- `src/jobs/chat/nodePromptAssembler.test.ts`

Test intent:

- empty snapshots should keep address classifications empty
- normalization payload should forward structured address classifications
- generation prompt should expose the same classification summary in user context

## Owner Boundaries

- `contextAssembler.ts` still owns literal address extraction from the user turn.
- `addressEntityClassifier.ts` owns deterministic requested-address typing.
- `canonicalIntentNormalizer.ts` owns using those hints during routing.
- `nodePromptAssembler.ts` owns forwarding the same hints to the response model.
- Downstream trading or analysis owners must not silently reinterpret a
  `token_contract` hint as a wallet target without explicit user intent.
