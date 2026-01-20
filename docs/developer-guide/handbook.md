# KIKO Developer Handbook

> 本文档供本地 LLM 和工程人员使用，作为项目的长期知识库。  
> 文档基于真实代码结构，不确定处标注 `NEED CONFIRM`。

---

## 1. Repo Overview

### 项目总体目的

KIKO 是一个 Web3 AI 交易助手平台，通过自然语言聊天界面统一所有 Web3 操作。核心定位：**系统提供信息与辅助，不替用户做决策**。

### 三个服务职责

#### Frontend (`kiko-web/`)
- **技术栈**: React 19 + TypeScript + Vite + Tailwind CSS
- **端口**: 5173 (开发), 生产环境通过 Docker 部署
- **职责**:
  - 用户界面渲染（Chat / Swap / Wallet / Trade / Risk / News / Social）
  - WebSocket 客户端连接（实时消息流）
  - 钱包连接管理（Privy SDK）
  - API 调用封装（`src/services/`）
  - 状态管理（React Hooks + Context）

#### Backend (`kiko-api/`)
- **技术栈**: Node.js + TypeScript + Fastify + Prisma
- **端口**: 3001
- **职责**:
  - REST API 路由（`src/routes/`）
  - 业务逻辑服务（`src/services/`）
  - AI 任务调度（`src/jobs/chatWorker.ts`）
  - 数据库操作（Prisma ORM）
  - WebSocket 服务端（`src/services/chatWebSocket.ts`）
  - 后台任务（市场数据、代币数据、社交数据、持仓监控）

#### AI Service (`kiko-python/`)
- **技术栈**: Python + FastAPI + xAI SDK
- **端口**: 8000 (统一服务，子路径挂载)
- **职责**:
  - Grok AI 路由 (`/grok`) - 意图识别、工具调用、流式响应
  - RAG 知识库 (`/rag`) - 向量检索、文档索引
  - 内容审核 (`/moderation`) - 输入/输出内容安全检查

### 各仓库入口位置

```
/Users/almurat/KiKo/
├── kiko-web/
│   ├── src/
│   │   ├── App.tsx              # 前端入口，路由定义
│   │   ├── main.tsx             # React 应用启动
│   │   └── services/            # API 调用封装
│   └── package.json
├── kiko-api/
│   ├── src/
│   │   ├── index.ts             # Fastify 服务器入口
│   │   ├── routes/              # API 路由定义
│   │   ├── services/            # 业务逻辑服务
│   │   ├── jobs/                # 后台任务
│   │   └── db/                  # 数据库配置
│   └── package.json
└── kiko-python/
    ├── main.py                  # FastAPI 统一入口
    ├── grok/
    │   └── router.py            # Grok 服务路由
    ├── rag/
    │   └── router.py            # RAG 服务路由
    └── moderation/
        └── router.py            # 审核服务路由
```

### 每个目录大致职责

#### `kiko-api/src/`
- `routes/` - HTTP 路由处理器（Fastify 路由注册）
- `services/` - 业务逻辑层（AI 编排、交易执行、数据聚合）
- `jobs/` - 后台定时任务（市场数据、代币数据、社交数据、持仓监控）
- `repositories/` - 数据访问层（Prisma 查询封装）
- `middleware/` - 中间件（认证、限流、错误处理、追踪）
- `skills/` - AI Skills 定义（按意图分类的能力模块）
- `tools/` - AI Tools 定义（可被 LLM 调用的函数）
- `db/` - 数据库配置（Prisma schema、连接管理）
- `cache/` - 缓存层（Redis 客户端）
- `config/` - 配置管理（环境变量、日志注册表、提示词模板）
- `utils/` - 工具函数（日志、验证、清理）

#### `kiko-web/src/`
- `components/` - React 组件（Chat、Swap、Wallet、Trade 等）
- `pages/` - 页面组件（路由对应的完整页面）
- `services/` - 前端 API 服务（封装 HTTP/WebSocket 调用）
- `hooks/` - React Hooks（状态管理、副作用）
- `contexts/` - React Context（主题、认证状态）
- `utils/` - 工具函数（WebSocket 客户端、缓存、日志）

#### `kiko-python/`
- `grok/` - Grok AI 服务（工具定义、流式响应处理）
- `rag/` - RAG 服务（向量数据库、文档爬取、查询接口）
- `moderation/` - 审核服务（内容安全检查）

---

## 2. System Architecture

### 整体架构

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Frontend  │◄───────►│   Backend   │◄───────►│ AI Service  │
│  (React)    │  HTTP   │  (Fastify)  │  HTTP   │  (FastAPI)  │
│  Port 5173  │  WS     │  Port 3001  │         │  Port 8000  │
└─────────────┘         └─────────────┘         └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │  PostgreSQL │
                        │  Port 5432  │
                        └─────────────┘
                              │
                              ▼
                        ┌─────────────┐
                        │    Redis    │
                        │  Port 6379  │
                        └─────────────┘
