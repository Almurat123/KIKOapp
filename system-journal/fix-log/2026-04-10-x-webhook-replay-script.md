# 2026-04-10 X Webhook Replay Script

## Root Cause

在 webhook valid、subscription valid、OAuth1/OAuth2 都正常的情况下，新的 X DM 仍然可能没有进入 `x_event_logs`。

这时单靠本地代码已经无法继续收敛问题，需要一个平台侧验证动作：

- 向 X 请求 replay 历史活动
- 看 X 是否会重新把过去事件投递到我们的 webhook

## Correction

新增 `x:webhook:replay`：

- 通过 `X_APP_BEARER_TOKEN` 调用 replay job 接口
- 复用当前 callback URL 对应的 webhook id
- 默认重放一个安全的 UTC 时间窗，结束时间比当前晚 31 分钟以前
- 允许 operator 通过 `from_date=YYYYMMDDHHmm to_date=YYYYMMDDHHmm` 覆盖窗口

## Target Behavior

当实时投递存疑时，operator 可以直接触发 replay：

1. 若 replay 后 webhook ingress 日志出现
   - 说明平台实时投递存在漂移，但 webhook 接收端正常
2. 若 replay 后仍然完全没有 ingress 日志
   - 问题就在 X 平台投递侧或 replay job 本身

## Do Not Regress

- 不要把 replay 能力混进常规 webhook ensure 脚本
- 不要默认重放过近的时间窗
- 不要在 replay 脚本里修改 webhook 或 subscription 状态
