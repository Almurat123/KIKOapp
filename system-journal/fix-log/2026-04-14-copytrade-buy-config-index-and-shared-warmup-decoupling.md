# Fix Log: 2026-04-14 Copytrade Buy Config Index And Shared Warmup Decoupling

## Summary

Copytrade buy 热路径不再对每一笔 leader buy 同步执行：

- `copyTradeConfig.findMany`
- user join
- userSettings warmup
- `buySharedWarmup`

改为：

- 使用 `chainId + targetWallet` 的 active config index
- 配置命中结果直接携带 `user` / `userSettings`
- native price 独立按链缓存获取
- config create/update/delete/status 立刻失效索引

## Why

生产日志显示，买入链路在 `buy_dispatch_gate` 前存在多段同步前置耗时。  
其中配置解析和 follower context rebuild 不应该在每个 leader buy 事件上重复发生。

原先的 `buySharedWarmup` 设计虽然复用了 native price 与 settings 拉取，但它仍然属于：

- 事件到来后才做
- 每次买入路径都要重新等待
- follower context 在热路径同步重建

这与低延迟 buy hot path 的 owner 边界冲突。

## What Changed

- 新增 `kiko-api/src/services/copytrade-v2/config/copyTradeConfigIndex.ts`
- `autoTradeService.handleTargetBuy()` 改为命中 config index，而不是重新做 config + user + settings warmup
- `processBuyWithInfo()` 不再依赖 `buySharedWarmup`
- `buySharedWarmup.ts` 删除，防止被重新接回买前主链路
- `routes/copyTrade.ts` 与 `skills/CopyTradeSkill/tools/copyTradeTools.ts` 在 config 写入后同步失效索引
- list-time quarantine 也会同步失效对应 target-wallet 索引

## Boundary Correction

修正后的 owner 边界：

- `webhook ingress`
  - 只负责 evidence ingress 和 enqueue
- `config index`
  - 负责 `targetWallet -> configs[]`
- `buy hot path`
  - 只消费 index 结果，不重建 follower context
- `async / write path`
  - 负责在配置变更时失效 read-side index

## Verification

- `npx tsc --noEmit`
  - 通过

## Document Provenance

- Source: `/Users/almurat/KiKo/system-journal/design-language/copytrade-buy-hot-path-refactor-todo.md`
- Kind: repo doc
- Retrieved: 2026-04-14
- Applied To: 将 config resolution 从重复事件路径迁出，建立 config-index-first 热路径
- Verification: verified in code design review

- Source: `/Users/almurat/Downloads/logs.1776159582066.json`
- Kind: runtime observation
- Retrieved: 2026-04-14
- Applied To: 证明 buy hot path 在 send 前存在不应同步保留的准备阶段
- Verification: verified in runtime log analysis
