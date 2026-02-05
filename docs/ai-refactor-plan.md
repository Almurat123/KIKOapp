# AI 链路重构评估与计划（合并版）

## 结论
需要重构。当前系统多入口、多版本提示词、重复意图/工具路由并存，导致不可预测、难迭代、难维护。目标是“单一真理源 + 双模式 + 最小注入面”。

## 统一双模式架构设计（核心目标）
### 模式定义
1. **执行模式（Execution）**
   - 仅依赖 `skills` → `tools` 进行操作。
   - 由 `PromptOrchestrator` 生成严格执行提示词。
   - 仅开放与意图匹配的工具集合（Skills Gating 为唯一决策来源）。

2. **思考模式（Thinking）**
   - 仅提供最小引导与工具白名单（例如查询类工具）。
   - 不注入执行型指令，不引导调用交易工具。
   - 允许模型发挥本体能力，同时被安全与上下文约束。

### 运行逻辑（统一链路）
1. 用户消息进入后端 `ChatWorker`。
2. 统一意图解析 → 进入 Execution / Thinking。
3. 统一构建 System Prompt（唯一入口）。
4. 根据模式生成工具集（Skills Gating / 白名单）。
5. 注入结构化上下文（代币信息、钱包余额、链信息），禁止非结构化页面注入。

## 主要问题（已扩展定位）
1. **多入口与重复链路**
   - 前端与后端各自 intent 解析、系统 prompt 拼接。
   - WS 任务链路与 API 代理链路并行，行为不一致。

2. **提示词分散、规则冲突**
   - 前端 / 后端 / Python 均有 prompt，互相覆盖。
   - 多处硬编码规则导致模型被“多头指挥”。

3. **工具路由与技能体系重复**
   - ToolPreRouter + Skills Gating + Allowlist 并存，冲突不可控。

4. **错误注入/错误引导路径**
   - System injection、fallback 文案、tool result 拼接过多，导致模型误导。

5. **边界条件分散**
   - Launchpad 风险扫描、Fast swap、模拟报价等规则散落多处。

## 重构目标（单一真理源）
1. **单一入口**：所有模型调用只走 `ChatWorker` + `PromptOrchestrator`。
2. **单一 Prompt**：后端唯一生成提示词，前端不拼接。
3. **单一 Tool 路由**：仅保留 Skills Gating（唯一决策来源）。
4. **最小注入面**：上下文只允许结构化数据块。
5. **可配置化**：模式、工具白名单、注入白名单统一配置。

## 删除清单（必须删除，标注级别）
### 强制删除（直接删除）
- 前端意图解析（避免与后端冲突）：
  - [kiko-web/src/services/intentParser.ts](kiko-web/src/services/intentParser.ts)
- 前端 prompt 拼接与规则源（后端唯一来源）：
  - [kiko-web/src/config/aiPrompts.ts](kiko-web/src/config/aiPrompts.ts)
- ToolPreRouter 决策层（保留 skills gating）：
  - [kiko-api/src/services/ai/toolPreRouter.ts](kiko-api/src/services/ai/toolPreRouter.ts)
- Python Grok prompt 模块（仅保留模型通信与工具执行）：
  - [kiko-python/grok/prompts.py](kiko-python/grok/prompts.py)

### 强制清理（删除调用/引用）
- 前端 `aiService` 中的本地 prompt 组装与本地 intent：
  - [kiko-web/src/services/aiService.ts](kiko-web/src/services/aiService.ts)
- Grok Python 中可能存在的 prompt fallback 逻辑：
  - [kiko-python/grok/router.py](kiko-python/grok/router.py)

### 保留但收敛（唯一真理源）
- Prompt 统一入口：
  - [kiko-api/src/services/ai/PromptOrchestrator.ts](kiko-api/src/services/ai/PromptOrchestrator.ts)
- Skills 作为唯一工具来源：
  - [kiko-api/src/skills/registry.ts](kiko-api/src/skills/registry.ts)
- Intent 后端唯一解析：
  - [kiko-api/src/services/ai/intentParser.ts](kiko-api/src/services/ai/intentParser.ts)
- 单一运行链路：
  - [kiko-api/src/jobs/chatWorker.ts](kiko-api/src/jobs/chatWorker.ts)

## 问题附录（冲突点与注入面）
1. **前端/后端意图解析冲突**：导致路由不一致。
2. **Prompt 多头来源**：前端、后端、Python 各自维护。
3. **工具路由冲突**：ToolPreRouter 与 Skills Gating 互相覆盖。
4. **上下文注入面过大**：非结构化内容进入系统块。
5. **Fast Swap 旁路**：绕过工具链，风险不可控。

## 迁移顺序与里程碑
### 阶段 1：冻结与统一入口（无行为变更）
- 固化 PromptOrchestrator 为唯一 prompt 入口。
- 固化后端 intent parser 为唯一解析。

### 阶段 2：合并与去重（行为一致）
- 删除前端 prompt 与 intent 解析。
- 删除 ToolPreRouter 决策层。
- 删除 Python prompt 模块。

### 阶段 3：模式收敛与白名单化
- Execution 只允许 Skills 工具。
- Thinking 仅允许白名单工具。
- 结构化上下文注入白名单生效。

## 设计规范（提示词架构师视角）
1. **Prompt 单一来源**：所有模型仅接收后端系统 prompt。
2. **上下文与用户输入严格隔离**：上下文块结构化，禁止混入自然语言指令。
3. **工具权限最小化**：按模式和 skills 精确授权。
4. **严格 stop 条件**：执行模式必须在参数完整后立即行动或询问一次。
5. **禁止多头注入**：任何 fallback/system injection 需统一入口维护。

## 下一步
按上述清单执行删除与合并，并完成统一双模式运行链路。
