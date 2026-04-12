# Fix Log: 2026-04-12 Farcaster Signed Key Request Deeplink

## What Changed

- Added a standalone script that generates a Farcaster signed-key-request deeplink from `APP_FID` + `APP_MNEMONIC` and the configured `FARCASTER_SIGNER_PRIVATE_KEY`.
- Added a package script entry so operators can run the flow without hand-assembling the POST body.
- Kept the output server-side only: the script prints the deeplink and token, but does not log the mnemonic or signer private key.

## Why

The Farcaster signer onboarding flow requires a custody-wallet signature over the app's `SignedKeyRequest`, then a client deeplink that the user can open in Warpcast/Farcaster to approve the signer. The repo already had the write-path signer private key, but no standalone deeplink generator for remote approval.

This change keeps the approval flow explicit and avoids embedding the request assembly in unrelated agent runtime code.

## Product Rule

- `APP_MNEMONIC` is a secret and must stay in a server secret manager or a protected `.env` file only.
- `FARCASTER_SIGNER_PRIVATE_KEY` is used only to derive the signer public key being approved.
- The script should be run on demand by an operator, not on startup.
- The deeplink response is the source of truth for the approval step; the approved signer can then be used by the existing Hub write path.

## Document Provenance

- Source: [Signer Requests](https://docs.farcaster.xyz/reference/farcaster/signer-requests)
- Kind: official API doc
- Retrieved: 2026-04-12
- Applied To: `SignedKeyRequest` EIP-712 fields, `/v2/signed-key-requests` payload, and deeplink semantics
- Verification: verified in docs

- Source: [Pinata FDK Farcaster Auth demo](https://github.com/PinataCloud/pinata-fdk)
- Kind: product/demo doc
- Retrieved: 2026-04-12
- Applied To: `deep_link_url` response shape and approval workflow
- Verification: verified in docs