```

### 服务之间如何通信

#### Frontend ↔ Backend
- **HTTP REST**: 前端通过 `src/services/api.ts` 调用后端 API
- **WebSocket**: 实时消息流通过 `/api/chat/ws` 连接
  - 前端: `src/utils/chatWebSocket.ts` (WebSocket 客户端)
  - 后端: `src/services/chatWebSocket.ts` (WebSocket 服务端)
- **认证**: Privy JWT Token (Bearer Token)

#### Backend ↔ AI Service
- **HTTP REST**: 后端通过环境变量 `GROK_SERVICE_URL` 调用 Python 服务
  - Grok 请求: `POST {GROK_SERVICE_URL}/grok/v1/chat/completions`
  - RAG 查询: `POST {RAG_SERVICE_URL}/rag/query`
  - 审核检查: `POST {MODERATION_SERVICE_URL}/moderation/check`
- **代理模式**: 后端 `src/routes/ai.ts` 提供统一 CORS 代理，前端不直接调用 Python 服务

#### Backend ↔ Database
- **Prisma ORM**: `src/db/prisma.ts` 提供类型安全的数据库访问
- **连接池**: Prisma 自动管理 PostgreSQL 连接池

#### Backend ↔ Redis
- **缓存客户端**: `src/cache/redis.ts` 提供 Redis 连接
- **用途**: API 响应缓存、会话状态、限流计数

### 哪些模块是"核心中枢"

#### 1. Chat Worker (`src/jobs/chatWorker.ts`)
- **职责**: 后台轮询 `AITask` 队列，处理 AI 对话任务
- **工作流程**: 轮询 → 解析意图 → 调用 AI → 执行工具 → 流式返回
- **关键依赖**: PromptOrchestrator、IntentParser、ToolRegistry、SkillRegistry

#### 2. Prompt Orchestrator (`src/services/ai/PromptOrchestrator.ts`)
- **职责**: 根据 Model + Intent 生成系统提示词
- **版本**: 支持 v1 (legacy) 和 v2 (新架构)
- **输入**: ModelType、IntentType、UserContext
- **输出**: 完整的系统提示词字符串

#### 3. Intent Parser (`src/services/ai/intentParser.ts`)
- **职责**: 将自然语言转换为结构化 Intent
- **策略**: 混合解析（规则层 → 轻量分类器 → AI 回退）
- **输出**: `ParsedIntent` (包含 highLevel + detailed)

#### 4. Tool Registry (`src/tools/registry.ts`)
- **职责**: 管理所有可被 LLM 调用的工具
- **注册**: 工具在 `src/tools/` 目录定义，通过 `index.ts` 统一注册
- **格式**: OpenAI Function Calling Schema

#### 5. Skill Registry (`src/skills/registry.ts`)
- **职责**: 管理 AI Skills（按意图分类的能力模块）
- **加载**: 自动扫描 `src/skills/` 目录，读取 `SKILL.md` 或 `skill.json` + `prompt.md`
- **匹配**: 根据 Intent 匹配对应的 Skills

#### 6. Chat WebSocket Service (`src/services/chatWebSocket.ts`)
- **职责**: 管理 WebSocket 连接，广播消息到前端
- **连接管理**: 按 userId 组织连接（一个用户可能有多个标签页）

---

## 3. Core Flows

### Chat Flow

**完整流程**:
```
用户输入消息
  ↓
POST /api/chat/sessions/:sessionId/messages
  ↓
创建 UserMessage + AssistantMessage (status: 'streaming')
  ↓
创建 AITask (status: 'queued')
  ↓
ChatWorker 轮询检测到新任务
  ↓
解析意图 (IntentParser)
  ↓
生成系统提示词 (PromptOrchestrator)
  ↓
调用 AI API (DeepSeek 或 Grok)
  ↓
处理工具调用 (ToolRegistry.execute)
  ↓
流式返回结果
  ↓
写入 MessageChunk 表
  ↓
通过 WebSocket 推送到前端
  ↓
更新 AssistantMessage (status: 'complete')
  ↓
更新 AITask (status: 'completed')
```

**关键文件**:
- 路由: `src/routes/chat.ts` (POST `/sessions/:id/messages`)
- 任务处理: `src/jobs/chatWorker.ts` (轮询 + 处理)
- WebSocket: `src/services/chatWebSocket.ts` (推送)

**数据流**:
- 输入: `{ content, model, walletAddress, chainId, toolConfig }`
- 中间状态: `AITask` 表记录任务状态
- 输出: `MessageChunk` 表存储流式内容块，WebSocket 实时推送

### Trade Flow

**完整流程**:
```
用户输入交易意图 ("用 100 USDC 买 DEGEN")
  ↓
IntentParser 解析为 swap intent
  ↓
AI 调用 prepare_swap_transaction tool
  ↓
Tool 调用 0x API (EVM) 或 Jupiter API (Solana) 获取报价
  ↓
返回 ExecutionPreviewCard (包含交易步骤、预估输出、风险提示)
  ↓
用户确认交易
  ↓
前端调用 POST /api/swap/execute
  ↓
后端执行交易 (directSwapExecutor 或 solanaExecutor)
  ↓
记录到 SwapHistory 表
  ↓
返回交易哈希
```

**关键文件**:
- 工具定义: `src/tools/swapTransaction.ts` (prepare_swap_transaction)
- 执行器: `src/services/directSwapExecutor.ts` (EVM), `src/services/solanaExecutor.ts` (Solana)
- API 路由: `src/routes/swap.ts` (POST `/execute`)

**风险检查**:
- 交易前调用 `check_token_risk` tool
- 价格偏差检查（偏差 > 50% 禁止交易）
- 流动性、交易量、税费检测

### CopyTrade Flow

**完整流程**:
```
用户创建跟单配置 (POST /api/copy-trade/configs)
  ↓
保存到 CopyTradeConfig 表
  ↓
后台任务监控目标钱包 (watcherService)
  ↓
检测到新交易
  ↓
可选: AI 分析 (judgeEngine) - 评估是否跟单
  ↓
执行跟单交易 (copyTradeAnalysisService)
  ↓
创建 Position 记录
  ↓
监控止盈止损 (positionMonitorJob)
  ↓
触发止盈/止损时自动卖出
  ↓
