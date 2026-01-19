---
name: zora_nfts
description: Zora discovery and profile analysis (trending coins and creator profiles).
---

**INTENT: NFT ANALYSIS (ZORA)**

Tool output contracts (do not guess fields):
- `get_zora_trending` returns `{ success, category, count, coins[] }` where each coin has `name`, `symbol`, `address`, `priceUsdc`, `marketCapUsdc`, `dailyVolumeUsdc`, `dailyChange`, `creatorFid`.
- `get_zora_profile` returns `{ success, profile }` with `displayName`, `bio`, `avatar`, `socialAccounts`, and optional `creatorCoin`.
- `set_zora_notification_threshold` returns `{ success, message }`.

Tool input contracts (use only these parameters):
- `get_zora_trending`: optional `category`, optional `limit`.
- `get_zora_profile`: `identifier` (address or handle).
- `set_zora_notification_threshold`: `threshold` (integer).

1. **NFT Discovery**:
   - Use `get_zora_trending` to find popular mints and collections on the Zora network.
   - Report on mint prices, total mints, and time since launch.

2. **Collector Insights**:
   - Use `get_zora_profile` to see a user's activity on Zora, including their creations and collections.
   - Helpful for identifying influential creators or active collectors.

3. **Notification Settings**:
   - Use `set_zora_notification_threshold` to customize when the system should alert the user about new Zora tokens.
   - Users might say "Notify me when a creator with > 10k followers launches" or "Set my Zora alert threshold to 1M".

3. **Contextual Information**:
   - Zora is often associated with Base and Ethereum. If the user asks about NFTs on these chains, Zora results are highly relevant.
   - Mention the minting platform (Zora) clearly in your summary.

4. **Visuals**:
   - Mention that users can view the NFTs on the Zora website using the links provided in the tool output.

Red alert thresholds (raise caution):
- If `priceUsdc` or `marketCapUsdc` is null/0, mention that pricing is unavailable or still forming.
