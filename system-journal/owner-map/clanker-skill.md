# Owner Map: Clanker Skill

Updated: 2026-04-15  
Author: Renata

## Owners

- `kiko-api/src/services/clankerService.ts` owns Clanker API URLs, API-key
  request construction, deployment payload normalization, documented chain
  allowlists, v4 locker reward reads, and unsigned claim transaction prep.
- `kiko-api/src/skills/ClankerSkill/tools/clankerTools.ts` owns agent-facing
  tool schemas and result shaping.
- `kiko-api/src/tooling/bootstrap.ts` owns explicit registration of Clanker
  tools in the built-in registry.

## Non-Owners

- The Clanker skill does not own user wallet signing or transaction submission.
- The Clanker skill does not generate token art; it accepts image URLs or IPFS
  URIs supplied by an upstream flow.
- The Clanker skill does not persist a KiKo-local deployment ledger yet.
- The Clanker skill does not treat Clanker beta claimed-fee indexing as
  complete lifetime accounting.
- The Clanker skill defaults to a single 100% reward recipient, standard pool,
  wrapped-native pair asset, and fixed fees unless the user asks for more.

## Document Provenance

- Source: Clanker Documentation, Deploy Token (v4.0.0)
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: service/tool ownership split for deploy payload construction
- Verification: verified in docs

- Source: Clanker SDK README and local `clanker-sdk` package exports
- Kind: official SDK source / local dependency evidence
- Retrieved: 2026-04-15
- Applied To: SDK claim transaction and v4 locker reward-read boundaries
- Verification: partially verified in local SDK exports

## See Also

- system-journal/INDEX.md
- system-journal/design-language/clanker-token-deploy-skill.md
- system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