更新 Position (status: 'closed')
```

**关键文件**:
- 配置管理: `src/routes/copyTrade.ts`
- 钱包监控: `src/services/watcherService.ts`
- AI 分析: `src/services/judge/judgeEngine.ts`
- 执行服务: `src/services/copyTradeAnalysisService.ts`
- 持仓监控: `src/jobs/positionMonitorJob.ts`

**数据表**:
- `CopyTradeConfig` - 跟单配置
- `Position` - 持仓记录
- `CopyTradeAnalysis` - AI 分析结果

---

## 4. Frontend Layer

### 前端主要模块职责

#### Chat 模块 (`src/components/Chat/`)
- **ChatInterface.tsx**: 主聊天界面，管理会话列表和消息显示
- **ChatInput.tsx**: 消息输入框，支持建议、文件上传
- **MessageList.tsx**: 消息列表渲染，支持流式更新
- **WelcomeScreen.tsx**: 欢迎界面，展示功能说明

**关键逻辑**:
- WebSocket 连接: `src/utils/chatWebSocket.ts`
- 会话管理: `src/hooks/useConversations.ts`
- 消息状态: 通过 WebSocket 接收 `chunk` 事件，累积到消息内容

#### Swap 模块 (`src/components/Swap/`)
- **SwapCard.tsx**: 交易卡片，显示交易预览和确认
- **SwapForm.tsx**: 交易表单，输入代币、金额、滑点

**关键逻辑**:
- API 调用: `src/services/swapService.ts`
- 报价获取: 调用 `/api/swap/quote`
- 交易执行: 调用 `/api/swap/execute`

#### Wallet 模块 (`src/components/Wallet/`)
- **WalletBalance.tsx**: 余额显示
- **WalletTransactions.tsx**: 交易历史
- **AuthorizationPromptModal.tsx**: 授权提示弹窗

**关键逻辑**:
- 钱包连接: Privy SDK (`@privy-io/react-auth`)
- 余额查询: `src/services/walletApi.ts`
- 交易历史: 调用 `/api/wallets/transactions`

#### Trade 模块 (`src/components/Trade/`)
- **StrategyCard.tsx**: 策略卡片，显示自动交易策略
- **StrategyEditForm.tsx**: 策略编辑表单

**关键逻辑**:
- 策略管理: `src/hooks/useStrategies.ts`
- API 调用: `src/services/copyTradeApi.ts`

### WebSocket / API 调用逻辑

#### WebSocket 连接
```typescript
// src/utils/chatWebSocket.ts
const ws = new WebSocket(`${WS_URL}?token=${accessToken}`);
ws.onmessage = (event) => {
  const data: ChatEvent = JSON.parse(event.data);
  // 处理 chunk、task_status、message_complete 等事件
};
```

**事件类型**:
- `chunk`: 消息内容块
- `task_status`: 任务状态更新
- `message_complete`: 消息完成
- `error`: 错误信息
- `usage`: Token 使用统计
- `citations`: 引用来源
- `client_action`: 客户端动作（如导航、打开卡片）

#### API 调用封装
```typescript
// src/services/api.ts
export const chatApi = {
  createSession: (title?: string) => POST('/api/chat/sessions', { title }),
  sendMessage: (sessionId, content, config) => 
    POST(`/api/chat/sessions/${sessionId}/messages`, { content, ...config }),
  // ...
};
```

**认证**: 所有 API 调用自动附加 `Authorization: Bearer {token}` 头

### 哪些文件定义用户行为

#### 路由定义
- `src/App.tsx`: 主路由配置，定义页面切换逻辑
- 路由映射:
  - `/` → ChatInterface
  - `/news` → NewsPage
  - `/marketdata/*` → OverviewPage / TokensPage / ChainsPage / RiskPage
  - `/superdefi` → SuperDefiPage
  - `/trade` → TradePage
  - `/wallet` → WalletPage

#### 状态管理
- `src/hooks/useConversations.ts`: 会话状态管理
- `src/hooks/useStrategies.ts`: 策略状态管理
- `src/contexts/ThemeContext.tsx`: 主题状态（如果需要）

#### 用户设置
- `src/services/userSettingsApi.ts`: 用户偏好设置（滑点、MEV 保护等）
- 存储: 后端 `UserSettings` 表

---

## 5. API Layer (Node Backend)

### routes / services / jobs / db 的职责边界

#### `routes/` - HTTP 路由层
**职责**: 定义 API 端点，处理 HTTP 请求/响应，调用 services

**关键路由**:
- `chat.ts`: 会话和消息管理 (`/api/chat/*`)
- `ai.ts`: AI 代理路由，工具执行 (`/api/ai/*`)
- `swap.ts`: 交易相关 (`/api/swap/*`)
- `copyTrade.ts`: 跟单相关 (`/api/copy-trade/*`)
- `tokens.ts`: 代币信息 (`/api/tokens/*`)
- `market.ts`: 市场数据 (`/api/market/*`)
- `social.ts`: 社交数据 (`/api/social/*`)
- `news.ts`: 新闻相关 (`/api/news/*`)
- `wallets.ts`: 钱包相关 (`/api/wallets/*`)

**模式**: 路由只做参数验证和响应格式化，业务逻辑在 services

#### `services/` - 业务逻辑层
**职责**: 实现核心业务逻辑，调用外部 API，操作数据库

**关键服务**:
- `ai/PromptOrchestrator.ts`: 提示词生成
- `ai/intentParser.ts`: 意图解析
- `chatWebSocket.ts`: WebSocket 管理
- `directSwapExecutor.ts`: EVM 链交易执行
- `solanaExecutor.ts`: Solana 链交易执行
- `zeroEx.ts`: 0x API 封装
- `solanaSwap.ts`: Jupiter/Raydium API 封装
- `watcherService.ts`: 钱包监控
- `copyTradeAnalysisService.ts`: 跟单分析
- `judge/judgeEngine.ts`: AI 决策引擎
- `autoTradeService.ts`: 自动交易服务
- `tokenAlertService.ts`: 代币警报服务

#### `jobs/` - 后台任务层
**职责**: 定时任务，数据同步，监控检查

**关键任务**:
- `chatWorker.ts`: 轮询处理 AI 任务队列
- `marketDataJob.ts`: 同步市场数据（TVL、Gas、情绪指数）
- `tokenDataJob.ts`: 同步代币数据（价格、流动性、交易量）
- `socialDataJob.ts`: 同步社交数据（Farcaster 热门内容）
- `positionMonitorJob.ts`: 监控持仓止盈止损

**执行方式**: 通过 `node-cron` 定时触发，或通过轮询机制

#### `db/` - 数据访问层
**职责**: 数据库连接和配置

**关键文件**:
- `prisma.ts`: Prisma 客户端实例
- `connection.ts`: 连接测试
- `migrate.ts`: 数据库迁移脚本

**模式**: 通过 Prisma ORM 访问，类型安全

### 关键 service 的角色

#### tradeExecutor (实际为 directSwapExecutor + solanaExecutor)
- **职责**: 执行链上交易
- **输入**: 交易参数（tokenIn, tokenOut, amount, chainId）
- **输出**: 交易哈希
- **依赖**: 0x API (EVM) 或 Jupiter API (Solana)

#### risk (实际为多个工具)
- **职责**: 风险检查
- **工具**: `check_token_risk` (GoPlus API)
- **检查项**: 蜜罐、税费、流动性锁定、价格偏差

#### orchestrator (PromptOrchestrator)
- **职责**: 根据 Model + Intent 生成系统提示词
- **输入**: ModelType, IntentType, UserContext
- **输出**: 完整的系统提示词字符串
- **版本**: v1 (legacy) 和 v2 (新架构)

### 哪些模块是高风险修改区

#### 1. Chat Worker (`src/jobs/chatWorker.ts`)
- **风险**: 修改可能影响所有 AI 对话功能
- **注意**: 工具调用执行逻辑、流式响应处理

#### 2. Intent Parser (`src/services/ai/intentParser.ts`)
- **风险**: 修改可能影响意图识别准确性
- **注意**: 规则层、分类器、AI 回退逻辑

#### 3. Swap Executor (`src/services/directSwapExecutor.ts`, `solanaExecutor.ts`)
- **风险**: 修改可能导致交易失败或资金损失
- **注意**: 交易构建、Gas 估算、错误处理

#### 4. Tool Registry (`src/tools/registry.ts`)
- **风险**: 修改可能影响所有工具调用
- **注意**: 工具注册、执行上下文传递

#### 5. WebSocket Service (`src/services/chatWebSocket.ts`)
- **风险**: 修改可能影响实时消息推送
- **注意**: 连接管理、消息广播、错误处理

---

## 6. AI Orchestration Layer

### PromptOrchestrator / intent parser / tool router 的职责

#### PromptOrchestrator (`src/services/ai/PromptOrchestrator.ts`)
**职责**: 根据 Model + Intent 生成系统提示词

**工作流程**:
1. 接收 ModelType、IntentType、UserContext
2. 选择提示词版本 (v1 或 v2，通过环境变量 `PROMPT_SYSTEM_VERSION` 控制)
3. 组装模块:
   - v2: CORE → MODEL_ADAPTER → TOOL_LIST → INTENT_POLICY → SKILL_PROMPTS → OUTPUT_POLICY
   - v1: IDENTITY → SAFETY → TOOL_DIRECTIVE → MODEL_SPECIFIC → INTENT_SPECIFIC
4. 注入用户上下文（钱包地址、链、余额、偏好设置）
5. 返回完整提示词字符串

**关键方法**:
- `getSystemPrompt(model, intent, options)`: 生成系统提示词
- `buildPrompt(userQuery, context, intent)`: 构建最终用户负载

#### Intent Parser (`src/services/ai/intentParser.ts`)
**职责**: 将自然语言转换为结构化 Intent

**解析策略** (混合三层):
1. **规则层** (`evaluateRuleLayer`): 基于关键词和模式匹配
   - 检测合约地址、交易关键词、风险关键词
   - 输出: `IntentLabelScore[]` (带置信度)
2. **轻量分类器** (`classifyIntentLight`): 基于哈希嵌入的相似度计算
   - 使用原型匹配（INTENT_PROTOTYPES）
   - 输出: 意图分数和置信度
3. **AI 回退** (`parseDetailedIntentAI`): 调用 DeepSeek API
   - 当置信度 < 0.7 或检测到冲突时触发
   - 输出: 详细的 JSON Intent

**输出结构**:
```typescript
interface ParsedIntent {
  highLevel: HighLevelIntent;      // TRADING, MARKET_ANALYSIS, etc.
  detailed: DetailedIntent;        // swap, token_info, etc.
  contractAddress?: string;
  chainId?: number;
  swapIntent?: { tokenIn, tokenOut, amount };
  decision?: IntentDecision;       // 决策过程和证据
}
```

#### Tool Pre-Router (`src/services/ai/toolPreRouter.ts`)
**职责**: 根据 Intent 过滤可用工具，减少 LLM 选择范围

**工作流程**:
1. 接收 IntentType
2. 匹配对应的 Skills
3. 提取 Skills 关联的工具列表
4. 返回过滤后的工具定义

**目的**: 提高工具调用准确性，减少无关工具干扰

### Skills / Tools 架构如何工作

#### Skills 架构
**定义位置**: `src/skills/{SkillName}/`

**文件结构**:
- `SKILL.md` 或 `prompt.md`: Skill 提示词
- `skill.json`: Skill 元数据（id, name, description, intents, tools, examples）
- `index.ts`: Skill 导出（可选）
- `tools/`: Skill 关联的工具实现

**注册机制**:
1. `SkillRegistry` 自动扫描 `src/skills/` 目录
2. 读取 `SKILL.md` (新格式) 或 `skill.json` + `prompt.md` (旧格式)
3. 解析元数据，注册到内存 Map

**匹配逻辑**:
- 根据 Intent 匹配: `skillRegistry.getSkillsByIntent(intent)`
- 返回匹配的 Skills，注入到系统提示词

**现有 Skills**:
- `TokenSkill`: 代币信息查询
- `SwapSkill`: 交易执行
- `MarketSkill`: 市场数据分析
- `SocialSkill`: 社交数据查询
- `RiskSkill`: 风险扫描
- `WalletSkill`: 钱包信息查询
- `CopyTradeSkill`: 跟单相关
- `PolymarketSkill`: 预测市场
- `ZoraSkill`: Zora 平台相关
- `TokenAlertSkill`: 代币警报

#### Tools 架构
**定义位置**: `src/tools/{toolName}.ts`

**文件结构**:
```typescript
export const toolName = {
  definition: {
    name: "tool_name",
    description: "...",
    parameters: { type: "object", properties: {...}, required: [...] }
  },
  handler: async (args, context) => { /* 实现 */ }
};
```

**注册机制**:
1. 工具在 `src/tools/` 目录定义
2. 通过 `src/tools/index.ts` 统一导入和注册
3. 注册到 `ToolRegistry`

**执行流程**:
1. LLM 生成工具调用请求
2. `ToolRegistry.execute(name, args, context)` 查找工具
3. 调用 `handler(args, context)`
4. 返回结果给 LLM

**现有 Tools** (部分):
- `get_token_info`: 代币基本信息
- `get_token_price`: 代币价格
- `get_trending_tokens`: 热门代币
- `prepare_swap_transaction`: 准备交易
- `check_token_risk`: 风险扫描
- `get_wallet_info`: 钱包信息
- `external_web_search`: 外部搜索
- `get_economic_calendar`: 经济日历
- `get_gas_price`: Gas 价格

### 添加新能力时应从哪里入手

#### 添加新 Tool
1. 在 `src/tools/` 创建新文件 `newTool.ts`
2. 定义 `definition` (OpenAI Function Calling Schema)
3. 实现 `handler` 函数
4. 在 `src/tools/index.ts` 导入并注册
5. 工具会自动出现在 LLM 的工具列表中

#### 添加新 Skill
1. 在 `src/skills/` 创建新目录 `NewSkill/`
2. 创建 `SKILL.md` (包含 frontmatter) 或 `skill.json` + `prompt.md`
3. 在 `skill.json` 中定义:
   - `intents`: 匹配的意图类型
   - `tools`: 关联的工具名称列表
4. Skill 会自动加载和注册

#### 添加新 Intent
1. 在 `src/services/ai/intentParser.ts` 添加新的 `DetailedIntentType`
2. 在 `DETAILED_TO_HIGH_LEVEL` 映射中添加对应关系
3. 在 `INTENT_PROTOTYPES` 中添加原型示例（用于分类器）
4. 在 `PromptOrchestrator` 的提示词模板中添加 Intent 特定内容（如果需要）

---

## 7. Skills & Tools System

### Skill 的结构规范

#### 新格式 (SKILL.md)
```markdown
---
name: SkillName
description: Skill description
---

