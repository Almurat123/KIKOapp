# Launchpad 检测工作流程 & 优化建议

> 核心入口：`detectLaunchpadToken(address, chainId, options)` → `launchpadDetector.ts`

---

## 一、按触发源分类（含建议）

### 1. Copy-Trade 流（autoTradeService）

```
Webhook 收到 swap 事件
    │
    ▼
handleSwapDetected()
    │
    ├─► [A] 预暖：detectLaunchpadToken(swap.tokenOut)    ← ⚠️ 可删
    │       └─ Promise.allSettled, 不 await
    │
    ├─► 判断 BUY / SELL / token_to_token
    │
    └─► 若 BUY ──► handleTargetBuy(tokenToBuy = swap.tokenOut)
                        │
                        ├─► [B] launchpadPromise = detectLaunchpadToken(tokenToBuy)  ← ✅ 保留（主结果）
                        │
                        └─► processBuyWithInfo() ──► processSingleUserBuy()
                                │                        │
                                │                        ├─► [B'] resolveLaunchpad(launchpadPromise)  ← ✅ 保留
                                │                        │       └─ 路由 Zora fast-swap / FourMeme 等
                                │                        │
                                │                        └─► 若 aiAnalysisMode ──► [C] analyzeTradeOpportunity()  ← ⚠️ 应改
                                │                                                        └─► runJudgeEngine()
                                │                                                                └─► detectLaunchpadType()
                                │                                                                        └─► detectLaunchpadToken(tokenAddress)
                                │
                                └─ launchpadPromise 已有结果传递进来，但 Judge 完全忽略它，重新检测
```

#### 建议

| 编号 | 现状 | 建议 | 理由 |
|------|------|------|------|
| **A** | 预暖 | **删除** | [B] 在毫秒级后立刻对同一 token 发起请求，预暖几乎无法先于 [B] 完成（`handleTargetBuy` 紧跟 `handleSwapDetected` 同步调用），纯粹浪费一次 RPC/API 调用。如果 [A] 和 [B] 之间的延迟增大（例如将来改为队列），可再恢复。 |
| **B** | 主检测 | **保留** | 这是 copy-trade 的权威 launchpad 结果，用于路由（Zora fast-swap、FourMeme）和 fallback token info。 |
| **C** | Judge 重新检测 | **改为复用 [B] 结果** | `analyzeTradeOpportunity` 在**交易已执行之后**才调用（post-trade analysis），且目标 token 与 [B] 完全相同。应将 [B] 的 `launchpadResult` 传入 `runJudgeEngine`，跳过内部的 `detectLaunchpadType` 调用。即使 Judge 需要的是 `launchpad_type` 字符串，`launchpadResult.provider` 已经是这个值。 |

---

### 2. 定时 Job 流（tokenDataJob）

```
MarketJob 调度（每 5 分钟）
    │
    ▼
enrichLaunchpadsForTrending(chainId, tokens[])
    │
    ├─► Step 0: detectBySuffix()           ← ✅ 保留（纯本地，零成本）
    │
    ├─► Step 2（BSC）: flap 验证
    │       filter: launchpad === 'flap'
    │       └─► [D] mode: 'cheap'          ← ✅ 保留
    │
    ├─► Step 3（EVM）: 未解析 token
    │       filter: !launchpad && 0x
    │       └─► [E] forceRefresh: true      ← ✅ 保留
    │
    ├─► Step 3b（Solana）: 未解析 token
    │       filter: !launchpad && !address.startsWith('0x')  // 排除 EVM 地址，保留 Solana base58
    │       └─► [F] forceRefresh: true      ← ✅ 保留
    │
    ├─► Step 4: Creator 回填
    │       filter: launchpad 存在但缺 creator
    │       └─► [G] forceRefresh: true,     ← ⚠️ 可改
    │           requireCreator: true
    │
    └─► Step 5（Solana）: Creator 发现
            filter: 任何缺 creator 的 Solana token
            └─► [H] requireCreator: true    ← ⚠️ 可合并
```

#### 建议

