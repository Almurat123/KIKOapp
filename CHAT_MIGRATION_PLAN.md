# Chat服务迁移完整性分析报告

> 基于 `chatWorker.ts` Import 逆向追踪分析
> 生成日期: 2026-02-13
> 更新日期: 2026-02-13（架构优化版）

---

## 架构决策：跨服务调用 vs 完全迁移

### 最终方案：跨服务调用 + 核心逻辑迁移

```
┌─────────────────────────────────────────────────────────────┐
│                     Python Services                          │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  Chat v2    │───→│ LLM Gateway │───→│  Tool Runtime   │──┼──→ Node API
│  │  (Worker)   │    │  (流式处理)  │    │   (代理层)      │  │   (Skills/Tools)
│  └──────┬──────┘    └─────────────┘    └─────────────────┘  │
│         │                                                    │
│         │  HTTP调用                                          │
│         ↓                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Node API (复用现有实现)                     ││
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  ││
│  │  │   Skills    │  │   Prompts   │  │  Tool Registry  │  ││
│  │  │  Registry   │  │ Orchestrator│  │   (50+ Tools)   │  ││
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 决策依据

| 维度 | 跨服务调用 | 完全迁移 | 结论 |
|-----|-----------|---------|------|
| **代码量** | ✅ 少，只写代理层 | ❌ 多，需重写50+模块 | 跨服务胜 |
| **功能同步** | ✅ 自动同步 | ❌ 需手动同步 | 跨服务胜 |
| **延迟** | 🟡 增加网络开销 | ✅ 本地调用 | 完全迁移胜 |
| **调试** | ❌ 跨服务追踪困难 | ✅ 单服务内调试 | 完全迁移胜 |
| **部署** | 🟡 需两服务同时在线 | ✅ 独立部署 | 完全迁移胜 |
| **维护成本** | ✅ 低 | ❌ 高 | 跨服务胜 |

**结论**：跨服务调用方案大幅减少迁移工作量（从50+模块降至5-8个），且已有 `tool_runtime` 代理层支持。

---

## 一、需要迁移的核心模块（Worker核心逻辑）

| 模块 | 功能描述 | 迁移必要性 | 说明 |
|-----|---------|-----------|------|
| **Tool Execution Loop** | 工具执行循环、多轮调用 | ✅ 必须 | Worker核心逻辑 |
| **UserContext 构建** | 用户上下文构建 | ✅ 必须 | Worker核心逻辑 |
| **Context Budget Manager** | Token预算管理、历史压缩 | ✅ 必须 | Worker核心逻辑 |
| **Intent Parser** | 意图解析 | 🟡 可选 | 可API化或迁移 |
| **确认消息处理** | confirm/proceed处理 | ✅ 必须 | 交易确认逻辑 |

---

## 二、通过API复用的模块（Node端已有实现）

### 2.1 Skills 系统

**Node端接口需求**：
```typescript
// 新增接口：获取匹配的Skills
GET /internal/skills/by-intent/:intent
Response: { skills: [{ id, prompt, tools }] }
```

**Python端调用**：
```python
async def get_skills_for_intent(self, intent: str) -> list[dict]:
    resp = await client.get(f"{NODE_API_URL}/internal/skills/by-intent/{intent}")
    return resp.json()["skills"]
```

### 2.2 Prompts 系统

**Node端接口需求**：
```typescript
// 新增接口：获取系统提示
GET /internal/prompts/:intent?model=deepseek&mode=execution
Response: { prompt: string, tools: ToolDefinition[] }
```

**Python端调用**：
```python
async def get_system_prompt(self, intent: str, model: str, mode: str) -> dict:
    resp = await client.get(
        f"{NODE_API_URL}/internal/prompts/{intent}",
        params={"model": model, "mode": mode}
    )
    return resp.json()  # { prompt, tools }