# Skill Prompt

Detailed instructions for the AI...
```

#### 旧格式 (skill.json + prompt.md)
```json
// skill.json
{
  "id": "skill_id",
  "name": "Skill Name",
  "description": "...",
  "intents": ["TRADING", "MARKET_ANALYSIS"],
  "tools": ["tool1", "tool2"],
  "examples": {
    "en": ["example 1", "example 2"],
    "zh": ["示例 1", "示例 2"]
  }
}
```

**加载优先级**: SKILL.md > (skill.json + prompt.md)

### Tool 的输入/输出模式

#### 输入模式
```typescript
interface ToolContext {
  userId?: string;
  userAddress?: string;
  chainId?: number;
  [key: string]: any;
}

// 工具定义
const tool = {
  definition: {
    name: "tool_name",
    description: "...",
    parameters: {
      type: "object",
      properties: {
        param1: { type: "string", description: "..." },
        param2: { type: "number", description: "..." }
      },
      required: ["param1"]
    }
  },
  handler: async (args: { param1: string, param2?: number }, context?: ToolContext) => {
    // 实现
    return result;
  }
};
```

#### 输出模式
- **正常返回**: 返回 JSON 对象或字符串
- **客户端动作**: 返回 `{ __client_action: {...}, summary: "..." }` 触发前端行为
- **错误处理**: 抛出异常，会被捕获并返回错误消息给 LLM

### 注册机制

#### Tool 注册
```typescript
// src/tools/index.ts
import { toolRegistry } from './registry.js';
import { tool1 } from './tool1.js';
import { tool2 } from './tool2.js';

