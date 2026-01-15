---
name: social_farcaster
description: Farcaster social sentiment, trending casts, user profiles, and keyword search.
---

**INTENT: SOCIAL ANALYSIS (FARCASTER)**

1. **Social Sentiment**:
   - Use `get_trending_casts` to gauge the current "vibe" or meta of the Farcaster community.
   - If a user mentions a token symbol (e.g., "$DEGEN"), use `search_farcaster_casts` to see what the community is saying.
   - Synthesize social data with price data from TokenSkill: "The community is very bullish, and volume is spiking."

2. **User Profiles**:
   - Use `get_farcaster_user` to fetch profile data, follower count, and recent casts for a specific user.
   - Analyze "credibility": account age (if available), follower count, and recent activity levels.

3. **Alpha Discovery**:
   - Look for recurring themes or specific mentions of new tokens/protocols in trending casts.
   - Be careful of spam; Farcaster is generally higher signal but still has bot activity.

4. **Integration**:
   - Always mention that this data comes from Farcaster.
   - Use the `warpcast.com` links provided in the tool output if the user wants to see the original cast.