```

### 2.3 Tools 执行

**已有接口**（tool_runtime/app.py）：
```python
POST /internal/v1/tool/execute
Body: { tool_name, arguments, context }
Response: { ok, result, error }
```

**Python Worker 调用**：
```python
async def execute_tool(self, tool_name: str, args: dict, context: dict) -> dict:
    resp = await client.post(
        f"{settings.TOOL_RUNTIME_URL}/internal/v1/tool/execute",
        json={"tool_name": tool_name, "arguments": args, "context": context}
    )
    return resp.json()
```

### 2.4 Tool Definitions

**Node端接口需求**：
```typescript
// 新增接口：获取工具定义
GET /internal/tools/definitions?skills=swap,polymarket
Response: { tools: ToolDefinition[] }
```

---

## 三、Node端需要新增的内部接口

| 接口 | 方法 | 功能 | 优先级 |
|-----|-----|------|-------|
| `/internal/prompts/:intent` | GET | 获取系统提示+工具定义 | P0 |
| `/internal/skills/by-intent/:intent` | GET | 获取匹配的Skills | P1 |
| `/internal/tools/definitions` | GET | 获取工具定义列表 | P0 |
| `/internal/intent/parse` | POST | 解析用户意图 | P1 |
| `/internal/context/build` | POST | 构建用户上下文 | P2 |

---

## 四、Python Worker 核心逻辑实现

### 4.1 Tool Execution Loop（必须实现）

```python
async def run_tool_loop(self, task, messages, tools, context):
    max_rounds = settings.MAX_TOOL_ROUNDS
    
    for round_num in range(max_rounds):
        # 1. 调用 LLM Gateway
        response = await self.call_llm(messages, tools)
        
        # 2. 检查是否有 tool_calls
        tool_calls = response.get("tool_calls", [])
        if not tool_calls:
            # 无工具调用，返回最终回复
            return response
        
        # 3. 执行工具
        for tool_call in tool_calls:
            result = await self.execute_tool(
                tool_call["name"],
                tool_call["arguments"],
                context
            )
            # 4. 广播工具结果
            await ws_manager.broadcast_event(
                user_id, "tool_result", session_id, message_id, result
            )
            # 5. 添加到消息历史
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call["id"],
                "content": json.dumps(result)
            })
    
    return response
```

### 4.2 UserContext 构建（必须实现）

```python
def build_user_context(self, task, chain_name=None) -> dict:
    ctx = task.tool_context or {}
    return {
        "userAddress": ctx.get("walletAddress"),
        "chainId": ctx.get("chainId"),
        "chainName": chain_name,
        "isWalletConnected": bool(ctx.get("walletAddress")),
        "balance": ctx.get("balance"),
        "nativeBalance": ctx.get("nativeBalance"),
        "toolConfig": ctx.get("toolConfig"),
        "currentPage": ctx.get("currentPage"),
        "pageContext": ctx.get("pageContext"),
    }
```

### 4.3 Context Budget Manager（必须实现）

```python
def apply_context_budget(self, messages, max_tokens=16000, reserved=3500):
    usable = max_tokens - reserved
    total = sum(self.estimate_tokens(m) for m in messages)
    
    if total <= usable:
        return messages
    
    # 保留最近N条消息
    recent = messages[-12:]
    # 压缩历史消息
    summary = self.summarize_history(messages[:-12])
    
    return [{"role": "system", "content": summary}] + recent
```

### 4.4 确认消息处理（必须实现）

```python
def is_confirmation_message(self, text: str) -> bool:
    keywords = ['confirm', 'proceed', 'yes', 'continue', 'ok', 
                '确认', '执行', '好的', '继续']
    clean = text.strip().lower()
    return any(k in clean for k in keywords)

async def handle_confirmation(self, task, messages, context):
    # 查找最近的 simulate_swap 结果
    recent_swap = self.find_recent_simulate_swap(messages)
    if recent_swap:
        # 执行实际交易
        return await self.execute_tool(
            "prepare_swap_transaction",
            recent_swap["args"],
            context
        )
    return None