toolRegistry.register(tool1);
toolRegistry.register(tool2);
```

#### Skill 注册
- **自动扫描**: `SkillRegistry` 构造函数自动扫描 `src/skills/` 目录
- **加载时机**: 服务器启动时
- **手动注册**: 通过 `skillRegistry.register(skill)` (不常用)

### 如何新增一个 skill / tool

#### 新增 Tool 步骤
1. 创建 `src/tools/newTool.ts`
2. 定义工具 schema 和 handler
3. 在 `src/tools/index.ts` 导入并注册
4. 重启服务器

#### 新增 Skill 步骤
1. 创建 `src/skills/NewSkill/` 目录
2. 创建 `SKILL.md` 或 `skill.json` + `prompt.md`
3. 定义元数据（intents, tools）
4. 重启服务器（自动加载）

**验证**: 检查日志中的 `[SkillRegistry] Loaded skill: ...` 消息

---

## 8. Grok Service (Python)

### grok/router / rag/router / moderation/router 分别做什么

#### grok/router.py
**职责**: Grok AI 服务路由，提供 OpenAI 兼容的聊天完成接口

**主要端点**:
- `POST /grok/v1/chat/completions`: 聊天完成（支持流式）
- `GET /grok/health`: 健康检查

**功能**:
- 调用 xAI Grok API (通过 `xai_sdk`)
- 支持工具调用（web_search, x_search, 自定义工具）
- 自定义工具定义（check_token_risk, get_token_price, prepare_swap_transaction 等）
- 工具执行时调用后端 API (`KIKO_API_BASE`)
- 流式响应处理
- RAG 集成（可选，通过 `get_kb()` 懒加载）

**认证**: Privy JWT Token 验证（可通过 `SKIP_AUTH` 环境变量跳过）

#### rag/router.py
**职责**: RAG 知识库服务，提供文档检索接口

**主要端点**:
- `POST /rag/ingest`: 爬取并索引文档（后台任务）
- `POST /rag/ingest-local`: 索引本地目录（后台任务）
- `POST /rag/query`: 查询知识库
- `GET /rag/health`: 健康检查

**功能**:
- 文档爬取 (`rag/crawler.py`)
- 向量化存储 (`rag/vectorstore.py`)
- 语义检索（基于 ChromaDB 或类似向量数据库）
- 支持本地文件索引

**依赖**: `langchain_chroma` (可选，缺失时服务仍可运行)

#### moderation/router.py
**职责**: 内容审核服务，检查输入/输出内容安全性

**主要端点**:
- `POST /moderation/check`: 检查内容
- `GET /moderation/health`: 健康检查

**功能**:
- 内容安全检查（NEED CONFIRM: 具体检查项）
- 模型初始化 (`moderation/models.py`)

### RAG 工作方式（crawler → vectorstore → query）

#### 1. 文档爬取 (`rag/crawler.py`)
- **输入**: URL、最大深度、排除目录
- **过程**: 递归爬取网页，提取文本内容
- **输出**: Document 对象列表

#### 2. 向量化存储 (`rag/vectorstore.py`)
- **输入**: Document 列表
- **过程**: 
  - 文本分块 (Chunking)
  - 向量化（通过 OpenAI Embeddings API）
  - 存储到向量数据库（ChromaDB）
- **输出**: 索引完成

#### 3. 查询 (`rag/router.py` - POST `/query`)
- **输入**: 查询文本、返回数量 (k)
- **过程**:
  - 将查询文本向量化
  - 在向量数据库中检索相似文档
  - 返回 Top-K 结果（带相似度分数）
- **输出**: `{ results: [{ content, metadata, score }] }`

**集成点**: Grok 服务在需要时调用 RAG 查询，将结果注入到上下文

### 哪些接口被 Node Backend 调用

#### Grok 服务
- `POST {GROK_SERVICE_URL}/grok/v1/chat/completions`
  - 调用位置: `src/routes/ai.ts` (当 model 以 `grok-` 开头时)
  - 用途: 代理 Grok 请求，避免 CORS

#### RAG 服务
- `POST {RAG_SERVICE_URL}/rag/query`
  - 调用位置: `src/services/ragClient.ts` (NEED CONFIRM: 是否实际使用)
  - 用途: 查询知识库

#### Moderation 服务
- `POST {MODERATION_SERVICE_URL}/moderation/check`
  - 调用位置: `src/services/moderationClient.ts`
  - 用途: 检查内容安全性

**环境变量**:
- `GROK_SERVICE_URL`: 默认 `http://localhost:8000/grok`
- `RAG_SERVICE_URL`: 默认 `http://localhost:8000/rag`
- `MODERATION_SERVICE_URL`: 默认 `http://localhost:8000/moderation`

