# 2026-04-10 X Webhook Ingress Audit

## Root Cause

生产上出现“用户发了新的 X DM，但系统既没有新事件入库，也没有新回复”的情况时，现有日志只能看到后置失败，无法第一时间判断：

- X 平台是否真的把事件投递到了 webhook
- 还是 webhook 已收到，但我们在解析或入队阶段失败

## Correction

在 `xWebhook` owner 层增加最小原始入站审计日志：

- `"[X] webhook ingress received"`
  - 记录 `forUserId`
  - 记录 mention/dm 数量
  - 记录事件 id 与 sender/author id 采样
- `"[X] webhook ingress enqueued"`
  - 记录解析后的总数与最终 accepted 数

不记录 DM 正文或 tweet 文本，避免敏感内容进入日志。

## Target Behavior

下次测试 X DM 或 mention 时，Railway 日志应该能立刻回答三件事：

1. X 有没有把 webhook 打到我们的服务
2. webhook 里有没有解析出 DM / mention
3. 我们最终是否把这些事件成功入队

## Do Not Regress

- 不要在 webhook 审计日志里打印完整 DM/tweet 正文
- 不要把“是否收到 webhook”这种基础可观测性只留给数据库侧推断
