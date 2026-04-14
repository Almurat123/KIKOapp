# Design Language: Copytrade Buy Hot Path Refactor Todo

Updated: 2026-04-14

## Goal

把 EVM copytrade buy 的同步热路径收口为：

`evidence ingress -> config index hit -> hot admission -> send tx`

其余信息补全、记账、解释、修复、审计，全部后移到异步路径。

目标不是“更优雅”，而是让 `leader buy detected -> follower tx broadcast`
具备进入 `1s` 级别的现实可能。

## Why This Refactor Exists

当前热路径的问题不是单点慢，而是 owner 叠层错误：

- 入口层还在同步承担过多 tx/receipt/decode/recovery 逻辑
- 配置解析仍按事件现查数据库，而不是命中预建索引
- 上下文补全仍挡在发单前
- 单用户买入运行时同时承担 admission、风控、记账、通知、修复、AI、退出衔接

这会把交易系统退化成“同步做完所有解释工作再发单”。

## Mature Patterns Observed

### Freqtrade

- 主循环先准备长期对象，再进入交易循环
- pair-independent 数据建议放进 `bot_start()` / `bot_loop_start()`
- 官方明确要求避免在 callback 里做 heavy calculations
- 下单前回调只做准入与价格/仓位相关决策，不承担整套后置解释

### Hummingbot

- 桥接层负责事件/RPC 转发，不拥有业务真相
- `Controller` 产出动作，`Executor` 负责执行
- `OrderCandidate` / balance checking 与 executor 生命周期分开建模
- 策略、预算检查、执行器、远程桥接不是一个超级 owner

## Target Architecture

### Layer 1: Evidence Ingress

Owns:

- webhook / pending prefetch / decode-ready event ingress
- tx identity 去重
- 基础 timing 锚点
- ready event enqueue

Does Not Own:

- durable target-sell truth
- buy confirmation truth
- config materialization
- token metadata / launchpad / tokenInfo
- position / order persistence

Rule:

- 入口层只能把“可能可执行的买单事件”转成标准化 `BuyIntentEnvelope`
- 除弱证据恢复外，不允许同步扩展更多链上抓取

### Layer 2: Config Index

Owns:

- `chainId + targetWallet -> active follower configs[]`
- 预绑定 user / userSettings / executionMode / signature-valid 状态
- 配置变更后的增量索引更新

Does Not Own:

- token-level runtime admission
- price/liquidity/launchpad enrichment
- execution routing

Rule:

- 交易时只命中索引，不做 `findMany + warmup + re-filter + dedupe` 这类现算路径

### Layer 3: Hot Admission

Owns:

- stale signal veto
- self-target veto
- cooldown veto
- active duplicate / in-flight duplicate veto
- nonce / balance / route-ready 快速判定

Does Not Own:

- tokenInfo enrichment
- market cap / liquidity explanation
- launchpad classification
- durable position modeling
- notification / AI / repair

Rule:

- 这里只能回答一个问题：`这单现在能不能立刻发`

### Layer 4: Send Executor

Owns:

- request shaping
- calldata / route / slippage / gas policy
- tx send
- txHash handoff

Does Not Own:

- complex pending position semantics
- mirror sell release
- target sell replay
- post-buy AI
- deep audit aggregation

Rule:

- 发送 owner 只能做“构造并发送”
- 发单前 position lock 如果保留，必须变成极轻量原子占位

### Layer 5: Async Reconcile

Owns:

- token metadata / tokenInfo / launchpad enrichment
- position/order durable persistence
- attribution repair
- buy confirmation transition
- exit preheat
- notification
- AI flow
- analytics / audit compaction

Rule:

- 这层允许复杂，但不能回流阻塞买入发送

## Refactor Todo

## 1. Thin The Ingress Owner

- [ ] 把 `webhook.ts` 收口成 evidence ingress，不再继续扩展语义 owner
- [ ] 把“弱证据修复”与“ready event dispatch”完全分开
- [ ] 保证 `dispatchCopyTradeIfReady()` 只做去重和 enqueue，不读业务真相
- [ ] 为 ingress 输出统一的 `BuyIntentEnvelope`，只包含：
  - `chainId`
  - `txHash`
  - `targetWallet`
  - `swap`
  - `timing`
  - `source`
- [ ] 禁止在 ingress 新增 tokenInfo / price / config materialization 逻辑

## 2. Replace Runtime Config Query With Config Index

- [ ] 新建 copytrade config index owner
- [ ] 维护 `chainId + normalizedTargetWallet -> active configs[]`
- [ ] 预绑定 user / userSettings / executionMode
- [ ] 配置创建、删除、停用、重激活时增量刷新索引
- [ ] 热路径改为 O(1) 或近似 O(1) 命中，不再每单 `findMany`
- [ ] 将 dedupe/sanity filtering 前移到索引构建期，而不是交易期

## 3. Move Shared Warmup Out Of The Hot Path

- [ ] 把 `buySharedWarmup` 改成后台预热或按链缓存刷新
- [ ] native price 改为周期缓存，不在单笔买单里现取
- [ ] user settings 改为配置变更时失效，而不是买单时 warmup
- [ ] token metadata fallback 只在执行器确实需要时最小化拉取
- [ ] launchpad detection 改成异步 enrichment，不挡在 send 前

## 4. Split Runtime Admission From Runtime Side Effects

- [ ] 拆分 `legacyCopytradeBuyRuntime.ts`
- [ ] 把“能否发送”的 admission 提取成独立 owner
- [ ] 把 cooldown / duplicate / balance / stale veto 收成纯 admission function
- [ ] 把 persistence / notification / AI / sell-preheat / repair 从 buy runtime 主流程移走
- [ ] 让 `processSingleUserBuy()` 只编排 admission -> send -> handoff
- [ ] 把依赖注入数量从当前超大对象显著下降