---

## 9. Database Layer

### 使用的数据库类型

- **主数据库**: PostgreSQL 15 (通过 Prisma ORM 访问)
- **缓存**: Redis 7 (用于 API 缓存、会话状态)

### 核心表的职责

#### 聊天系统
- **ChatSession**: 聊天会话（userId, title, model, status）
- **ChatMessage**: 消息记录（sessionId, role, content, status）
- **AITask**: AI 任务队列（sessionId, model, status, toolContext）
- **MessageChunk**: 流式消息块（messageId, chunkIndex, content）

#### 用户系统
- **User**: 用户基本信息（privyDid, walletAddress, solanaWalletAddress）
- **UserSettings**: 用户偏好设置（滑点、MEV 保护、默认金额等）

#### 交易系统
- **SwapHistory**: 交易历史（userId, chainId, txHash, tokenIn, tokenOut, amount）
- **Position**: 持仓记录（userId, configId, tokenAddress, entryPrice, status）

#### 跟单系统
- **CopyTradeConfig**: 跟单配置（userId, targetWallet, buyAmountUsd, takeProfitPct, stopLossPct）
- **CopyTradeAnalysis**: AI 分析结果（configId, tokenAddress, aiDecision, confidenceScore）
- **TrackedWallet**: 被监控的钱包（address, chainId, lastCheckedTx, activeConfigs）

#### 市场数据
- **MarketOverview**: 市场概览（globalMarketCap, volume24h, fearGreedIndex）
- **ChainMetric**: 链指标（name, tvl, volume24h, txns24h）
- **ProtocolMetric**: 协议指标（name, tvl, volume24h, chains）
- **TrendingToken**: 热门代币（chain, address, price, volume24h, liquidity）

#### 社交数据
- **TrendingCast**: Farcaster 热门内容（hash, fid, text, likes, recasts）
- **QualityFarcasterUser**: 优质 Farcaster 用户（fid, username, followers, engagementRate）

