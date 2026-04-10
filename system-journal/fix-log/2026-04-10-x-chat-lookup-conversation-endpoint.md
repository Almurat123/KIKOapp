# 2026-04-10 X Chat Lookup Conversation Endpoint

## Root Cause

生产环境已经确认：

- `chat.received` webhook 事件会成功投递到 `xWebhook`
- 事件随后进入 `xIngressWorker`
- 但正文 lookup 仍然返回空，日志表现为：
  - `[X] chat lookup returned no readable text`
  - `missing_dm_text:<eventId>`

运行日志里的 `dmConversationId` 是冒号格式：

- `1920347546704097280:2038547191875211264`

这类 XChat `conversation_id` 不能直接等同为 DM lookup 文档里的
`dm_conversation_id`。旧实现把它作为强过滤条件去筛 `/2/dm_events`，
会把本来可读的消息正文过滤掉。

## Correction

- `xApiClient.lookupDirectMessageText`
  - 主路径改为优先调用：
    - `GET /2/dm_conversations/with/:participant_id/dm_events`
  - 只把 webhook 里的 `sender_id` 当作一对一 conversation participant
  - 只有拿不到可读文本时，才退回全量 `GET /2/dm_events`
- `xApiClient`
  - 新增 `fetchDirectMessagesForParticipant`
  - 对 `dmConversationId` 增加格式判断
  - 只有文档定义的 `dm_conversation_id` 才作为强过滤键

## Target Behavior

- `chat.received`
  - webhook 只负责通知
  - 正文主路径通过一对一 DM conversation lookup 获取
- `dm.received`
  - 仍然直接使用 webhook 明文正文
- XChat 冒号 `conversation_id`
  - 只作为辅助线索，不再阻断正文读取

## Document Provenance

- Source: X Direct Messages API docs (`Get DM events`, one-to-one DM conversation lookup)
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: 确认一对一会话读取应优先按 participant_id 走 conversation endpoint
- Verification: partially verified

- Source: production logs `logs.1775806776370.json`
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: 确认 `chat.received` 事件到达后，旧全量 `/2/dm_events` lookup 仍返回空
- Verification: verified in runtime
