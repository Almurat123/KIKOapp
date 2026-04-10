# 2026-04-10 X Expired Bot Token Hard Fail

## Root Cause

`x:webhook:ensure` 和运行时 X 出站层在读取 bot OAuth2 token 时，会优先尝试 refresh，但 refresh 失败后仍然会静默回落到旧 token。

当数据库中的 `expiresAt` 已过期时，这会把真实问题伪装成：

- `POST /2/activity/subscriptions -> 401 Unauthorized`
- DM 出站偶发 `401 Unauthorized`

而不是明确暴露：

- `X_CLIENT_ID / X_CLIENT_SECRET` 缺失
- refresh token 缺失
- OAuth2 refresh 本身失败

## Correction

- `xCredentialsService.refreshXBotAccessToken`
  - 新增 `requireFresh`
  - token 已过期且无法 refresh 时，直接抛出明确错误
- `xApiClient`
  - 运行时请求不再默默复用过期 token
- `x:webhook:ensure`
  - 创建 Activity subscription 前要求拿到 fresh bot token
- `x:webhook:diagnose`
  - 显示 OAuth2 refresh 结果，不再把 refresh 失败吞掉

## Target Behavior

- bot OAuth2 token 一旦过期，系统必须明确告诉 operator 根因
- operator 脚本不能再把过期 token 伪装成上游 Activity API 的普通 401
- 运行时出站和运维脚本使用同一套“fresh token or fail”规则

## Document Provenance

- Source: X Activity API docs (`GET /2/activity/subscriptions`, `POST /2/activity/subscriptions`)
- Kind: official API doc
- Retrieved: 2026-04-10
- Applied To: 区分 list/create 认证边界后，继续收敛 401 的 owner
- Verification: partially verified against runtime

- Source: production database `x_oauth_credentials`
- Kind: runtime observation
- Retrieved: 2026-04-10
- Applied To: 确认 bot OAuth2 token `expiresAt` 已经过期
- Verification: verified in runtime

