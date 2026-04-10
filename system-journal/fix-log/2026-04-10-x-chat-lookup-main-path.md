# 2026-04-10 X Chat Lookup Main Path

## Root Cause

生产日志已经确认：

- webhook 能收到新事件
- 事件类型是 `chat.received`
- payload 只有：
  - `conversation_token`
  - `encoded_event`
  - `message_event_signature`
  - 以及 conversation/sender 元数据

这类事件不是明文 DM 正文，不能再按旧 `text` 字段解析。

## Correction

- `xWebhook`
  - `chat.received` 不再因为没有 `text` 被丢弃
  - 改为产出一个 `requiresLookup=true` 的 DM 事件
- `xIngressWorker`
  - 在业务处理前，如果事件 `requiresLookup`
  - 直接用 bot OAuth2 token 走 `GET /2/dm_events`
  - 以 sender/conversation/created_at 为约束补拉最新可读正文
- `xApiClient`
  - 新增 DM 文本 lookup 能力
  - `dm.received` 继续零额外请求
  - 只有 `chat.received` 触发最小化 lookup

## Target Behavior

- 明文 `dm.received`
  - 直接进入聊天链路
- 加密 `chat.received`
  - webhook 只做通知
  - 正文以 DM lookup 为主路径获取

## Cost Boundary

- 这会增加 X API usage
- 但只对 `chat.received` 增加一次 lookup
- 不对所有 DM 统一双查

## Document Provenance

- Source: X Activity Introduction
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: 确认 `chat.received` 属于当前 Activity 事件族
- Verification: partially verified

- Source: production webhook ingress logs
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: 确认 `chat.received` 实际投递到生产，且 payload 只有加密 envelope
- Verification: verified in runtime

