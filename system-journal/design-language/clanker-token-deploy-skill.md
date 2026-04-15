# Design Language: Clanker Token Deploy Skill

Updated: 2026-04-15  
Author: Renata

## Purpose

KiKo can help users launch Clanker v4 tokens and inspect Clanker deploy/reward
history, but deployment is a write action with market consequences. The Clanker
skill must therefore separate preview, deploy, indexed analytics, and wallet
claim preparation.

## Rules

- Deployment tools must dry-run by default and return the exact payload that
  would be sent to Clanker.
- Real deployments require an explicit `confirmDeploy=true` argument after the
  user has confirmed the token name, symbol, image, admin, rewards, pool, and
  fees.
- If the user does not specify reward splits, the default launch path is one
  recipient who receives 100% of the rewards.
- If the user does not specify a pool, the default launch path is a standard
  pool paired with the chain's wrapped native asset.
- If the user does not specify fees, the default launch path is fixed fees at
  1% on the token side and 1% on the paired side.
- Dynamic fee details should only be expanded when the user asks for them, and
  the assistant should recommend the `dynamic-basic` and `dynamic-3` templates.
- Reward splits for the HTTP API are expressed as `allocation` percentages and
  must sum to 100 across 1 to 7 recipients.
- Claimed-fee history must be described as beta indexed event history, not a
  guaranteed lifetime accounting ledger.
- Claiming rewards must be prepared as an unsigned transaction; this layer must
  not sign or submit on behalf of the user.
- Admin history and deployer history are separate lookups and must not be
  treated as interchangeable.

## Document Provenance

- Source: Clanker Documentation, Deploy Token (v4.0.0)
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: deployment payload, reward allocation, fee and pool fields
- Verification: verified in docs

- Source: Clanker Documentation, Get Claimed Fees [beta]
- Kind: official API doc
- Retrieved: 2026-04-15
- Applied To: indexed claimed-fee caveat and query tool semantics
- Verification: verified in docs

- Source: clanker-sdk examples/v4/getTokenRewards.ts
- Kind: official SDK source
- Retrieved: 2026-04-15
- Applied To: reward index/admin/recipient interpretation
- Verification: partially verified in local SDK exports

## See Also

- system-journal/INDEX.md
- system-journal/owner-map/clanker-skill.md
- system-journal/adr/2026-04-15-clanker-token-deploy-skill.md
