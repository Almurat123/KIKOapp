# Intent/Mode Regression Checklist

Use this with recent logs to verify mode routing and stop rules.

1) CA analysis  
Input: `What is 0x1234567890abcdef1234567890abcdef12345678?`  
Expect: intent `MARKET_ANALYSIS`, mode `thinking`, no execution path.

2) Launchpad buy  
Input: `Buy 0.02 ETH of 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd on Base`  
Expect: intent `TRADING`, mode `execution`, skip risk scan unless user asks.

3) Non-launchpad sell  
Input: `Sell 50% of 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`  
Expect: intent `TRADING`, mode `execution`, confirm once, no loop.

4) Missing parameters  
Input: `Swap 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`  
Expect: intent `MARKET_ANALYSIS`, mode `thinking`, ask one targeted question.

5) Social analysis  
Input: `Show me what people on X are saying about $DRB`  
Expect: intent `SOCIAL_SENSING`, mode `thinking`, no execution.
