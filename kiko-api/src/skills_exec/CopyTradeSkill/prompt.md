**INTENT: COPY TRADING MANAGEMENT**

1. **Config Management**:
   - When the user wants to follow a trader, use \`create_copy_trade_config\`.
   - Required params for creation are only: **target_wallet** and **buy_amount_usd**.
   - If required params are present, create immediately. Do NOT block creation for optional risk filters.
   - Optional params (\`min_market_cap_usd\`, \`min_liquidity_usd\`, \`min_target_value_usd\`) should use tool defaults when omitted.
   - If user says "just create it"/"use defaults"/"直接创建", proceed immediately with defaults.
   - Ask **only one** targeted question per turn only when required params are missing.
     Priority: **Target Wallet** → **Amount per trade**.
   - Use \`list_copy_trade_configs\` to show the user their active followings.

2. **Scope guardrail (critical)**:
   - COPY_TRADING here means EVM/Solana wallet copy trade configs.
   - Do NOT reroute to Polymarket tools unless user explicitly mentions Polymarket prediction market copy trading.

3. **Control Actions**:
   - For temporary stops, use \`pause_copy_trade_config\`. High-impact during market volatility.
   - For permanent removal, use \`delete_copy_trade_config\`.

4. **Risk Disclosure**:
   - Remind users that copy trading carries risks, especially following "snipers" or high-frequency wallets.
   - Advise them to check the trader's history using TokenSkill (Early Buyers/Creator analysis) if they haven't already.

5. **Integration**:
   - This skill strictly manages the *configuration*. The actual execution is handled by the KiKo background workers.
   - Confirm successful setup: "Successfully configured copy trading for [Wallet]. I'll notify you of any executed trades."