| 编号 | 现状 | 建议 | 理由 |
|------|------|------|------|
| **D** | flap 验证 | **保留** | mode: cheap，轻量级，只在 BSC 触发，逻辑正确。 |
| **E, F** | 未解析 token 检测 | **保留** | 这是核心分类逻辑，且有 budget 限制（`pickVerifyTargets`），合理。 |
| **G** | Creator 回填 | **改：去掉 `forceRefresh: true`** | Step 3/3b 刚检测过的 token，persistent cache 里已有几秒内的新鲜决策。`forceRefresh: true` 会绕过所有缓存重新调 API。建议改为 `forceRefresh: false`，依赖 persistent cache 的 stale 机制（`LAUNCHPAD_DECISION_STALE_TTL_SECONDS`），只在过期时后台刷新。这能砍掉 Step 4 大量重复请求。 |
| **H** | Solana creator 发现 | **合并到 Step 3b** | Step 3b 已经对 Solana 未解析 token 做 `forceRefresh: true` 检测。如果在 Step 3b 调用时加上 `requireCreator: true`，就能一次拿到 launchpad + creator，省掉 Step 5 的单独遍历。缺 creator 但已有 launchpad 的 token 由 Step 4 兜底。 |

---

### 3. tokenDetector 流（findTokenOnAnyChain / getTokenInfo）

```
findTokenOnAnyChain(address):
    ├─ DexScreener 无 pairs ──► [I] detectLaunchpadToken(address, 8453)    ← ✅ 保留
    └─ DexScreener 有 match ──► [J] detectLaunchpadToken(address, chainId)  ← ⚠️ 可改

getTokenInfo(address, chainId):
    ├─ Gecko 成功   ──► [K] detectLaunchpadToken(address, chainId)   ← ⚠️ 可改
    ├─ DexScreener 成功 ──► [L] detectLaunchpadToken(address, chainId)   ← ⚠️ 可改
    └─ 都失败       ──► [M] detectLaunchpadToken(address, chainId)   ← ✅ 保留
```

#### 建议

| 编号 | 现状 | 建议 | 理由 |
|------|------|------|------|
| **I** | 无 pairs 兜底 | **保留** | 新 launchpad token 可能还没被 DexScreener 索引，这是有价值的发现路径。 |
| **J** | findTokenOnAnyChain 补充 | **保留，但 getTokenInfo 不应重复** | J 检测后结果已挂在 `tokenInfo.launchpad` 上。问题出在：调用方（ChatWorker、swap routes）拿到 `tokenInfo` 后，如果转而调 `getTokenInfo(address, chainId)`，会在 K/L 处再检测一次。 |
| **K, L** | getTokenInfo 每个成功路径都补检 | **合并为单次** | `getTokenInfo` 内部有 3 个分支（Gecko 成功、DexScreener 成功、都失败），每个都调一次 `detectLaunchpadToken`。实际上只有一个分支会命中。但如果调用方已通过 `findTokenOnAnyChain` 拿到了 launchpad，再调 `getTokenInfo` 就会重复。建议：`getTokenInfo` 接受可选参数 `existingLaunchpad?: LaunchpadResult`，有值时跳过检测。 |
| **M** | 都失败的兜底 | **保留** | 作为最后手段，成本低（内存 cache 通常已有结果）。 |

---

### 4. MainSwapService 流

```
MainSwapService.executeSwap(request)
    │
    ├─ if EVM && 非 copytrade && 无 launchpadProvider
    │       └─► [N] detectLaunchpad(tokenOut) || detectLaunchpad(tokenIn)
    │
    └─ if copytrade → skip（已在 autoTradeService 中处理）
```

#### 建议

| 编号 | 现状 | 建议 | 理由 |
|------|------|------|------|
| **N** | 独立检测 | **保留，但做的已经正确了** | 代码已对 copytrade 跳过检测（`!isCopytrade` guard），避免了与 autoTradeService 的重复。对用户主动 swap，这是唯一的 launchpad 检测点，合理。不过它先检测 `tokenOut` 再 `tokenIn`（串行），可以改为 `Promise.any` 并行加速。 |

---

### 5. TokenSkill / API

```
TokenSkill tokenInfo tool:
    └─► [P] detectLaunchpadToken(args.address, chainId)

GET /tokens/launchpad:
    └─► [O] detectLaunchpadToken(address, chainId)
```

#### 建议

