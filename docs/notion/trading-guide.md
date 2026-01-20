# 🧠 智能交易与自动化指令 (Detailed)

在 KiKo 终端，每一句话都是一个指令。通过后端 `router.py` 的解析，AI 能将你的自然语言翻译成精确的智能合约参数。

---

### 🛒 基础交易指令 (Swap)

AI 与项目的 `prepare_swap_transaction` 工具深度集成，支持以下高级参数识别：

*   **精确买入**：`“Buy 50 USDC worth of $DEGEN on Base”`
*   **跨链兑换**：`“Swap my ETH from Mainnet to $SOL on Solana”` 【待补充：暂支持 Lifi 聚合资产跨链】
*   **清仓指令**：`“卖掉我账户里所有的 $MEME”` (AI 会先调用 `get_wallet_info` 获取余额，再构造交易)

<callout>
💡 **高级用法**：你可以指定 **滑点 (Slippage)**。例如：`“帮我买 $50 的币，允许 3% 的点差”`。AI 会自动在调用工具时传入 `slippage=3` 参数。
</callout>

---

### 🤖 自动化跟单系统 (Copy Trade)

这是集成在 `create_copy_trade_task` 工具中的高级功能：

1.  **追踪目标**：寻找一个“聪明钱”地址。
2.  **设置指令**：`“开启跟单！追踪地址 0x...，每次买入 $100，设置 50% 止盈”`。
3.  **参数映射**：
    *   `target_wallet`: 目标地址
    *   `buy_amount_usd`: 每笔投入
    *   `take_profit_pct`: 止盈比例 (50)
4.  **运行逻辑**：系统会在后台监听该地址的 Swap 行为，并在毫秒级内发起同步操作。

---

### 📈 组合分析指令

*   **PnL 透视**：`“分析这个大户的近 7 天盈亏情况：0x...”`
*   **早期买家扫描**：`“谁是这个代币（0x...）的前 10 位买家？”` (调用 `get_token_early_buyers`)
*   **官方动态深挖**：`“分析该代币的官网详情，找找他们的 Github 地址”` (调用 `analyze_website_deep`)

---

### 📊 预览卡 (Swap Card) 说明

当你发起交易时，前端 `kiko-web` 会渲染一个专属卡片：

| 字段 | 说明 | 逻辑来源 |
| :--- | :--- | :--- |
| **Price** | 当前代币价格 | `get_token_price` |
| **Slippage** | 容忍的最大价格波动 | 用户提示词或默认 0.5% |
| **Price Impact** | 本次交易对池子的影响 | 实时估算，>1% 会提示注意 |

<callout>
⚠️ **重要**：如果 AI 误解了你的意图，你可以直接纠正它，比如 `“不，我是在说 Base 链，不是 Solana”`，AI 会实时更新预览卡。
</callout>

---

<callout>
🚀 **去实战吧**：[返回首页](../../docs/notion/home.md) 或 [查看风控逻辑](risk-scan.md)
</callout>
