---
mode: ask
description: KiKo 项目代码 Review 清单，覆盖前端(React/Vite)、后端(Fastify/Prisma)、区块链(EVM/Solana)
---

# KiKo Code Review Checklist

## 通用规范

- [ ] 无 TypeScript `any` 类型（除非有明确注释说明原因）
- [ ] 无 `console.log` 遗留在生产代码中
- [ ] 无硬编码的 API URL（应使用 `import.meta.env.VITE_API_URL` 或 `process.env`）
- [ ] 错误都有捕获处理，不使用空 catch
- [ ] 注释使用 `[Logic]:`/`[Risk]:`/`[Ref]:` 标注模式（参考现有代码风格）

## 前端 (kiko-web)

### React 组件
- [ ] Hook 依赖数组完整（ESLint exhaustive-deps 无警告）
- [ ] 异步数据请求有竞态条件保护（参考 `useWalletPageData.ts` 的 `reqId` 模式）
- [ ] 大列表使用虚拟滚动或分页（不要渲染 500+ DOM 节点）
- [ ] 图片/Token Logo 有 onError fallback

### 状态管理
- [ ] 全局状态变更有防抖/竞争保护
- [ ] 缓存 TTL 合理（参考 `TX_CACHE_TTL_MS = 60_000`）
- [ ] loading/error 状态都有处理

### Privy / 钱包
- [ ] 使用 `getAccessToken()` 获取 JWT，不要硬编码 token
- [ ] EVM 和 Solana 地址分开处理（不混用）
- [ ] 链 ID 变更时重新请求数据

## 后端 (kiko-api)

### Fastify 路由
- [ ] 所有路由有 `requireAuth` 中间件
- [ ] 路由内调用 `getUserId(request)` 验证用户
- [ ] 资源访问有鉴权（用户只能访问自己的数据）
- [ ] 返回格式统一：`{ success: true, data: ... }` / `{ success: false, message: '...' }`
- [ ] 所有 import 使用 `.js` 扩展名（ESM）

### 缓存策略
- [ ] 频繁查询有内存 Map 缓存（带 TTL）
- [ ] 重要数据有 Redis 二级缓存
- [ ] 并发请求有 inflight 去重（参考 `allBalancesInflight`）

### 区块链数据
- [ ] Spam token 过滤（检查 name/symbol 是否含 `t.me`、`airdrop` 等）
- [ ] 金额精度处理用 `BigInt` 或 `ethers.formatUnits`，不用浮点直接运算
- [ ] 链名称统一（`eth`/`base`/`arbitrum`/`optimism`/`polygon`/`bsc`/`solana`）

## 安全

- [ ] 无私钥/助记词出现在代码或注释中
- [ ] 用户输入有验证（不直接拼接到 SQL 或 RPC 调用）
- [ ] API Key / Secret 只在环境变量，不在代码里

## 性能

- [ ] Alchemy/Helius 等外部 API 调用次数合理（有缓存，不在每次渲染触发）
- [ ] 多链数据并行获取（`Promise.all`），不串行
- [ ] Solana 和 EVM 代码路径分离，不相互依赖

## 提交前

- [ ] `cd kiko-web && npm run build` 无错误
- [ ] `cd kiko-api && npm run build` 无错误
- [ ] 改动的文件无 TypeScript 语法错误
- [ ] Docker compose 相关改动已测试
