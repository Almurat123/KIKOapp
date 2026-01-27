# API Integration Guide

This document contains complete integration details for Privy, Kyber Aggregator, and 0x APIs used in the KiKo swap system.

---

## 1. Privy Embedded Wallet API

**Documentation:** https://docs.privy.io/recipes/wallets/server-side-user-wallets

### Overview
Privy enables self-custodial server-side wallets that require user authentication for all transactions. The system maintains user control by demanding valid access tokens for wallet operations.

### Key Requirements

#### Authentication Flow
1. **User JWT Token**: Must be obtained from client and passed to server
2. **User Signer Generation**: Server must generate ephemeral user key from JWT
3. **Authorization Key**: User signer key is used to sign all wallet operations

#### Critical Implementation Details

**User Key Generation:**
```typescript
const signer = await privyClient.walletApi.generateUserSigner({
    userJwt: accessToken
});

const userClient = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET, {
    walletApi: {
        authorizationPrivateKey: signer.authorizationKey
    }
});
```

**Transaction Signing:**
```typescript
const response = await client.walletApi.ethereum.sendTransaction({
    walletId: walletInfo.id,  // Use wallet ID, NOT address
    caip2: `eip155:${chainId}`,
    transaction: {
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: tx.value ? `0x${BigInt(tx.value).toString(16)}` : undefined,
        gasLimit: tx.gas ? `0x${BigInt(tx.gas).toString(16)}` : undefined,
        maxFeePerGas: tx.maxFeePerGas ? `0x${BigInt(tx.maxFeePerGas).toString(16)}` : undefined,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? `0x${BigInt(tx.maxPriorityFeePerGas).toString(16)}` : undefined,
    },
});
```

### Common Issues & Solutions

#### Issue 1: "Invalid JWT token provided"
**Cause:** JWT token expired (typical lifetime: 1 hour)
**Solution:** Implement token refresh mechanism on client, pass fresh token to server

#### Issue 2: "User authorization required. Please authorize server signing"
**Cause:** User hasn't granted delegation or JWT token is invalid
**Solution:**
- Check if user has delegated wallet access
- Verify JWT token is valid and not expired
- Ensure `walletId` matches the user's wallet

#### Issue 3: Wallet not found
**Cause:** Using wallet address instead of wallet ID
**Solution:** Use `walletInfo.id` (internal Privy ID), not `walletInfo.address`

---

## 2. Kyber Aggregator API

**Documentation:** https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/developer-guides/execute-a-swap-with-the-aggregator-api

### Overview
Kyber uses a two-step V1 API:
1. **GET /routes** - Fetch routing data
2. **POST /route/build** - Build transaction with routing data

### Endpoints

**Step 1: Get Routes**
```
GET https://aggregator-api.kyberswap.com/{chain}/api/v1/routes
```

Query Parameters:
- `tokenIn` - Input token address
- `tokenOut` - Output token address
- `amountIn` - Amount in base units
- `saveGas` - true/false
- `gasInclude` - true/false
- `clientId` - Your app identifier

**Step 2: Build Transaction**
```
POST https://aggregator-api.kyberswap.com/{chain}/api/v1/route/build
```

### Critical Request Body Format

```typescript
{
    routeSummary: object,       // REQUIRED: From GET /routes response
    sender: string,             // REQUIRED: Wallet address executing swap
    recipient: string,          // REQUIRED: Address receiving tokens
    slippageTolerance: number,  // REQUIRED: In basis points (10 = 0.1%)
    deadline: number,           // Unix timestamp
    clientId: string,           // Your app ID
    source: string,             // Should match x-client-id header
    enableGasEstimation: false  // CRITICAL: Must be false before approval
}
```

### Common Issues & Solutions

#### Issue 1: "unable to bind request body" (HTTP 400)
**Cause:** Missing required fields or incorrect data types in request body
**Solution:** Ensure all required fields are present:
- `routeSummary` - Must be exact object from GET /routes
- `sender` - Valid Ethereum address
- `recipient` - Valid Ethereum address
- `slippageTolerance` - Number type (not string)

**Example Fix:**
```typescript
const buildBody = {
    routeSummary: routeData.data.routeSummary,  // Use exact response
    sender: userAddress,
    recipient: userAddress,
    slippageTolerance: 50,  // Number, not "50"
    deadline: Math.floor(Date.now() / 1000) + 600,
    clientId: 'kiko-app',
    source: 'kiko-app',
    enableGasEstimation: false  // Prevent approval check failures
};
```

