# 2026-04-10 X Webhook Empty Payload Audit

## Root Cause

生产日志已经证明 X webhook 请求能到达服务端，但某些请求会被解析成：

- `mentionCount = 0`
- `dmCount = 0`
- `acceptedCount = 0`

这说明问题边界已经从“X 没有投递”收窄到“我们没有识别出当前 payload 里的真实事件”。

## Correction

- 在 `xWebhook` 的空事件分支增加结构化审计日志：
  - 顶层键名采样
  - `data` 类型与元素数量
  - `event_type` 采样
  - 首个 activity payload 的键名采样
  - 原始 body 字节数

日志仍然不记录 DM/tweet 正文。

## Target Behavior

- 下一次 X 把无法识别的 payload 投过来时，日志应直接说明：
  - 是不是新 envelope
  - `event_type` 叫什么
  - 内容落在哪些键名下
- 后续修 parser 时，不再需要盲猜字段名。

## Document Provenance

- Source: latest production runtime logs
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: 判断问题已从“未投递”收窄到“空解析”
- Verification: verified in runtime

- Source: X Activity API webhook behavior already observed in production
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: 保留 legacy + modern envelope 并增加空 payload 结构审计
- Verification: partially verified in runtime

