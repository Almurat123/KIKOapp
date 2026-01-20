# 🏗️ 系统架构：为 AI 打造的执行引擎 (Detailed)

本页面为开发者提供 KiKo 终端的技术深度视图，解释请求是如何从对话框最终变为链上哈希的。

---

### 🛰️ 请求生命周期 (Lifecycle)

当你在 `kiko-web` 输入一段文字后，会经历以下链路：

1.  **端侧封装 (kiko-web)**：前端集成用户的 **Privy JWT**、当前**活跃网络 (Active Chain)** 与对话上下文，通过 WebSocket 发往后端。
2.  **意图路由 (kiko-python)**：
    *   `router.py` 接收输入。
    *   **Grok LLM** 执行初步推理，判断用户意图（交易、查询、闲聊）。
3.  **工具编排 (Tool Orchestration)**：
    *   如果需要外部数据，Grok 会输出一个 **Function Call** 指令。
    *   后端调用对应的 `CUSTOM_TOOLS`（如 `get_token_price`）。
4.  **结果收敛**：工具返回的 JSON 数据会被喂回模型，模型生成带有 **Action 标识** 的最终答复。
5.  **前端展示**：`ChatInterface` 识别 Action 标识，实时渲染出 `SwapCard` 或 `RiskReport` 组件。

---

### 🧠 核心模块选型

| 模块 | 技术栈 | 为何选择？ |
| :--- | :--- | :--- |
| **推理大脑** | xAI Grok (grok-beta) | 对实时行情、社交语境的感知力优于传统 LLM。 |
| **向量数据库** | ChromaDB (Chroma) | 存储 DeFi 协议文档，通过 RAG 减少 AI 幻觉。 |
| **链上交互层** | Lifi / LlamaIndex | 提供聚合流动性方案与文档索引能力。 |
| **安全审计层** | GoPlus / Playwright | 结合 API 与 真实浏览器模拟，进行深度网站审计。 |

---

### ⌨️ 关于 Tool Calling 的实现

我们在 `router.py` 中利用装饰器模式定义工具：

```python
# 示例：准备交易工具的定义
prepare_swap_transaction_tool = tool(
    name="prepare_swap_transaction",
    description="用于构造链上兑换交易...",
    parameters={
        "token_in": {"type": "string"},
        "token_out": {"type": "string"},
        "amount_in": {"type": "string"}
    }
)
```

<callout>
💡 **开发者进阶**：如果你想增加一条新链的支持，除了更新前端 `config/chains`，还需要确保 `kiko-python` 中的 `execute_custom_tool` 支持该链对应的 RPC 调用。
</callout>

---

<callout>
📖 **后续参考**：
- [API 鉴权与调用手册](../reference/api.md)
- [多链兼容性说明](../reference/chains.md)
</callout>
