# Prompt System Audit

- Time (UTC): 2026-01-17T07:48:11.200Z
- PROMPT_SYSTEM_VERSION: v2 (forced in script)

## Skills Loaded
Total: 9

- copy_trade: intents=[COPY_TRADING], tools=4, prompt_chars=2032
- market_macro: intents=[MARKET_ANALYSIS], tools=4, prompt_chars=2059
- polymarket_prediction: intents=[PREDICTION_MARKETS], tools=16, prompt_chars=3736
- risk_security: intents=[RISK_SCAN], tools=1, prompt_chars=2716
- social_farcaster: intents=[SOCIAL_SENSING], tools=3, prompt_chars=1820
- swap: intents=[TRADING], tools=5, prompt_chars=3354
- token_analysis: intents=[MARKET_ANALYSIS], tools=6, prompt_chars=2525
- wallet_portfolio: intents=[TRADING, GENERAL_CHAT], tools=3, prompt_chars=2086
- zora_nfts: intents=[MARKET_ANALYSIS], tools=2, prompt_chars=1453

## Scenarios

### Trading (explicit pair + amount)
- model: grok
- query: Swap 100 USDC to ETH on Base
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=TRADING (conf=0.9), detailed=swap
- contractAddress: none
- matchedSkills: swap, wallet_portfolio
- systemPromptChars: 13881
- userPromptChars: 959
- expectedAgentPlan: TOOL: prepare_swap_transaction (prepare or execute based on user settings)

### Trading (contract + amount)
- model: grok
- query: Buy 0x4200000000000000000000000000000000000006 with 0.05 ETH
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=TRADING (conf=0.9), detailed=swap
- contractAddress: 0x4200…0006
- matchedSkills: swap, wallet_portfolio
- systemPromptChars: 13881
- userPromptChars: 991
- expectedAgentPlan: TOOL: get_token_info (confirm metadata / launchpad) -> TOOL: prepare_swap_transaction (prepare or execute based on user settings)

### Trading (sell all)
- model: grok
- query: Sell all my USDC on Base for ETH
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=TRADING (conf=0.9), detailed=swap
- contractAddress: none
- matchedSkills: swap, wallet_portfolio
- systemPromptChars: 13881
- userPromptChars: 963
- expectedAgentPlan: TOOL: prepare_swap_transaction (prepare or execute based on user settings)

### Trading (missing amount; should ask 1)
- model: grok
- query: Buy 0x4200000000000000000000000000000000000006
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=TRADING (conf=0.9), detailed=swap
- contractAddress: 0x4200…0006
- matchedSkills: swap, wallet_portfolio
- systemPromptChars: 13881
- userPromptChars: 928
- expectedAgentPlan: ASK: amount to trade

### Risk only
- model: grok
- query: Is 0x4200000000000000000000000000000000000006 safe? honeypot?
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=RISK_SCAN (conf=0.9), detailed=token_security
- contractAddress: 0x4200…0006
- matchedSkills: risk_security
- systemPromptChars: 6251
- userPromptChars: 992
- expectedAgentPlan: TOOL: check_token_risk

### Market analysis
- model: grok
- query: Show me ETH price and 24h change on Base
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=MARKET_ANALYSIS (conf=0.75), detailed=token_info
- contractAddress: none
- matchedSkills: market_macro, token_analysis, zora_nfts
- systemPromptChars: 9576
- userPromptChars: 971
- expectedAgentPlan: TOOL: search_token (if available) or ask for contract

### Prediction market
- model: grok
- query: Polymarket odds for Trump to win?
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=PREDICTION_MARKETS (conf=0.9), detailed=general_query
- contractAddress: none
- matchedSkills: polymarket_prediction
- systemPromptChars: 7271
- userPromptChars: 964
- expectedAgentPlan: TOOL: polymarket_* (event/odds)

### Copy trade
- model: grok
- query: 跟单这个钱包 0x1234567890abcdef1234567890abcdef12345678
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=COPY_TRADING (conf=0.95), detailed=general_query
- contractAddress: 0x1234…5678
- matchedSkills: copy_trade
- systemPromptChars: 5567
- userPromptChars: 980
- expectedAgentPlan: TOOL: follow_wallet / copytrade setup (depending on tools)

### Social sensing
- model: grok
- query: Farcaster trending tokens today
- context: chain=Base, evm=0x1111…1111, sol=undefined, wallet=connected
- parsed: high=SOCIAL_SENSING (conf=0.8), detailed=social_trending
- contractAddress: none
- matchedSkills: social_farcaster
- systemPromptChars: 5355
- userPromptChars: 962
- expectedAgentPlan: TOOL: social_trending / social_user_info (depending on query)

### Solana trading (contract, defaults)
- model: grok
- query: 用SOL买这个 7vfCXT3kZk1xJrXh4g7yq9uW8nQvY8n7xq3qZzZzZzZz
- context: chain=Solana, evm=undefined, sol=111111…1111, wallet=connected
- parsed: high=TRADING (conf=0.9), detailed=swap
- contractAddress: 7vfCXT…ZzZz
- matchedSkills: swap, wallet_portfolio
- systemPromptChars: 13881
- userPromptChars: 790
- expectedAgentPlan: TOOL: get_token_info (confirm metadata / launchpad) -> TOOL: prepare_swap_transaction (prepare or execute based on user settings)