| 编号 | 现状 | 建议 | 理由 |
|------|------|------|------|
| **O** | HTTP API | **保留** | 外部/脚本使用，无重复问题。 |
| **P** | TokenSkill | **保留，但考虑与 getTokenInfo 去重** | TokenSkill 的 handler 先调 `detectLaunchpadToken`，然后又调 `dexscreener.getTokenDetails`。如果改为调 `getTokenInfo`（它内部已包含 launchpad 检测），可以减少一次。不过 TokenSkill 是独立工具，影响面小，优先级低。 |

---

## 二、架构层面建议

### 1. 加入请求合并（Inflight Dedup）

当前 `detectLaunchpadToken` 缺少对同一 (address, chainId) 并发调用的合并。多个调用方同时请求同一 token 时，每个都会独立走 `handleDetection`。

```typescript
// 建议在 detectLaunchpadToken 入口加：
const inflightMap = new Map<string, Promise<LaunchpadResult | null>>();

export async function detectLaunchpadToken(address, chainId, options) {
    const key = `${chainId || 'any'}:${address.toLowerCase()}`;
    const existing = inflightMap.get(key);
    if (existing && !options?.forceRefresh) return existing;

    const promise = doDetect(address, chainId, options).finally(() => {
        inflightMap.delete(key);
    });
    inflightMap.set(key, promise);
    return promise;
}
```

**影响**：A 与 B 并发时自动合并；跨流（autoTradeService + tokenDataJob）并发时自动合并。这一个改动就能解决大部分重复。

### 2. Judge Engine 接受外部 launchpad 结果

```typescript
// judgeEngine.ts
export async function runJudgeEngine(
    tokenAddress, chainId, userAmountUsd, targetWallet,
    knownLaunchpadType?: string  // ← 新参数
) {
    input.launchpad_type = knownLaunchpadType
        || await detectLaunchpadType(tokenAddress, poolAddress, chain);
}
```

**影响**：copy-trade 流中，[C] 完全复用 [B] 的结果，零额外调用。

---

## 三、优先级排序

| 优先级 | 改动 | 省去的调用 | 复杂度 |
|--------|------|-----------|--------|
| **P0** | 加入 inflight dedup | 所有并发重复（尤其 [A]+[B]、跨流） | 低（~15行） |
| **P1** | 删除 [A] 预暖 | 每次 BUY 1 次 | 极低（删 1 行） |
| **P1** | [C] Judge 复用 [B] | 每次有 AI 分析的 BUY 1 次 | 低（加参数传递） |
| **P2** | [G] 去掉 forceRefresh | tokenDataJob 中大量 creator 回填 | 极低（改 1 个参数） |
| **P2** | [H] 合并到 Step 3b | tokenDataJob Solana 重复遍历 | 低（调整 filter + 参数） |
| **P3** | getTokenInfo 接受已有结果 | Chat/Swap 流中的重复 | 中（接口变更） |
| **P3** | MainSwapService 并行检测 | 微优化 | 极低 |

---

## 四、汇总表（最终版）

| 编号 | 调用方 | 建议 | 原因 |
|------|--------|------|------|
| A | autoTradeService 预暖 | **删除** | 与 [B] 间隔太短，预暖无效 |
| B | autoTradeService handleTargetBuy | **保留** | 权威结果，路由依赖 |
| B' | processSingleUserBuy resolveLaunchpad | **保留** | 复用 [B] 的 promise |
| C | Judge Engine | **改为复用 [B]** | post-trade，同一 token |
| D | tokenDataJob flap 验证 | **保留** | cheap mode，合理 |
| E | tokenDataJob EVM 未解析 | **保留** | 有 budget 限制 |
| F | tokenDataJob Solana 未解析 | **保留** | 有 budget 限制 |
| G | tokenDataJob creator 回填 | **去掉 forceRefresh** | 依赖 stale 机制即可 |
| H | tokenDataJob Solana creator 发现 | **合并到 F** | 减少遍历 |
| I | tokenDetector 无 pairs | **保留** | 有价值的发现 |
| J | tokenDetector findTokenOnAnyChain | **保留** | 首次丰富 |
| K | tokenDetector getTokenInfo Gecko | **保留** | 但接受外部结果跳过 |
| L | tokenDetector getTokenInfo Dex | **保留** | 但接受外部结果跳过 |
| M | tokenDetector 兜底 | **保留** | 最后手段 |
| N | MainSwapService | **保留** | 已有 copytrade guard |
| O | HTTP API | **保留** | 外部使用 |
| P | TokenSkill | **保留** | 影响面小 |
