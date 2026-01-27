# API Unification Migration Guide

Based on the analysis, your kiko-api has **98 direct API calls** across **45 files** that need to be migrated to use the `unifiedApiService.ts`. Currently only **11%** of files are using the unified service.

## Current Status

✅ **Already Unified (27 files):**
- Most core services like `dexscreener.ts`, `geckoTerminal.ts`, `etherscan.ts`
- RPC services are properly using `callRpc()`
- External API services using `fetchJson()`

🚨 **Need Migration (41 files):**
- Route handlers (`routes/ai.ts`, `routes/swap.ts`, etc.)
- AI services (`services/ai/*`)
- Utility services (`services/snapchainService.ts`, etc.)
- Tool implementations (`skills/*/tools/*`)

## Migration Examples

### Example 1: Simple fetch() replacement

**Before:**
```typescript
// services/ogpService.ts
const response = await fetch(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0...'
  },
  signal: controller.signal
});
```

**After:**
```typescript
import { fetchJson } from '../config/unifiedApiService.js';

const response = await fetchJson({
  url,
  headers: {
    'User-Agent': 'Mozilla/5.0...'
  },
  timeout: 8000
});
```

### Example 2: axios replacement

**Before:**
```typescript
// services/moderationClient.ts
const response = await axios.post(`${MODERATION_SERVICE_URL}/input`, {
  text,
  context
}, { timeout: 3000 });
```

**After:**
```typescript
import { fetchJson } from '../config/unifiedApiService.js';

const response = await fetchJson({
  url: `${MODERATION_SERVICE_URL}/input`,
  method: 'POST',
  body: JSON.stringify({ text, context }),
  timeout: 3000
});
```

### Example 3: RPC calls

**Before:**
```typescript
// routes/tokens.ts
const rpcResponse = await fetch(rpcUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_call',
    params: [{ to: address, data: balanceOfData }, 'latest']
  })
});
```

**After:**
```typescript
import { callRpc } from '../config/unifiedApiService.js';

const result = await callRpc('ethereum', 'eth_call', [
  { to: address, data: balanceOfData }, 
  'latest'
]);
```

## Priority Migration Order

### High Priority (External APIs - Circuit Breaker Critical)
1. `services/ai/launchpadDetector.ts` - 8 fetch calls
2. `services/snapchainService.ts` - 8 fetch calls  
3. `services/solanaSwap.ts` - 5 fetch calls
4. `services/watcherService.ts` - 5 fetch calls

### Medium Priority (Route Handlers)
5. `routes/ai.ts` - 3 fetch calls
6. `routes/security.ts` - 3 fetch calls
7. `routes/swap.ts` - 1 fetch call
8. `routes/tokens.ts` - 2 fetch calls

### Low Priority (Tools & Utilities)
9. All `skills/*/tools/*` files
10. Utility services

## Benefits After Migration

1. **Circuit Breaker Protection** - Automatic failover when APIs are down
2. **Standardized Retry Logic** - Exponential backoff for failed requests
3. **Health Monitoring** - Track API endpoint performance
4. **Rate Limit Handling** - Built-in backoff for 429 responses
5. **Centralized Configuration** - All API endpoints in one place
6. **Better Error Handling** - Consistent error logging and reporting

## Testing Migration

After migrating each file:

1. Run the analysis script: `node analyze-api-calls.js`
2. Test the specific functionality
3. Check health stats: `getEndpointHealthStats()`
4. Monitor logs for any issues

## Next Steps

1. Start with high-priority files (external APIs)
2. Test each migration thoroughly
3. Update imports and remove unused fetch/axios
4. Run the analysis script to track progress
5. Aim for 100% unification within the next sprint

The unified service will significantly improve your API reliability and make debugging much easier!