# 2026-04-10 X Activity API Migration

## Root Cause

X 官方最新文档已经把实时活动订阅主路径切到 `X Activity API`：

- `POST /2/activity/subscriptions`
- `GET /2/activity/subscriptions`

但仓库里的 operator 脚本和 webhook 解析仍然围绕旧的 `account_activity` 订阅路径与旧 webhook 负载模型。

这会导致：

- 控制台 UI、旧接口检查结果、真实投递行为之间互相冲突
- DM/Chat 事件在平台切换负载模型后无法稳定进入系统

## Correction

- `x:webhook:ensure`
  - 改为确保最新 `X Activity` 私有事件订阅
  - 当前默认订阅：
    - `dm.received`
    - `chat.received`
- `x:webhook:diagnose`
  - 改为直接读取 `/2/activity/subscriptions`
  - 不再把旧 `subscriptions/all` 当主诊断依据
- `x:webhook:replay`
  - 改为使用当前 `POST /2/webhooks/replay`
- `xWebhook`
  - 同时解析：
    - 旧 `direct_message_events/tweet_create_events`
    - 新 `data.event_type + payload` Activity envelope

## Target Behavior

- 平台即使在 DM 与 Chat 事件上切换投递模型，服务端也能继续接住
- operator 看到的订阅状态，应以最新 `activity` 接口为准
- 旧路径只做兼容，不再作为主真相来源

## Do Not Regress

- 不要再把旧 `account_activity` 订阅结果当成唯一真相
- 不要让 webhook 解析只识别 `direct_message_events`
- 不要继续把 posts/mentions 与 X Activity 的私有消息事件混成同一条文档边界
