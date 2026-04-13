# Fix Log: 2026-04-13 X Blue Verified Type Gate

## What Changed

- Updated X mention author verification to accept both:
  - legacy `verified=true`
  - modern `verified_type` values `blue`, `business`, or `government`
- Expanded mentions fetch author fields from:
  - `user.fields=username,verified`
  to:
  - `user.fields=username,verified,verified_type`
- Preserved `authorVerifiedType` on webhook mention payloads and recovery-path
  normalization so retries do not lose the modern verification signal.
- Updated mention skip logs to include `verifiedType` for operator debugging.

## Why

Production logs showed:

- webhook mention ingress succeeded
- mentions-feed confirmation succeeded after indexing delay
- mention processing still stopped with:
  - `[X] Mention skipped: author not verified`

Direct runtime inspection against the same blue-check account
`1920347546704097280` showed a field-shape inconsistency:

- `GET /2/users/{authorId}` with
  `user.fields=username,verified,verified_type,...`
  returned:
  - `verified=true`
  - `verified_type=blue`
- `GET /2/users/{botUserId}/mentions` with only
  `user.fields=username,verified`
  returned the same author in `includes.users` as:
  - `verified=false`
- the same mentions request, when expanded to include `verified_type`, returned:
  - `verified=true`
  - `verified_type=blue`

That means legacy `verified` alone is not a stable premium-blue gate for
mentions. The product must use `verified_type` as the canonical blue-check
signal.

## Product Rule

- Mention replies are allowed for authors with:
  - `verified=true`, or
  - `verified_type in {blue,business,government}`
- Blue-check gating must not depend on `verified` alone.

## Document Provenance

- Source: [Get mentions](https://docs.x.com/x-api/users/get-mentions)
- Kind: official API doc
- Retrieved: 2026-04-13
- Applied To: expanding `user.fields` for mention author verification metadata
- Verification: partially verified

- Source: [Get user by ID](https://docs.x.com/x-api/users/get-user-by-id)
- Kind: official API doc
- Retrieved: 2026-04-13
- Applied To: confirming modern user object verification metadata belongs in
  user lookup and should be treated as authoritative
- Verification: partially verified

- Source: direct runtime comparison of:
  - `/2/users/1920347546704097280?user.fields=username,verified,verified_type,...`
  - `/2/users/2038547191875211264/mentions?...&user.fields=username,verified`
  - `/2/users/2038547191875211264/mentions?...&user.fields=username,verified,verified_type`
- Kind: runtime observation
- Retrieved: 2026-04-13
- Applied To: proving blue-check users can be misclassified when mention fetches
  omit `verified_type`
- Verification: verified in runtime
