# 🌐 社交 Alpha 与预测洞察 (Detailed)

KiKo 通过两个核心维度挖掘市场的“共识机会”：Farcaster 的社交热度与 Polymarket 的真金白银博弈。

---

### 🐦 Farcaster：监听 Web3 社交脉搏

AI 直接调用 `fetch_farcaster_trending` 和 `search_farcaster_casts` 工具。

#### 常用指令
*   `“现在大家在关注什么项目？”` -> 触发**实时趋势摘要**。
*   `“搜索关于 $NOT 的最新讨论”` -> AI 会抓取最近 15-30 条 Casts 并提取核心观点。
*   `“总结一下这个聪明钱地址在 Farcaster 上的动态”` -> 配合 `get_farcaster_user` 实现。

<callout>
💡 **为什么选择 Farcaster？** 相比 Twitter，Farcaster 上的虚假机器人极少，数据的真实度和 Alpha 质量更高。
</callout>

---

### 🔮 Polymarket：追踪“现实赔率”

AI 负责将 Polymarket 的复杂盘口抽象为通俗易懂的胜率概率。

#### 核心调查工具
1.  `get_polymarket_trending`: 获取全网交易量最大的预测事件。
2.  `search_polymarket`: 搜索特定话题（如“大选”、“美联储降息”）。
3.  `get_polymarket_event`: 获取特定事件下各市场的**具体概率**。

#### 示例
> **用户**：`“最近大家都在赌什么？”`
> **AI 调用**：`get_polymarket_trending()`
> **AI 回复**：`“目前最火的是‘3月利率决议’，目前降息概率为 62%，比昨天上升了 5%...”`

---

### 🎨 联动策略：共识 -> 决策

<callout>
🔥 **实战路径**：
1.  **发现**：通过 Farcaster 看到某代币被频繁提及。
2.  **验证**：询问 AI `"这个币的早期买家是谁？"` (调用 `get_token_early_buyers`)。
3.  **下单**：确认无风险后，直接说 `"买入 $100"`。
</callout>

---

<callout>
📖 **关联文档**：
- [智能交易指令全集](trading-guide.md)
- [开发者：系统架构深度透视](architecture.md)
</callout>
