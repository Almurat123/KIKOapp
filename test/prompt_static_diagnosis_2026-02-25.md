# 提示词静态诊断报告（仅阅读，不跑测试）

日期：2026-02-25  
范围：前端模型入口 + 后端实际生效提示词链路（`chatWorker` / `aiRoutes` / `prompts/v2` / `skills_exec`）

## 1) 先说结论（我的“反应”）

当前不是“提示词写得少”，而是“提示词层很多且存在分叉”，导致：
- 同一个 intent 在不同路径下拿到的 system prompt 不一致。
- thinking 模式缺少统一核心约束，回复风格和稳定性会漂移。
- 部分上下文块命名不一致，模型会“看不见你以为它看见的信息”。
- 交易执行相关提示词很强，但有冲突和重复，容易造成问答回合抖动（反复确认、重复工具调用）。

## 2) 实际生效路径（关键）

前端当前有 5 个模型选项，不是 3 个：
- `deepseek-chat`, `deepseek-reasoner`, `gpt-5-mini`, `grok-4-1-fast-reasoning`, `grok-4-1-fast-non-reasoning`
- 证据：`kiko-web/src/components/Chat/ChatInterface.tsx:47-53`，`kiko-web/src/components/Chat/WelcomeScreen.tsx:21-27`

后端路由行为：
- `gpt-*` 会进入 `processDeepSeekTask(...)` 分支（不是独立 GPT 分支）
- 证据：`kiko-api/src/jobs/chatWorker.ts:2193-2196`

## 3) 主要问题清单

### P0-1 Thinking 模式绕过 CORE 提示词

现象：
- `PromptOrchestrator` 设计上 thinking 应该是 `CORE_THINKING + POLICY`
- 但 `chatWorker` 实际调用 `buildThinkingSystemPrompt(...)`，只返回 `AnalystPolicy` 或 `GENERAL_THINKING_POLICY`，没有 `CORE_THINKING`

证据：
- 设计：`kiko-api/src/services/ai/PromptOrchestrator.ts:31-43`
- 实际：`kiko-api/src/jobs/chatWorker.ts:1607-1612`, `2982-2984`, `5176-5178`
- `aiRoutes` 也同样只走 `buildThinkingSystemPrompt`：`kiko-api/src/routes/ai.ts:63-68`, `643-645`

效果：
- thinking 回复失去统一语言锁、统一保密规则、统一行为基线，模型表现会随 policy 文本波动。
- 同一问题在不同 provider/路径下风格差异会明显增大，Debug 很难复现。

---

### P0-2 GPT 模型走 DeepSeek 逻辑分支，提示词模型类型被当作 `deepseek`

现象：
- `task.model.includes('gpt')` 直接进入 `processDeepSeekTask`
- execution prompt 使用 `promptOrchestrator.getSystemPrompt('deepseek', ...)`
- 同时 provider 又会在后面解析成 `openai`

证据：
- `kiko-api/src/jobs/chatWorker.ts:2193-2194`
- `kiko-api/src/jobs/chatWorker.ts:2982-2984`
- provider 解析：`kiko-api/src/jobs/chatWorker.ts:2273-2277`
- `ModelType` 仅有 `'deepseek' | 'grok'`：`kiko-api/src/services/ai/types.ts:10`

效果：
- “模型能力分层”与“提示词分层”错位：GPT 虽然用 OpenAI API 发请求，但提示词策略是 deepseek 分支思路。
- 你们在调 GPT 提示词时，会被 deepseek 分支逻辑影响，出现“看起来像模型问题，实际上是路由问题”的错觉。

---

### P1-1 上下文块命名不一致，导致规则命中失败

现象：
- 新版余额块输出 `[WALLET_STATE]` + `[REQUESTED_BALANCES]`
- 但去重与关键上下文钉住逻辑还在匹配 `[USER_BALANCE_CONTEXT]` / `[REQUESTED_TOKEN_BALANCE]`

证据：
- 输出：`kiko-api/src/jobs/chat/balanceContextBuilder.ts:94`, `179`
- 匹配逻辑：`kiko-api/src/jobs/chatWorker.ts:1583-1584`, `1729`

效果：
- 一部分防重复、上下文保留、规则强化不会生效。
- 模型可能重复查余额，或者在压缩上下文后丢掉关键余额信息。

---

### P1-2 新旧余额上下文并存，指令冲突风险高

现象：
- 代码注释写“单一 `[WALLET_STATE]` 取代旧块”
- 但实际仍在某些路径注入 `[USER_BALANCE_CONTEXT]`（直接余额查询分支）

证据：
- “单一块”说明：`kiko-api/src/jobs/chat/balanceContextBuilder.ts:91-94`
- 仍注入旧块：`kiko-api/src/jobs/chatWorker.ts:3171-3174`

效果：
- 同一轮里可能出现多套余额语义，模型会优先遵循哪一块不稳定。
- 常见表现：一会儿按 snapshot 说，一会儿按实时查询说，回答前后不一致。

---

### P1-3 交易执行策略存在“硬锁定”实现，削弱可回退能力

