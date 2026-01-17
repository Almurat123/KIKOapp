# 支持的区块链

KiKo 是一个真正的多链 (Multi-Chain) 终端，目前主要支持 EVM 兼容链和 Solana。

## 区块链列表与功能支持

| 链名称 | 链 ID | 交易支持 | 安全扫描 | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| **Ethereum** | 1 | ✅ | ✅ | 主网，Gas 较高 |
| **Solana** | - | ✅ | ✅ | 极速，低成本 |
| **Base** | 8453 | ✅ | ✅ | L2，社交/模因币中心 |
| **BSC** | 56 | ✅ | ✅ | 高并发，低费率 |
| **Arbitrum** | 42161 | ✅ | ✅ | 高性能 L2 |
| **Polygon** | 137 | ✅ | ✅ | 成熟生态 |

## 本地 RPC 配置

为了保证极速的交易预览和余额查询，建议在 `.env` 中配置高质量的 RPC 节点（如 Alchemy, Infura 或 QuickNode）。

```env
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/...
SOL_RPC_URL=https://api.mainnet-beta.solana.com
BASE_RPC_URL=...
```

## 未来计划

我们正在计划接入更多的非 EVM 链，包括：
- **Sui / Aptos**: 追求极致性能。
- **Berachain**: 针对流动性共识的深度集成。

---

> [!IMPORTANT]
> KiKo 的 AI 会根据你的当前连接钱包自动切换默认链，但你也可以在对话中显式指定，例如：“Check price on Base”。