#### Issue 2: Gas estimation failures
**Cause:** `enableGasEstimation: true` tries to simulate transaction before token approval
**Solution:** Set `enableGasEstimation: false` and handle gas estimation separately

---

## 3. 0x API

**Documentation:** https://0x.org/docs/0x-swap-api/guides/swap-tokens-with-0x-swap-api

### Overview
0x provides swap quotes via allowance-holder endpoint (V2) with taker parameter requirement.

### Endpoints

**Price Check (Indicative):**
```
GET https://api.0x.org/swap/allowance-holder/price
```

**Quote (Firm Order):**
```
GET https://api.0x.org/swap/allowance-holder/quote
```

### Required Parameters

**All Requests:**
- `sellToken` - Token address to sell
- `buyToken` - Token address to buy
- `sellAmount` - Amount in base units
- `chainId` - Network ID
- `taker` - **REQUIRED**: User's wallet address

**Headers:**
- `0x-api-key` - Your API key
- `0x-version` - "v2"

### Critical Implementation Details

**Quote Request Example:**
```typescript
const params = new URLSearchParams({
    sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
    buyToken: '0x6b175474e89094c44da98b954eedeac495271d0f',
    sellAmount: '1000000000000000000',
    chainId: '1',
    taker: userWalletAddress,  // CRITICAL: Required
    slippageBps: '50'  // 0.5%
});

const url = `https://api.0x.org/swap/allowance-holder/quote?${params}`;

const response = await fetch(url, {
    headers: {
        '0x-api-key': API_KEY,
        '0x-version': 'v2'
    }
});
```

### Common Issues & Solutions

#### Issue 1: "field: taker, reason: Required" (HTTP 400)
**Cause:** Missing `taker` parameter in quote request
**Solution:** Always include `taker` parameter with user's wallet address

**Fix:**
```typescript
// Before (fails):
const params = { sellToken, buyToken, sellAmount };

// After (works):
const params = {
    sellToken,
    buyToken,
    sellAmount,
    taker: walletAddress  // Add this!
};
```

#### Issue 2: No route found (HTTP 404)
**Cause:** Insufficient liquidity or unsupported token pair
**Solution:** Implement fallback to v1 endpoint or alternative DEX

**Fallback Strategy:**
```typescript
try {
    // Try allowance-holder first
    quote = await fetch('/swap/allowance-holder/quote?...');
} catch (error) {
    if (error.status === 404 || error.status === 400) {
        // Fallback to v1
        quote = await fetch('/swap/v1/quote?...');
    }
}
```

#### Issue 3: Native token address format
**Cause:** Different endpoints expect different formats for ETH
**Solution:** Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for allowance-holder

---

## Integration Checklist

### Privy
- [ ] JWT token refresh mechanism implemented
- [ ] User delegation status checked before transactions
- [ ] Using wallet ID (not address) for transaction signing
- [ ] Error handling for expired tokens

### Kyber
- [ ] Two-step API flow implemented (GET routes → POST build)
- [ ] `routeSummary` passed exactly from GET response
- [ ] `enableGasEstimation` set to false
- [ ] All required fields present with correct types

### 0x
- [ ] `taker` parameter included in all quote requests
- [ ] Native token addresses normalized to 0xEeee... format
- [ ] Fallback to v1 endpoint implemented for failures
- [ ] API key and version headers included

---

## Error Code Reference

| Service | Error | Cause | Solution |
|---------|-------|-------|----------|
| Privy | Invalid JWT | Expired token | Refresh token on client |
| Privy | DELEGATION_REQUIRED | No wallet delegation | Prompt user to authorize |
| Kyber | 400: unable to bind | Missing/invalid fields | Verify request body structure |
| 0x | 400: taker Required | Missing taker param | Add wallet address to request |
| 0x | 404: No route | Insufficient liquidity | Try fallback or show error |

---

## Best Practices

1. **Always validate user input** before making API calls
2. **Implement retry logic** with exponential backoff for transient failures
3. **Cache token metadata** to reduce API calls
4. **Log full request/response** for debugging (sanitize sensitive data)
5. **Use timeout values** (10-15s) to prevent hanging requests
6. **Check response validity** before processing (e.g., liquidityAvailable flag)
7. **Implement proper error handling** with user-friendly messages

---

*Last Updated: January 27, 2026*
