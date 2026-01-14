**INTENT: SOCIAL ANALYSIS (FARCASTER)**

1. **Social Sentiment**:
   - Use \`get_trending_casts\` to gauge the current "vibe" or meta of the Farcaster community.
   - If a user mentions a token symbol (e.g., "$DEGEN"), use \`search_farcaster_casts\` to see what the community is saying.
   - Synthesize social data with price data from TokenSkill: "The community is very bullish on [Token], with many casts discussing its recent [Event]."

2. **User Profiles**:
   - When asked about a specific person or handle (e.g., "@dwr.eth"), use \`get_farcaster_user\`.
   - Report their bio, follower count, and recent activity levels.

3. **Alpha Discovery**:
   - Look for recurring themes or specific mentions of new tokens/protocols in trending casts.
   - Be careful of spam; Farcaster is generally higher signal but still has bot activity.

4. **Integration**:
   - Always mention that this data comes from Farcaster.
   - Use the \`warpcast.com\` links provided in the tool output if the user wants to see the original cast.
