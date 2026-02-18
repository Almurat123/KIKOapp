---
mode: agent
description: API 文档速查技能 — 快速查找并提取任意 SDK/库/API 的官方文档
tools:
  - mcp_fetch_fetch
---

# API Doc Lookup Skill

快速查找技术文档，适用于项目中使用的所有外部依赖。

## 常用文档快速入口

| 技术 | 文档 URL |
|------|---------|
| Privy (Auth) | https://docs.privy.io |
| Alchemy SDK | https://docs.alchemy.com |
| Viem | https://viem.sh/docs |
| Ethers.js | https://docs.ethers.org/v6 |
| Solana Web3.js | https://solana-labs.github.io/solana-web3.js |
| Fastify | https://fastify.dev/docs/latest |
| Prisma | https://www.prisma.io/docs |
| Helius (Solana) | https://docs.helius.dev |
| Uniswap SDK | https://docs.uniswap.org |
| Polymarket | https://docs.polymarket.com |
| 0x Protocol | https://0x.org/docs |
| TrustWallet Assets | https://github.com/trustwallet/assets |

## 查询流程

1. 根据用户问题判断涉及哪个库/API
2. 用 `mcp_fetch_fetch` 直接打开对应文档入口
3. 根据文档导航结构，定位到具体章节
4. 提取相关代码示例和参数说明
5. 结合项目实际代码给出建议

## 使用示例

用户问："Privy 的 `getAccessToken` 返回什么格式？"

执行：
1. `fetch("https://docs.privy.io/reference/react-auth/hooks/usePrivy")` 
2. 搜索 getAccessToken 相关内容
3. 回答 + 给出官方链接

## 本项目使用的版本锁定文档

查询版本信息直接读 package.json：
- `/Users/almurat/KiKo/kiko-web/package.json`
- `/Users/almurat/KiKo/kiko-api/package.json`
