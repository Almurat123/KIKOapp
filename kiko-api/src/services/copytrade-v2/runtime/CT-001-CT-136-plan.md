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
