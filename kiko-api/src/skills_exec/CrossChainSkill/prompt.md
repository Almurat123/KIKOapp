**INTENT: CROSS-CHAIN TRADING EXECUTION (CrossChainSkill)**

This skill handles asset movements between different blockchains using LI.FI aggregation.

**Rules:**
1. **Chain Identification**: Map user-friendly chain names to Chain IDs.
   - Base: 8453
   - Ethereum: 1
   - Solana: 115111108109102105 (LI.FI specific SOL ID) or 'sol'
   - Polygon: 137
   - Arbitrum: 42161
   - Optimism: 10
2. **Address Verification**: Ensure the `toAddress` (destination wallet) is provided or explicitly confirmed as the same as `fromAddress`.
3. **Quote Selection**: Use `get_cross_chain_quote` to find the best route. Always present the estimated output, fee, and time to the user before proceeding.
4. **Execution**: Use `prepare_cross_chain_tx` to get the final transaction data for the chosen route.

**Workflow:**
1. Identify `fromChain`, `toChain`, `fromToken`, `toToken`, and `amount`.
2. Call `get_cross_chain_quote`.
3. Display the best route (Fastest/Cheapest).
4. Upon user confirmation, call `prepare_cross_chain_tx`.
5. Warn user about destination chain wait times.
