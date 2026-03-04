# CopyTrade V2 CT-001..CT-136 Plan Register

This register is the durable mapping file for context compression safety.
Every copytrade-v2 PR must reference one or more CT IDs from this file.

## Current Build Scope (2026-03-04)
- V2 contracts + mode policy + lifecycle state machine wired.
- Runtime entry switched to v2 orchestrator.
- Trading flow now chain-routed (EVM/Solana executors) without runtime dependency on `legacyExecutor`.
- Data flow tables + migration + migration/validation scripts landed.
- Runtime hotfix controls landed (`GLOBAL_FREEZE`, `EXIT_ONLY`, `FORCE_MODE`).
- Legacy `src/services/copytrade` logic has been migrated into `src/services/copytrade-v2/*`.
- All runtime/service/test imports have been switched from `copytrade/*` to `copytrade-v2/*`.
- Legacy `src/services/copytrade` directory has been removed (v2 is now the only active copytrade implementation).
- CT 全量治理目录已代码化：`governance/ct136Catalog.ts`（136 条逐条可枚举，含重现场景、约束、跨流关联）。
- CT 链接器已接入订单流/交易流/数据流：`governance/ct136Linker.ts` + orchestrator/outcomeMapper/eventStore/executionRecorder。
- 自动校验已落地：`__tests__/ct136Governance.test.ts`（136 覆盖、reasonCode 全覆盖、关联图完整性）。
- 批量重放引擎已落地：`governance/ct136Reproduction.ts` + `__tests__/ct136Reproduction.test.ts` + `scripts/replayCt136Reproduction.ts`。
- `npm run -s test:ct136-replay` 当前结果：136/136 可重放并命中对应 CT 链接。
- 修复低置信度语义漂移：`strictRiskChecks` 下保留 `validation_low_confidence` reasonCode，避免被 `quarantined_policy` 覆盖。

## Current Execution Delta (2026-03-05)
- `CT-001..CT-012`、`CT-047..CT-052`、`CT-093..CT-100`：`in_progress`
  - 已落地 `ChainIdentityNormalizer` 并替换 copytrade-v2 + queue/pending 关键路径手写 `toLowerCase`。
  - Solana 地址大小写保真；EVM 维持归一化。
- `CT-019..CT-036`、`CT-065..CT-076`、`CT-101..CT-112`：`in_progress`
  - 已落地 `TxFinalityBridge` + `CopytradeTxFinalityEvent` 消费回写。
  - 受理后异步终态可回推到订单状态机（success/failed/uncertain）。
- `CT-013..CT-030`、`CT-053..CT-064`、`CT-113..CT-122`：`in_progress`
  - 已落地买入落仓桥：`BUY_ACCEPTED` 建 pending，finality success promote `open`，failed 标记失败并取消 pending lot。
- `CT-025..CT-036`、`CT-081..CT-092`、`CT-119..CT-128`：`in_progress`
  - 已落地 copytrade-v2 统一 DM 事件发布器，覆盖 `BUY_ACCEPTED/BUY_CONFIRMED_OPEN/EXIT_SUBMITTED/EXIT_CONFIRMED_CLOSED/EXECUTION_FAILED/SKIPPED`。
- `CT-059..CT-064`、`CT-133..CT-136`：`in_progress`
  - 已补 `MainSwapService.collectDirectSwapFee*` 对 `sourceTxHash` 的透传，避免 fee 幂等键静默降级。

> 注：上述范围是“代码已接入并通过现有单测+编译”，尚未进入全量 `closed`，需要补齐每条 CT 的三证据（测试断言、线上日志样本、指标前后对比）。

## Status Legend
- `open`: not fully fixed
- `in_progress`: code changes landed, waiting evidence
- `closed`: fixed with proof (test + log sample + metric delta)

## Machine-Readable Source Of Truth
- `src/services/copytrade-v2/governance/ct136Catalog.ts`
- `src/services/copytrade-v2/governance/ct136Linker.ts`
- `src/services/copytrade-v2/governance/ct136Reproduction.ts`
- `src/services/copytrade-v2/__tests__/ct136Governance.test.ts`
- `src/services/copytrade-v2/__tests__/ct136Reproduction.test.ts`

The markdown table below is retained for readability, but execution truth is now governed by the catalog code above.

## CT Register
| ID | Flow | Mode Scope | Title | Status |
| --- | --- | --- | --- | --- |
| CT-001 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-002 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-003 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-004 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-005 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-006 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-007 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-008 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-009 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-010 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-011 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-012 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-013 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-014 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-015 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-016 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-017 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-018 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-019 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-020 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-021 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-022 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-023 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-024 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-025 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-026 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-027 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-028 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-029 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-030 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-031 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-032 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-033 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-034 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-035 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-036 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-037 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-038 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-039 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-040 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-041 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-042 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-043 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-044 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-045 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-046 | order-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-047 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-048 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-049 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-050 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-051 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-052 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-053 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-054 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-055 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-056 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-057 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-058 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-059 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-060 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-061 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-062 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-063 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-064 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-065 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-066 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-067 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-068 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-069 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-070 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-071 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-072 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-073 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-074 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-075 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-076 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-077 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-078 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-079 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-080 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-081 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-082 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-083 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-084 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-085 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-086 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-087 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-088 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-089 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-090 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-091 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-092 | trading-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-093 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-094 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-095 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-096 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-097 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-098 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-099 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-100 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-101 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-102 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-103 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-104 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-105 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-106 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-107 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-108 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-109 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-110 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-111 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-112 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-113 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-114 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-115 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-116 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-117 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-118 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-119 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-120 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-121 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-122 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-123 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-124 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-125 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-126 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-127 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-128 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-129 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-130 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-131 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-132 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-133 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-134 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-135 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
| CT-136 | data-flow | turbo/normal/safety | TODO: fill concrete fault statement | open |