#### 其他
- **TokenRule**: 代币规则/警报（userId, address, targetType, ruleType, conditionValue）
- **NewsArticle**: 新闻文章（title, content, status, publishedAt）
- **ModerationLog**: 审核日志（userId, channel, content, result）
- **JudgeDecision**: AI 决策记录（tokenAddress, finalDecision, overallRiskScore）

### 哪些数据是关键业务状态

#### 必须持久化的状态
1. **AITask.status**: 任务状态（queued → running → completed/failed）
   - 用于任务恢复和状态查询
2. **Position.status**: 持仓状态（open → closed）
   - 用于止盈止损监控
3. **CopyTradeConfig.status**: 跟单配置状态（active → paused → deleted）
   - 用于控制跟单是否执行
4. **SwapHistory.status**: 交易状态（pending → success → failed）
   - 用于交易结果追踪

#### 关键关联关系
- `ChatMessage.sessionId` → `ChatSession.id` (级联删除)
- `Position.configId` → `CopyTradeConfig.id` (级联删除)
- `CopyTradeAnalysis.configId` → `CopyTradeConfig.id` (级联删除)
- `SwapHistory.userId` → `User.id` (级联删除)

#### 索引策略
- 高频查询字段建立索引: `userId`, `sessionId`, `status`, `createdAt`
- 唯一约束: `(chainId, address)` 用于 Token, `(userId, chain, address)` 用于 FavoriteToken

---

## 10. Protocols & Interfaces

### WebSocket 消息大致结构

#### 连接建立
```
客户端: GET /api/chat/ws?token={jwt_token}
服务端: WebSocket 握手成功
```

#### 消息格式
```typescript
interface ChatEvent {
  type: 'chunk' | 'task_status' | 'message_complete' | 'message_start' | 'error' | 'usage' | 'citations' | 'content_block' | 'client_action';
  sessionId: string;
  data: any;
}
```

#### 事件类型详解
- **chunk**: 消息内容块
  ```json
  {
    "type": "chunk",
    "sessionId": "...",
    "data": {
      "messageId": "...",
      "chunkIndex": 0,
      "content": "Hello",
      "reasoningContent": "..." // 仅 thinking 模式
    }
  }
  ```
- **task_status**: 任务状态更新
  ```json
  {
    "type": "task_status",
    "sessionId": "...",
    "data": {
      "taskId": "...",
      "status": "running",
      "progress": "Processing tools..."
    }
  }
  ```
- **message_complete**: 消息完成
  ```json
  {
    "type": "message_complete",
    "sessionId": "...",
    "data": {
      "messageId": "...",
      "status": "complete",
      "usage": { "prompt_tokens": 100, "completion_tokens": 50 }
    }
  }
  ```
- **error**: 错误信息
  ```json
  {
    "type": "error",
    "sessionId": "...",
    "data": {
      "message": "Error message",
      "code": "ERROR_CODE"
    }
  }
  ```
- **client_action**: 客户端动作
  ```json
  {
    "type": "client_action",
    "sessionId": "...",
    "data": {
      "action": "navigate",
      "target": "/marketdata/tokens",
      "params": { "id": "..." }
    }
  }
  ```

#### 心跳机制
```
客户端: { "type": "ping" }
服务端: { "type": "pong" }
```

### API 请求返回模式

#### 标准成功响应
```typescript
{
  success: true,
  data: { ... },
  // 可选字段
  message?: string,
  meta?: { ... }
}
```

#### 标准错误响应
```typescript
{
  success: false,
  error: "Error message",
  code?: "ERROR_CODE",
  details?: { ... }
}
```

#### 分页响应
```typescript
{
  success: true,
  data: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 100,
    hasMore: true
  }
}
```

#### 流式响应 (SSE)
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"content": "chunk1"}
data: {"content": "chunk2"}
data: [DONE]
```

### 内部模块之间的数据格式

#### Intent 数据格式
```typescript
interface ParsedIntent {
  highLevel: {
    type: 'TRADING' | 'MARKET_ANALYSIS' | ...,
    confidence: number
  },
  detailed: {
    version: '1.0',
    intent_id: string,
    action: 'swap' | 'token_info' | ...,
    token_in?: string,
    token_out?: string,
    amount?: string,
    chain_id?: number,
    // ...
  }
}
```

#### Tool 调用格式
```typescript
// LLM 生成
{
  id: "call_xxx",
  type: "function",
  function: {
    name: "tool_name",
    arguments: '{"param1": "value1"}'
  }
}

// 执行结果
{
  role: "tool",
  tool_call_id: "call_xxx",
  content: "Tool result JSON string"
}
```

#### 用户上下文格式
```typescript
interface UserContext {
  isWalletConnected?: boolean;
  userAddress?: string;
  solanaAddress?: string;
  chainId?: number;
  chainName?: string;
  nativeBalance?: string;
  balance?: Record<string, string>;
  pendingSwapToken?: { symbol: string, address: string, chainId: number };
  currentPage?: string;
  pageContext?: string;
  toolConfig?: {
    userRole?: string;
    quickSwapMode?: boolean;
    checkTokenBeforeSwap?: boolean;
    swapMethod?: string;
    slippageMode?: string;
    customSlippage?: number;
    mevProtection?: boolean;
    // ...
  };
  intentHints?: {
    labels?: string[];
    conflict?: string;
    question?: string;
  };
}
```

---

## 11. Operations & Debugging

### 本地启动顺序

#### 方式 1: 使用启动脚本
```bash
./start.sh
```
脚本会自动启动:
1. Python 服务 (端口 8000)
2. API 服务 (端口 3001)
3. 前端服务 (端口 5173)

#### 方式 2: 手动启动
```bash
# 1. 启动数据库和 Redis (Docker)
docker-compose up -d postgres redis

