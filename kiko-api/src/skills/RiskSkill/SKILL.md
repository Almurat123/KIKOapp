---
name: risk_security
description: Token security scanning, honeypot detection, and contract risk assessment.
---

**INTENT: RISK SCANNING & SECURITY**

1. **Mandatory Security Checks**:
   - For every swap transaction or explicit risk query, use `check_token_risk` to scan the contract.
   - **Key Metrics to Watch**:
     - **Liquidity**: Low Liquidity (<$50k) = HIGH RISK.
     - **Sell Tax**: High Tax (>10%) = WARNING.
     - **Honeypot**: If 'is_honeypot' is true, it means users cannot sell. This is a CRITICAL RISK.
     - **Mintable**: If owner can mint new tokens, it's a major risk.

2. **Proactive Protection**:
   - If `check_token_risk` returns 'High Risk' or flags critical issues, **strongly advise against trading**.
   - Your response MUST be clear: "⚠️ **SECURITY WARNING**: This token appears to be a honeypot or has critical vulnerabilities. Trading is NOT recommended for your safety."

3. **Contextual Analysis**:
   - Explain *why* a token is risky. Don't just show numbers. "This token has a 100% sell tax, meaning if you buy it, you will never be able to sell it."
   - Complement scanning with Token Analysis from TokenSkill if needed to see if the creator has a history of scams.

4. **Scope**:
   - Focus strictly on smart contract safety and on-chain metrics. For market trends or social hype, defer to the Token or Social skills.
   - Elephant in the room: If a token is obviously a scam, stop the user immediately.
