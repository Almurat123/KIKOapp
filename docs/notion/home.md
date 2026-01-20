# 🏠 KiKo 核心生态：AI 驱动的链上导航

### 什么是 KiKo？

**KiKo** 是一个将 **大型语言模型 (xAI Grok)** 与 **链上执行引擎 (Tool Calling Framework)** 深度融合的 Web3 终端。

我们在 `kiko-python` 后端构建了一套精密的“意图路由”系统，利用 AI 的通用推理能力，直接调动复杂的 DeFi 协议与安全审计接口。

---

### 🌊 核心能力矩阵

<callout>
🚀 **对话即交易**：不再需要配置滑点、查找路由。只需说 “Buy”，后台会自动调用 [**Lifi/Jupiter**] 寻找最优路径。
</callout>

<callout>
🛡️ **主动风险防御**：在签名之前，AI 会调用 `check_token_risk` 扫描合约，识别蜜罐、税收陷阱与老鼠仓。
</callout>

<callout>
🌐 **社交 Alpha 洞察**：实时接入 Farcaster 舆情数据与 Polymarket 预测赔率，帮你抢在市场变动前做出决策。
</callout>

---

### 🗺️ 文档地图

*   **新手区 (Users)**
    *   [**快速开始**](getting-started.md)：从 0 到 1 开启你的 AI 钱包。
    *   [**交易指令集**](trading-guide.md)：如何通过对话发起 Swap 与 Copy Trade。
*   **专家区 (Analytics)**
    *   [**深度风控详情**](risk-scan.md)：解读 `Security Score` 背后的逻辑。
    *   [**社交舆情追踪**](social-alpha.md)：利用 Farcaster 与 Polymarket 寻找机会。
*   **开发者区 (Docs)**
    *   [**系统架构总览**](architecture.md)： entender  `router.py` 与 Agent 的协同工作流。

---

### 💬 常见问题 (FAQ)

**Q: 为什么我需要用 AI 来交易，而不是直接去 Uniswap？**
A: 因为 KiKo 能在交易前为你完成 **[安全扫描] + [跨链比价] + [社交背书]** 的综合判断。

**Q: 我的私钥安全吗？**
A: KiKo 采用 **Privy** 进行私钥托管与认证。这意味着我们只在本地执行环境根据用户的显式指令调用签名权限，团队无法获取你的私钥明文。

---

<callout>
💡 **下一步提示**：通过 [**快速开始**](getting-started.md) 连接你的第一个钱包。
</callout>