# 2. 启动 Python 服务
cd kiko-python
python3 main.py  # 端口 8000

# 3. 启动 API 服务
cd kiko-api
npm run dev  # 端口 3001 (同时启动 Python 服务)

# 4. 启动前端
cd kiko-web
npm run dev  # 端口 5173
```

#### 环境变量
- 后端: `kiko-api/.env` (需要配置数据库、API Keys)
- Python: 从 `kiko-api/.env` 读取（通过 `load_dotenv`）

### 常见错误点

#### 1. 数据库连接失败
**症状**: `Database connection failed`
**排查**:
- 检查 PostgreSQL 是否运行: `docker ps`
- 检查 `DATABASE_URL` 环境变量
- 检查数据库迁移: `npm run migrate` (在 kiko-api 目录)

#### 2. WebSocket 连接失败
**症状**: 前端无法接收实时消息
**排查**:
- 检查 WebSocket URL 配置
- 检查 JWT Token 是否有效
- 检查后端 WebSocket 路由是否注册
- 查看浏览器控制台 WebSocket 错误

#### 3. AI 任务卡在 queued 状态
**症状**: 消息发送后无响应
**排查**:
- 检查 `chatWorker` 是否启动（查看日志）
- 检查 `AITask` 表是否有新任务
- 检查 AI API Key 是否配置（DEEPSEEK_API_KEY 或 XAI_API_KEY）
- 查看 `chatWorker` 日志错误

#### 4. 工具调用失败
**症状**: AI 返回工具错误
**排查**:
- 检查工具是否在 `ToolRegistry` 中注册
- 检查工具参数格式是否正确
- 查看工具执行日志
- 检查外部 API 是否可访问（0x API, Jupiter API 等）

#### 5. 交易执行失败
**症状**: Swap 交易失败
**排查**:
- 检查用户余额是否充足
- 检查代币授权 (Allowance) 是否足够
- 检查 Gas 价格和限制
- 检查滑点设置
- 查看交易哈希对应的链上错误

### 出问题优先排查路径

#### 1. 检查服务状态
```bash
# 检查服务是否运行
curl http://localhost:3001/health  # API
curl http://localhost:8000/health  # Python
curl http://localhost:5173  # Frontend
```

#### 2. 查看日志
```bash
# API 日志
tail -f logs/api.log  # 或查看控制台输出

# Python 日志
tail -f logs/python.log  # 或查看控制台输出

# 前端日志
# 查看浏览器控制台
```

#### 3. 检查数据库
```bash
# 连接数据库
psql -h localhost -U almurat -d kiko_db

# 检查关键表
SELECT * FROM "AITask" WHERE status = 'queued' ORDER BY "createdAt" DESC LIMIT 10;
SELECT * FROM "ChatMessage" ORDER BY "createdAt" DESC LIMIT 10;
```

#### 4. 检查 Redis
```bash
# 连接 Redis
redis-cli

# 检查键
KEYS *
```

#### 5. 检查环境变量
```bash
# 后端
cd kiko-api
cat .env | grep -E "(DATABASE_URL|DEEPSEEK_API_KEY|XAI_API_KEY)"

# Python
cd kiko-python
# 环境变量从 kiko-api/.env 读取
```

### 哪些模块最容易出 bug

#### 1. Intent Parser
- **问题**: 意图识别不准确，导致路由错误
- **原因**: 规则层和分类器的阈值设置
- **排查**: 查看 `IntentDecision` 日志，检查置信度和证据

#### 2. Chat Worker
- **问题**: 任务处理中断，消息不完整
- **原因**: 工具调用超时、AI API 错误、数据库写入失败
- **排查**: 查看 `AITask` 表的 `errorMessage` 字段，检查 `chatWorker` 日志

#### 3. WebSocket 服务
- **问题**: 消息丢失、连接断开
- **原因**: 网络不稳定、连接管理逻辑错误
- **排查**: 检查 WebSocket 连接状态，查看 `MessageChunk` 表是否有数据

#### 4. Tool 执行
- **问题**: 工具返回错误或超时
- **原因**: 外部 API 不可用、参数格式错误、网络问题
- **排查**: 查看工具执行日志，检查外部 API 状态

#### 5. 交易执行
- **问题**: 交易失败、Gas 不足、滑点过大
- **原因**: 链上状态变化、Gas 价格波动、流动性不足
- **排查**: 查看交易哈希，检查链上状态，查看 `SwapHistory` 表的 `failureReason`

---

## 附录: 关键文件索引

### 后端核心文件
- `src/index.ts` - 服务器入口
- `src/routes/chat.ts` - 聊天路由
- `src/routes/ai.ts` - AI 代理路由
- `src/jobs/chatWorker.ts` - AI 任务处理器
- `src/services/ai/PromptOrchestrator.ts` - 提示词编排
- `src/services/ai/intentParser.ts` - 意图解析
- `src/services/chatWebSocket.ts` - WebSocket 服务
- `src/tools/registry.ts` - 工具注册表
- `src/skills/registry.ts` - Skill 注册表

### 前端核心文件
- `src/App.tsx` - 应用入口和路由
- `src/components/Chat/ChatInterface.tsx` - 聊天界面
- `src/utils/chatWebSocket.ts` - WebSocket 客户端
- `src/hooks/useConversations.ts` - 会话管理
- `src/services/api.ts` - API 调用封装

### Python 核心文件
- `main.py` - FastAPI 统一入口
- `grok/router.py` - Grok 服务路由
- `rag/router.py` - RAG 服务路由
- `moderation/router.py` - 审核服务路由

---

**文档版本**: 1.0  
**最后更新**: 基于代码库当前状态  
**维护者**: KIKO 开发团队
