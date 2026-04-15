# ADR: Clanker Token Deploy Skill

Date: 2026-04-15  
Author: Renata

## Decision

Add a new `ClankerSkill` with five read/prepare tools and one write-capable
deployment tool:

- `deploy_clanker_token`
- `get_clanker_tokens_by_admin`
- `get_clanker_tokens_deployed_by_address`
- `get_clanker_claimed_fees`
- `get_clanker_token_rewards`
- `prepare_clanker_claim_rewards`

The write-capable deploy tool dry-runs by default. Real Clanker API submission
requires `confirmDeploy=true`.

The default deploy UX collapses to one recipient at 100%, a standard pool
paired with the wrapped native asset for the selected chain, and fixed fees at
1% / 1%. Dynamic fee presets remain available for explicit requests.

## Rationale

Token launch, deploy history, admin ownership, reward recipients, and claimed
fees are related but different operations. Keeping them as separate tools lets
the agent answer search-style prompts without touching deploy state, while still
supporting a launch flow when the user explicitly confirms.

## Consequences

- `CLANKER_API_KEY` is required for authenticated Clanker API calls.
- `CLANKER_RPC_URL` is optional for on-chain reward reads; otherwise viem's
  chain transport defaults are used.
- Claiming rewards is not executed server-side. The tool returns an unsigned
  transaction configuration for wallet signing.
- Claimed-fee analytics must be shown with the Clanker beta/indexing caveat.

## Document Provenance

- Source: Clanker Documentation, Deploy Token (v4.0.0)
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: deployment endpoint, reward allocation, admin/recipient fields
- Verification: verified in docs

- Source: Clanker Documentation, Get Tokens by Admin
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: admin-history tool
- Verification: verified in docs

- Source: Clanker Documentation, Get Tokens Deployed by Address
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: deployer-history tool
- Verification: verified in docs

- Source: Clanker Documentation, Get Claimed Fees [beta]
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: claimed-fee history tool and caveat
- Verification: verified in docs

- Source: clanker-sdk README and examples/v4/getTokenRewards.ts
- Kind: official SDK source
- Retrieved: 2026-04-15
- Applied To: reward-recipient inspection and claim transaction preparation
- Verification: partially verified in local SDK exports

## See Also

- system-journal/INDEX.md
- system-journal/design-language/clanker-token-deploy-skill.md
- system-journal/owner-map/clanker-skill.md
