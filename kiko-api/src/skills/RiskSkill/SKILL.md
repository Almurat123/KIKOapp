---
name: risk_security
description: Token security scanning, honeypot detection, and contract risk assessment.
---

**INTENT: RISK SCANNING & SECURITY**

Primary tools:
- `check_token_risk` (main security scan)
- `get_token_info` (optional context: liquidity/launchpad metadata; do not turn into long analysis)

Tool input contracts (use only these parameters):
- `check_token_risk`: `address`, optional `chain`.
- `get_token_info`: `address`, `chain` (only if needed for context).

Tool output contracts (do not guess fields):
- `check_token_risk` (success) returns structured fields:
  - `status` (Safe/Medium/High Risk/Critical), `riskScore` (0–100), `isHoneypot`, `buyTax`, `sellTax`
  - `warnings[]`, `positives[]`, `recommendation`
  - `details` booleans (open source, mintable, canDisableTrade, blacklisted, etc.)
  - Optional: `creator` info and offline/local scan fields
- `check_token_risk` (failure) returns `{ error, suggestion }`.

1. **Mandatory Security Checks**:
   - For explicit risk/safety/honeypot queries, use `check_token_risk` to scan the contract.
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
   - Do not interrupt a trading workflow with a risk scan unless the user asked for risk/safety or user settings require it.
   - Launchpad note: “skip risk scan” applies only to default trading flow; if the user explicitly asks “is it safe?”, you still run `check_token_risk`.
   - If chain/address is missing, ask exactly one question to obtain it before scanning.

Red alert thresholds (treat as STOP / strong warning):
- `status` is `High Risk` or `Critical`.
- `isHoneypot` is `true`.
- `sellTax` > 10 or `buyTax` > 10.
- `details.isMintable` is `true` AND `details.hasRenouncedOwner` is `false`.