## 5. Minimize Pre-Send Persistence

- [ ] 重新定义 pending position lock，只保留最小原子占位能力
- [ ] 不允许发单前做复杂 canonical order / position 状态推进
- [ ] txHash 拿到后再补 durable order/position 绑定
- [ ] 明确“可丢临时态”和“不可丢 durable truth”的边界

## 6. Shrink Send Executor Scope

- [ ] `evmBuySubmissionFlow` 只负责 request shaping 与 send
- [ ] 非 turbo retry 逻辑独立，不污染最短热路径
- [ ] route / calldata / gas policy 可预构就预构
- [ ] nonce / route-ready 预热前移到 admission cache
- [ ] direct swap hint 与 launchpad special-case 改成固定 executor policy，不在 runtime 里临时拼接

## 7. Create Async Post-Send Pipeline

- [ ] 新建 post-send reconcile worker
- [ ] 负责 tokenInfo / price / marketCap / launchpad / liquidity explanation
- [ ] 负责 buy confirmation transition
- [ ] 负责 mirror-sell arming
- [ ] 负责 notification / AI / audit compaction
- [ ] 负责异常恢复与 attribution repair

## 8. Delete Owner Overlap

- [ ] 删除 `autoTradeService.ts` 中已经转交 runtime owner 的重复逻辑
- [ ] 删除 runtime owner 对 ingress owner 的反向语义依赖
- [ ] 删除“交易前解释型计算”与“交易后持久化计算”的混层路径
- [ ] 明确哪些 owner 可以读缓存，哪些 owner 可以写 durable truth

## 9. Add Hot-Path Budgets

- [ ] 为每一层加硬预算日志
- [ ] 目标预算：
  - ingress: `< 50ms`
  - config index hit: `< 10ms`
  - hot admission: `< 50ms`
  - request shaping + send handoff: `< 300ms`
  - wallet provider broadcast: 由外部决定，但应持续观测
- [ ] 对任何超过预算的层打独立 audit，不混在总耗时里

## 10. Add Architectural Guardrails

- [ ] 在 admission owner 注释里明确禁止加入 enrichment 逻辑
- [ ] 在 executor owner 注释里明确禁止加入 persistence-heavy 逻辑
- [ ] 在 ingress owner 注释里明确禁止加入 durable truth owner
- [ ] 为热路径新增测试：任何新增 await-heavy 依赖都应被拒绝

## Non-Goals

- 这次重构不追求一次性统一 buy/sell 全部 runtime
- 不在入口层修所有历史 race case
- 不把所有 audit 日志删掉，只把它们移出热路径
- 不为了 1 秒目标牺牲资金安全底线 admission

## Acceptance Criteria

- 热路径发送前不再调用 tokenInfo / launchpad / market cap 解释型逻辑
- 单笔 buy 在同步路径中不再执行复杂 position/order durable persistence
- `chainId + targetWallet` 配置命中不再依赖数据库现查
- `legacyCopytradeBuyRuntime` 不再承担多 owner 杂糅职责
- `leader buy detected -> follower tx broadcast` 具备进入 `1s` 级别的工程前提

## Immediate File Targets

- `kiko-api/src/routes/webhook.ts`
- `kiko-api/src/services/copytrade-v2/ingress/copyTradeFastDispatcher.ts`
- `kiko-api/src/services/autoTradeService.ts`
- `kiko-api/src/services/copytrade-v2/buy/buySharedWarmup.ts`
- `kiko-api/src/services/copytrade-v2/runtime/legacyCopytradeBuyRuntime.ts`
- `kiko-api/src/services/copytrade-v2/buy/evmBuySubmissionFlow.ts`

## Document Provenance

- Source: Freqtrade Bot Basics
- Kind: official product doc
- Retrieved: 2026-04-14
- Applied To: 将 pair-independent 预热与交易前 callback 责任分开
- Verification: verified in docs

- Source: Freqtrade Strategy Callbacks
- Kind: official product doc
- Retrieved: 2026-04-14
- Applied To: “avoid heavy calculations in callbacks” 作为热路径瘦身依据
- Verification: verified in docs

- Source: Hummingbot Brokers README
- Kind: official repo doc
- Retrieved: 2026-04-14
- Applied To: 桥接层只负责事件/RPC 边界，不拥有业务真相
- Verification: verified in docs

- Source: Hummingbot `controller_base.py`
- Kind: official repo code
- Retrieved: 2026-04-14
- Applied To: Controller 与 Executor 的 owner split
- Verification: verified in code

- Source: Hummingbot `executor_base.py`
- Kind: official repo code
- Retrieved: 2026-04-14
- Applied To: 执行 owner 只管理订单生命周期，不承担上游语义建模
- Verification: verified in code

- Source: Hummingbot `order_candidate.py`
- Kind: official repo code
- Retrieved: 2026-04-14
- Applied To: 候选订单与预算/余额检查应独立建模
- Verification: verified in code

- Source: `/Users/almurat/Downloads/logs.1776159582066.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To: 确认当前买入链路主要耗时不在 send，而在 send 前两段同步路径
- Verification: verified in runtime

- Source: local code audit of `autoTradeService.ts`, `buySharedWarmup.ts`, `legacyCopytradeBuyRuntime.ts`, `webhook.ts`, `copyTradeFastDispatcher.ts`
- Kind: repo code
- Retrieved: 2026-04-14
- Applied To: 当前 owner overlap、热路径污染、运行时迷宫化结论
- Verification: verified in code
