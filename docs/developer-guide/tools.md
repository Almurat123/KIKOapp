# AI 路由器与工具链

KiKo 的核心竞争优势在于其 **Tool-Calling** 机制，能够将 AI 的通用推理能力转化为具体的金融动作。

## 路由器逻辑 (router.py)

所有的用户输入都会发送到 `/grok/chat` 接口。路由器会经历以下生命周期：

1. **Context Augmentation**: 注入用户的钱包地址、当前余额、首选链信息作为 System Prompt 的一部分。
2. **First Inference**: 调用 Grok 判断是否需要执行外部工具。
3. **Loop Execution**: 如果模型决定调用工具（例如 `get_token_price`），路由器会执行对应的异步函数，并将结果喂回给模型进行二次推理。
4. **Final Response**: 生成用户可见的自然语言，如果是交易意图，则附带特定的 `Action` 元数据。

## 现有工具库

| 工具名 | 职能 | 核心参数 |
| :--- | :--- | :--- |
| `check_token_risk` | 安全扫描 | `address`, `chain` |
| `get_token_price` | 实时币价 | `symbol_or_address` |
| `prepare_swap` | 构造交易 | `token_in`, `token_out`, `amount` |
| `analyze_wallet_pnl` | 盈亏分析 | `address` |
| `search_polymarket` | 预测市场 | `query` |

## 如何新增工具？

1. **定义 Schema**: 在 `router.py` 中使用 `tool` 装饰器定义参数。
2. **实现逻辑**: 在 `execute_custom_tool` 函数中添加对应的异步调用（例如调用某个特定的 Web3 API）。
3. **注册工具**: 将其添加到 `CUSTOM_TOOLS` 列表中。

---

> [!TIP]
> 优秀的工具描述（Description）是让 AI 选对工具的关键。请确保描述中包含清晰的使用场景提示。
