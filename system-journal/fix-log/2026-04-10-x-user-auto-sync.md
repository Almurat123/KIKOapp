# 2026-04-10 X User Auto Sync

## Root Cause

生产上的 X 用户绑定一直停留在“前端登录后由 `XContext` 触发 `/api/users/x/sync`”这一条窄路径。

这有两个问题：

1. 前端副作用没有服务端兜底，任何一次静默失败、未触发或未命中 `linkedAccounts` 都会让 `User.xUserId` 永远为空。
2. 后端 `/api/users/x/sync` 对所有情况都要求 embedded wallet，导致已经注册过的用户也可能因为钱包条件而无法只做 X 绑定落库。

## Correction

将“验证 Privy 已绑定的 X 账号并写入 `User`”收口到服务端 owner 层：

- `xIdentityService` 新增 `syncVerifiedPrivyXUser`
  - 已存在 `User` 时，直接更新 `xUserId/xUsername/xLinkedAt`
  - 仅在首次创建 `User` 时要求 embedded wallet
- `auth` 中间件新增 `maybeAutoSyncVerifiedPrivyXUser`
  - 每次真实终端用户请求完成鉴权后，做一次低频率、失败不阻塞的自动修复
- `/api/users/x/sync` 改为直接复用服务端 helper
  - 不再复制一套会与 owner 层漂移的同步逻辑

## Target Behavior

- 用户只要已经在 Privy 侧完成 X linked account，后端就应该能在后续认证请求中自动修复 `User.xUserId`
- 已有 KIKO 用户不应再因为“没有再走一次钱包创建流程”而被卡住 X 绑定
- 未完成 Privy X linked account 的用户，仍然会落在引导绑定分支

## Do Not Regress

- 不要再信任前端 body 提供的 `xUserId`
- 不要把“已有用户更新 X 绑定”和“首次创建用户需要钱包”混成同一条硬门槛
- 不要把这层正确性继续押在前端副作用上