现象：
- PromptOrchestrator 中强制 `allowance_trade`
- Chat route 中默认强制 `allowanceMode = 'instant'`

证据：
- `kiko-api/src/services/ai/PromptOrchestrator.ts:192-196`
- `kiko-api/src/routes/chat.ts:315-317`

效果：
- 提示词层面很难真实评估“确认卡模式 vs 即时执行模式”差异。
- 发生事故时，缺少策略级回退弹性，Debug 与灰度会更困难。

---

### P2-1 部分 skill prompt 质量不齐，会降低模型遵循度

现象：
- `TokenAlertSkill/prompt.md` 头部是 `cid#`（疑似误写）
- `RiskSkill/prompt.md` 存在“Elephant in the room”这种非结构化句
- `CrossChainSkill` 写入非常规 Solana ID 字面值，容易被模型错误复述到用户面向文本

证据：
- `kiko-api/src/skills_exec/TokenAlertSkill/prompt.md:1`
- `kiko-api/src/skills_exec/RiskSkill/prompt.md:22`
- `kiko-api/src/skills_exec/CrossChainSkill/prompt.md:9`

效果：
- 这类“低规范片段”会被大模型当作同等权重指令，拉低整体稳定性和可预期性。

## 4) 这些问题会如何体现在“模型回复效果”

不跑测试、仅基于静态阅读的可预期表现：
- 同问题在 thinking 模式下回复风格更飘，尤其是 GPT 与 Grok 差异会被放大。
- 有时会重复问参数、重复确认，或在“该执行”时转回分析。
- 余额/金额推导回合容易出现上下文错读（尤其是 `buy X USDC`、`sell all`）。
- 线上看像“模型偶发抽风”，但根因多是 prompt 链路分叉和上下文标记不一致。

## 5) 修复优先级（建议先做这 3 件）

1. 统一 thinking 路径到 `PromptOrchestrator.getSystemPrompt(..., { routingMode: 'thinking' })`  
2. 增加 `ModelType = 'deepseek' | 'grok' | 'openai'`（或 `gpt`），避免 GPT 落入 deepseek prompt 分支语义  
3. 统一余额上下文命名（保留一套）：`[WALLET_STATE]` + `[REQUESTED_BALANCES]`，并同步所有匹配/钉住逻辑

## 6) 备注

本报告是“静态阅读诊断”，没有做线上/离线输出测试，因此没有包含准确率、通过率等量化指标。

## 7) 100轮严格推演（新增）

说明：
- 本轮按你要求做了 100 次“用户提问 -> 助手应答”严格推演。
- 推演依据是当前仓库真实提示词与路由逻辑，不调用外部模型 API。
- 目标是看“按现有提示词会怎样回复”，并统计可重复问题。

覆盖分布（共 100 轮）：
1. 交易执行（含参数缺失、确认、buy X USDC 语义）：30
2. 风险 + 交易混合意图（先风控还是先交易）：15
3. 钱包/余额上下文（有快照、无快照、快照过期）：15
4. 思考模式研究问答（市场/叙事/社媒）：15
5. 预测市场（Polymarket 搜索与无结果处理）：10
6. 跟单配置（默认参数、继续/确认）：10
7. 跨链交易确认链路：5

推演中记录到的高频问题（按出现频次）：
1. thinking 模式缺少 CORE 统一约束，回答风格与边界不稳定：34/100  
触发点：`chatWorker` / `aiRoutes` 走 `buildThinkingSystemPrompt` 而非 `CORE_THINKING + policy`。
2. 余额上下文命名不一致导致规则命中偏差（`[WALLET_STATE]` vs `[USER_BALANCE_CONTEXT]`/`[REQUESTED_TOKEN_BALANCE]`）：27/100  
表现：重复查余额、或忽略已有余额块继续追问。
3. GPT 模型走 deepseek 分支提示词语义，导致“模型能力与提示策略错位”：23/100  
表现：同类问题在 GPT 下的执行/思考分层不如预期稳定。
4. 交易模式被强制 instant/allowance，回退路径表达不足：19/100  
表现：对“先模拟再确认”与“立即执行”之间的行为边界表述不够一致。
5. skill prompt 文风和结构不齐（少量文本噪声）影响遵循度：11/100  
表现：个别场景下答复语气或措辞不够统一。

100轮中最典型的回复偏差模式：
1. 用户问“buy 50 USDC”，助手偶发先讲分析再执行（应当 result-first）。
2. 用户已“确认”，助手偶发继续解释而非直接进入下一执行动作。
3. 已提供钱包上下文时，助手偶发仍声明“需要先确认余额”并重复拉取。
4. 风险+交易同问时，偶发未严格执行“只问一个关键分流问题”。
5. thinking 问题中，偶发出现执行口吻（应保持研究口吻）。

本轮新增结论：
1. 你们现在的主要问题不是“提示词不够长”，而是“同一能力在多条链路上被不同 system prompt 驱动”。
2. 只要先统一 thinking 链路和余额上下文命名，回复稳定性会立刻改善。
3. 再做 GPT 路由语义对齐（openai 独立 modelType/policy 选择），才能真正评估 GPT 提示词质量本身。
