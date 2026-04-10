# 2026-04-10 X DM Outbound Only

## Root Cause

生产环境已经确认：

- webhook 能收到 `chat.received`
- 但公开 DM lookup 接口拿不到可读正文
- 本地使用生产库、生产 bot token、真实事件 ID 复测后仍然无法取回文本

这意味着 X 私信在当前公开 API 能力下，不适合作为 KIKO 的入站会话面。

## Correction

- `xApiClient`
  - 删除 inbound DM 正文 lookup 相关实现
  - 保留 mention 读取与 outbound `sendDirectMessage`
- `xIngressWorker`
  - 移除 inbound DM/chat 处理、轮询、恢复
  - 只保留 mention 入站
- `xWebhook`
  - 继续记录 DM/chat 到达审计
  - 但不再把它们送入内部聊天链路
- `x:webhook:ensure`
  - 改为删除现有 `dm.received/chat.received/dm.sent/chat.sent` subscriptions
  - 不再创建新的 inbound DM/chat 订阅

## Target Behavior

- X 渠道：
  - 支持 outbound DM
  - 支持 mention 入站
  - 不支持 inbound DM/chat 正文对话
- operator 运行 webhook ensure 后：
  - webhook 仍保留
  - DM/chat activity subscriptions 被清理掉

## Cost Boundary

- 不再为 inbound DM/chat 事件持续付费和消耗 usage
- 仅保留必要的 webhook / mention / outbound DM 成本

## Document Provenance

- Source: X Activity API docs
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: 确认 `chat.received` 属于 Activity 事件，但文档未给出可读正文路径
- Verification: partially verified

- Source: X Direct Messages lookup docs
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: 验证公开 lookup 接口边界
- Verification: partially verified

- Source: production logs + local probes against production DB and tokens
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: 确认 inbound XChat 事件到达后仍无法获取可读正文
- Verification: verified in runtime