```

---

## 五、迁移工作量对比

### 原方案（完全迁移）

| 类别 | 模块数 | 工作量 |
|-----|-------|-------|
| AI服务层 | 8 | 2-3周 |
| Prompt策略 | 6 | 1周 |
| Tooling系统 | 2 + 50工具 | 3-4周 |
| Skills系统 | 15+ | 2周 |
| Billing/Usage | 5 | 1周 |
| 外部服务 | 7 | 1-2周 |
| **总计** | **50+** | **10-13周** |

### 新方案（跨服务调用）

| 类别 | 模块数 | 工作量 |
|-----|-------|-------|
| Node内部接口 | 5个接口 | 2-3天 |
| Tool Execution Loop | 1 | 2-3天 |
| UserContext 构建 | 1 | 1天 |
| Context Budget | 1 | 1天 |
| 确认消息处理 | 1 | 1天 |
| **总计** | **5-8** | **1-2周** |

**节省工作量：80%+**

---

## 六、实施步骤

### Phase 1：Node端接口（2-3天）

1. 新增 `/internal/prompts/:intent` 接口
2. 新增 `/internal/tools/definitions` 接口
3. 新增 `/internal/intent/parse` 接口（可选）
4. 测试接口可用性

### Phase 2：Python Worker核心逻辑（3-5天）

1. 实现 Tool Execution Loop
2. 实现 UserContext 构建
3. 实现 Context Budget Manager
4. 实现确认消息处理
5. 集成测试

### Phase 3：联调与优化（2-3天）

1. 端到端测试
2. 性能优化（缓存、并发）
3. 错误处理完善

---

## 七、不需要迁移的模块（通过API复用）

| 模块 | Node路径 | 复用方式 |
|-----|---------|---------|
| Skills Registry | `skills/registry.ts` | API调用 |
| Skills Prompts | `skills/*/prompt.md` | API调用 |
| Tool Registry | `tooling/registry.ts` | API调用 |
| Tool Definitions | `tooling/index.ts` | API调用 |
| Prompt Orchestrator | `services/ai/PromptOrchestrator.ts` | API调用 |
| Prompt Policies | `services/ai/prompts/v2/policies/*` | API调用 |
| Token Detector | `services/ai/tokenDetector.ts` | API调用 |
| Launchpad Detector | `services/ai/launchpadDetector.ts` | API调用 |
| Billing Service | `services/billing/*` | API调用 |
| Usage Counter | `services/usageCounter.ts` | API调用 |
| Search Service | `services/searchService.ts` | API调用 |
| Alchemy Service | `services/alchemy.ts` | API调用 |
| Privy Wallet | `services/privyWallet.ts` | API调用 |

---

## 八、延迟分析与优化

### 延迟链路分解

```
┌─────────────────────────────────────────────────────────────────┐
│                    单次请求延迟分解                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Python Worker                                                  │
│       │                                                         │
│       │  ① HTTP 建立连接 (~5-20ms)                              │
│       ↓                                                         │
│  Node API (本地)                                                │
│       │                                                         │
│       │  ② Node 处理请求 (~1-10ms)                              │
│       │     - PromptOrchestrator                                │
│       │     - Skills 匹配                                       │
│       │     - Tool Definitions 生成                             │
│       ↓                                                         │
│  返回结果                                                       │
│       │                                                         │
│       │  ③ 序列化 + 网络传输 (~5-10ms)                          │
│       ↓                                                         │
│  Python 接收                                                    │
│                                                                 │
│  总计：~10-40ms / 次                                            │
└─────────────────────────────────────────────────────────────────┘
```

### 不同场景延迟影响

| 场景 | 调用次数 | 单次延迟 | 总延迟 | 影响 |
|-----|---------|---------|-------|------|
| **获取 Prompt** | 1次/任务 | ~20ms | ~20ms | 🟢 可忽略 |
| **获取 Tool Definitions** | 1次/任务 | ~20ms | ~20ms | 🟢 可忽略 |
| **执行 Tool** | 1-5次/任务 | ~100-500ms | ~100-2500ms | 🟡 业务逻辑 |
| **Intent 解析** | 1次/任务 | ~30ms | ~30ms | 🟢 可忽略 |

### 延迟结论

| 调用类型 | 原延迟 | 是否可优化 | 优化后 |
|---------|------|-----------|-------|
| **获取 Prompt** | ~20ms | ✅ 缓存 | ~0.1ms |
| **获取 Tool Definitions** | ~20ms | ✅ 缓存 | ~0.1ms |
| **执行 Tool** | ~100-500ms | ❌ 业务逻辑 | 不变 |
| **Intent 解析** | ~30ms | ✅ 本地化 | ~0ms |

**核心观点**：跨服务调用开销 ~10-40ms，相对于 LLM 响应时间（1-5秒）可忽略。Tool 执行时间是主要延迟来源，这是业务逻辑本身。

### 优化方案一：本地缓存（推荐）

```python
import time
from typing import Optional

class PromptCache:
    _cache: dict = {}
    _ttl: int = 300  # 5分钟缓存
    
    @classmethod
    async def get_prompt(cls, intent: str, model: str) -> dict:
        key = f"{intent}:{model}"
        
        if key in cls._cache:
            cached, ts = cls._cache[key]
            if time.time() - ts < cls._ttl:
                return cached
        
        result = await fetch_prompt_from_node(intent, model)
        cls._cache[key] = (result, time.time())
        return result
    
    @classmethod
    async def get_tool_definitions(cls, skills: list[str]) -> list:
        key = f"tools:{','.join(sorted(skills))}"
        
        if key in cls._cache:
            cached, ts = cls._cache[key]
            if time.time() - ts < cls._ttl:
                return cached
        
        result = await fetch_tool_defs_from_node(skills)
        cls._cache[key] = (result, time.time())
        return result
```

**效果**：
- 首次请求：~20ms
- 后续请求：~0.1ms（内存读取）

### 优化方案二：启动预热

```python
class ChatWorker:
    COMMON_INTENTS = ['TRADING', 'MARKET_ANALYSIS', 'GENERAL_CHAT', 'TOKEN_INFO']
    
    async def warmup(self):
        """Worker启动时预加载常用数据"""
        tasks = []
        for intent in self.COMMON_INTENTS:
            tasks.append(PromptCache.get_prompt(intent, 'deepseek'))
        
        await asyncio.gather(*tasks)
        logger.info("Prompt cache warmed up")
```

### 优化方案三：HTTP 连接池

```python
import httpx

class NodeClient:
    def __init__(self):
        self._client: Optional[httpx.AsyncClient] = None
    
    async def get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=settings.NODE_API_URL,
                timeout=30.0,
                limits=httpx.Limits(
                    max_connections=100,
                    max_keepalive_connections=20,
                    keepalive_expiry=30.0
                )
            )
        return self._client

node_client = NodeClient()
```

**效果**：复用 TCP 连接，减少连接建立开销 ~5-15ms

### 优化效果总结

| 优化项 | 实施难度 | 效果 |
|-------|---------|------|
| **Prompt 缓存** | ⭐ 简单 | 延迟从 ~20ms 降至 ~0.1ms |
| **启动预热** | ⭐ 简单 | 首次请求无延迟 |
| **HTTP 连接池** | ⭐ 简单 | 减少 ~5-15ms 连接开销 |

**结论**：延迟不是问题，简单缓存即可将跨服务调用开销降至可忽略水平

---

## 九、总结

### 核心观点

1. **不迁移 Skills/Tools**：通过 API 调用 Node 复用现有实现
2. **只迁移核心逻辑**：Tool Execution Loop、UserContext、Context Budget
3. **工作量减少 80%+**：从 50+ 模块降至 5-8 个
4. **已有基础设施**：`tool_runtime` 已实现代理层

### 下一步行动

1. 在 Node 端新增内部 API 接口
2. 在 Python Worker 实现核心编排逻辑
3. 集成测试并优化延迟
