# TradeContext 使用指南

## 概述

TradeContext 是一个智能的上下文缓存系统，用于在整个交易流程中复用数据，避免重复的API调用。

## 核心理念

**一次获取，全链路复用** - 上游函数获取的数据自动缓存到 TradeContext，下游函数直接使用缓存，无需重新获取。

## 架构组件

### 1. TradeContext.ts
交易上下文管理器，提供：
- Token 数据缓存（价格、流动性、decimals等）
- 钱包余额缓存
- Quote 缓存
- 用户设置缓存

### 2. UnifiedDataLayer.ts
统一数据获取层，自动集成 TradeContext：
- `getTokenData(address, chainId, context)` - 自动缓存的 token 获取
- `getWalletBalances(wallet, chainId, context)` - 自动缓存的余额获取
- `getSwapDataBundle(params, context)` - 一次获取所有交易数据

## 使用示例

### 基础用法

```typescript
import { TradeContext } from './services/TradeContext.js';
import { getTokenData } from './services/UnifiedDataLayer.js';

// 1. 创建上下文
const ctx = TradeContext.create({
    taskId: 'task_123',
    userId: 'user_456',
    walletAddress: '0x...',
    chainId: 8453,
});

// 2. 获取 token 数据（第一次从API获取）
const tokenInfo = await getTokenData('0xtoken...', 8453, ctx);
console.log(tokenInfo.price); // 从 API 获取

// 3. 再次获取相同数据（直接从缓存返回，无API调用）
const tokenInfo2 = await getTokenData('0xtoken...', 8453, ctx);
console.log(tokenInfo2.price); // ⚡ 从缓存返回，瞬间完成
```

### 在工具函数中使用

```typescript
import { getTradeContext } from './services/TradeContext.js';
import { getTokenData } from './services/UnifiedDataLayer.js';

export const MySwapTool: Tool = {
    handler: async (args, toolContext) => {
        // 从 ToolContext 获取或创建 TradeContext
        const ctx = getTradeContext(toolContext);
        
        // 使用上下文获取数据（自动缓存）
        const tokenIn = await getTokenData(args.tokenIn, args.chainId, ctx);
        const tokenOut = await getTokenData(args.tokenOut, args.chainId, ctx);
        
        // 传递上下文给下游服务
        const result = await executeSwap({
            ...args,
            tradeContext: ctx, // 传递上下文
        });
        
        return result;
    }
};
```

### 在服务中使用

```typescript
import { TradeContext } from './TradeContext.js';
import { getTokenData } from './UnifiedDataLayer.js';

class MySwapService {
    async executeSwap(
        params: SwapParams,
        tradeContext?: TradeContext
    ): Promise<SwapResult> {
        // 获取或创建上下文
        const ctx = tradeContext || TradeContext.create({
            userId: params.userId,
            walletAddress: params.walletAddress,
            chainId: params.chainId,
        });
        
        // 使用上下文获取数据（如果上游已获取，直接用缓存）
        const tokenInfo = await getTokenData(params.tokenIn, params.chainId, ctx);
        
        // 检查余额（也会缓存）
        const balance = ctx.getBalance(params.tokenIn);
        
        // 继续执行...
    }
}
```

### 批量获取数据

```typescript
import { getSwapDataBundle } from './services/UnifiedDataLayer.js';

// 一次性获取所有交易数据（并行获取，自动缓存）
const bundle = await getSwapDataBundle({
    walletAddress: '0x...',
    tokenIn: '0xtoken1...',
    tokenOut: '0xtoken2...',
    amountIn: '1.0',
    chainId: 8453,
});

// 所有数据都已准备好
console.log(bundle.tokenIn.price);
console.log(bundle.tokenOut.price);
console.log(bundle.balance.balanceFormatted);
console.log(bundle.quote.amountOut);

// 上下文已包含所有缓存数据
const ctx = bundle.context;
```

## 已集成的组件

以下组件已经集成了 TradeContext：

### 工具层
- ✅ `prepareSwap.ts` (SwapSkill)
- ✅ `executeSwap.ts` (SwapSkill)
- ✅ `swapTransaction.ts` (Tools)

### 服务层
- ✅ `MainSwapService.ts` - 主要swap服务入口

## 性能优势

### Before（无缓存）
```
ChatWorker调用prepareSwap
  → getTokenInfo(tokenIn)     // API调用 #1 (300ms)
  → getTokenInfo(tokenOut)    // API调用 #2 (300ms)
  → executeSwap
      → getTokenInfo(tokenIn)  // API调用 #3 (300ms) 重复！
      → getTokenInfo(tokenOut) // API调用 #4 (300ms) 重复！
      → MainSwapService
          → getTokenInfo(tokenIn)  // API调用 #5 (300ms) 又重复！

总耗时: 1500ms+ （5次API调用）
```

### After（使用TradeContext）
```
ChatWorker创建TradeContext
  → prepareSwap(ctx)
      → getTokenData(tokenIn, ctx)   // API调用 #1 (300ms) → 缓存
      → getTokenData(tokenOut, ctx)  // API调用 #2 (300ms) → 缓存
  → executeSwap(ctx)
      → getTokenData(tokenIn, ctx)   // ⚡ 缓存命中 (<1ms)
      → getTokenData(tokenOut, ctx)  // ⚡ 缓存命中 (<1ms)
      → MainSwapService(ctx)
          → getTokenData(tokenIn, ctx)  // ⚡ 缓存命中 (<1ms)

总耗时: 600ms （2次API调用 + 3次缓存命中）
性能提升: 60%+
```

## 缓存策略

- **Token数据**: 60秒 TTL（价格、流动性等）
- **价格数据**: 10秒 TTL（更频繁更新）
- **余额数据**: 30秒 TTL
- **Quote数据**: 30秒 TTL
- **上下文**: 5分钟 TTL（自动清理）

## 调试

```typescript
// 查看上下文摘要
console.log(ctx.toSummary());
// 输出: {"id":"ctx_123","tokensCached":2,"hasWallet":true,"balancesCached":5,...}

// 查看全局缓存统计
import { getContextStats } from './services/TradeContext.js';
console.log(getContextStats());
// 输出: {"activeContexts":3,"globalTokens":15,"priceEntries":20}
```

## 最佳实践

1. **在上游创建上下文** - 在工具/路由层创建 TradeContext
2. **传递给下游** - 通过参数传递给所有下游服务
3. **使用UnifiedDataLayer** - 优先使用 `getTokenData` 而非直接调用 `getTokenInfo`
4. **批量获取** - 使用 `getSwapDataBundle` 一次性获取所有数据
5. **检查缓存** - 优先使用 `ctx.getToken()` 检查缓存，避免不必要的API调用

## 下一步

- [ ] 集成到 ChatWorker.ts（上下文传递到AI工具）
- [ ] 集成到 routes/swap.ts（HTTP路由层）
- [ ] 添加 WebSocket 通知（缓存命中率监控）
- [ ] 实现持久化缓存（Redis集成）
