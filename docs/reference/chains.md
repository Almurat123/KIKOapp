# ⛓️ 支持的区块链

KiKo 是一个真正的多链 (Multi-Chain) 终端，我们致力于打破生态屏障，让你在一个对话框内触达 Web3 的每一个角落。

---

### 🌐 当前支持的公链生态

| 链名称 | 链 ID | 核心功能支持 | 状态 |
| :--- | :--- | :--- | :--- |
| **Ethereum** | 1 | 交易、风险扫描、历史 PnL | ✅ 稳定 |
| **Solana** | - | 极速交易、代币分析 | ✅ 稳定 |
| **Base** | 8453 | 社交交易、低成本换币 | ✅ 推荐 |
| **BSC** | 56 | 代币价格、合约扫描 | ✅ 稳定 |
| **Arbitrum** | 42161 | L2 高速交易 | ✅ 稳定 |

---

### ⚙️ RPC 节点配置建议

为了确保 AI 获取数据的时效性，KiKo 后端深度集成了以下基础设施。如果你是开发者，建议在 `.env` 中配置自己的 Private RPC 以获得更高带宽：

*   **Alchemy**: 推荐用于 Ethereum / Arbitrum / Polygon。
*   **QuickNode**: 推荐用于 Solana 的高并发查询。
*   **LlamaNodes**: 用于获取最低延迟的 Gas 预估。

<callout> 💡 Tips: 即使你没有在对话中指明链，AI 也会根据你当前连接的钱包地址，智能推断出目标链环境。 </callout>

---

### 🚧 未来集成计划

我们正在积极开发以下生态的接入适配：
*   **Sui & Aptos** (Move 生态)
*   **Monad & Berachain** (新一代高性能 EVM)

<callout> ⚠️ Warning: 跨链交易（Cross-chain Swaps）依赖于集成商（如 Lifi）的流动性深度。在低流动性链间跨桥时，请注意价格冲击预警。 </callout>
