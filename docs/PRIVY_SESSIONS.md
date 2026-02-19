# Privy 登录后的 Session 与状态跟踪

本文档描述：**新用户通过 Privy 登录网站后，前端与后端存在哪些 session 及相关状态**，便于排查与跟踪。

---

## 1. 身份标识：Privy 用户 ID

- **JWT `sub`  claim**：Privy 签发的 JWT 里 `payload.sub` 即用户唯一标识（格式通常为 `did:privy:...`）。
- **后端统一用法**：所有需要「当前用户」的 API 都从 `(request as any).user.sub` 或 `getUserId(request)` 取得，与 DB 中 `User.privyDid` 一致。
- **数据库**：`User` 表以 `privyDid` 为唯一键；其他表通过 `userId` 外键关联到 `User.privyDid`。

---

## 2. 前端（浏览器）侧

### 2.1 Privy SDK 状态（由 Privy 管理）

| 状态 | 说明 |
|------|------|
| `usePrivy()` | `ready`, `authenticated`, `user`, `login`, `logout`, `getAccessToken()` |
| `user` | 当前用户对象：`id`、`linkedAccounts`（钱包、Farcaster 等）、`wallet`、嵌入式钱包的 `delegated` 等 |
| `getAccessToken()` | 获取当前会话的 JWT，用于调用后端 API |

Privy 可能在 localStorage 等位置持久化自己的状态（如 `privy:token`, `privy:user`, `privy:wallet`，见 `privyUtils.clearWalletData`），具体以 Privy 文档为准。

### 2.2 我们自己的 Token 桥接与缓存

| 位置 | 说明 |
|------|------|
| `AuthTokenBridge` | 把 `getAccessToken()` 注册到 `authToken.ts`，供所有 API 请求使用 |
| `authToken.ts` | 内存中缓存 token（约 5 分钟）、解析 JWT 过期时间、`getAuthToken()` / `clearAuthTokenCache()` |

前端**不维护**传统意义上的「HTTP session」或服务端 session id，每次请求带 `Authorization: Bearer <JWT>`。

### 2.3 前端其他持久化（与「登录后」相关）

| 存储 | 说明 |
|------|------|
| `kiko_active_chain_id` | 当前选链（localStorage） |
| `kiko_auto_auth_status` | 已删除的自动授权曾用（现未使用） |
| `kiko_auth_prompt_dismissed_*` | 授权提示弹窗「24h 内不再提示」 |
| `kiko_billing_consent_dismissed_*` | Billing 授权弹窗「24h 内不再提示」 |
| `kiko_delegated_*` | 某钱包地址是否曾完成 delegation（聊天内 DelegatedActionRequest） |
| 对话列表 / 当前会话 | 通常来自后端 `GET /api/chat/sessions` 与本地 state，不单独算一种「session」 |

---

## 3. 后端（API）侧

### 3.1 认证方式（无服务端 session 表）

- 每个请求：从 Header 取 `Authorization: Bearer <token>`，用 `verifyPrivyToken(token)`（JWKS）校验签名与过期。
- 校验通过后：`request.user = payload`（含 `sub`, `iat`, `exp`, `iss`, `aud`，可选 `sid`）。
- **无 Redis/内存 session 表**：不存「session id → user」映射，完全依赖 JWT。

### 3.2 Chat Session（聊天会话）

| 概念 | 说明 |
|------|------|
| **ChatSession** | 表 `ChatSession`，字段含 `id`, `userId`（= privyDid）, `title`, `model`, `status`, `updatedAt` 等 |
| **创建** | `POST /api/chat/sessions`（需 auth）→ `chatRepo.createSession(userId, title, model)` |
| **列表** | `GET /api/chat/sessions` → `chatRepo.getUserSessions(userId, limit, offset)`，按 `userId` 过滤 |
| **单条** | `GET /api/chat/sessions/:sessionId`，校验 `session.userId === request.user.sub` |

即：**每个「对话」是一条 ChatSession 记录**，`sessionId` 即 `ChatSession.id`，归属 `userId`（Privy sub）。

### 3.3 Chat WebSocket 连接

| 概念 | 说明 |
|------|------|
| **端点** | `GET /api/chat/ws` 或 `GET /v2/chat/ws`（WebSocket） |
| **鉴权** | 连接后首条消息需 `{ type: 'auth', token: '<Privy JWT>' }`（或 query `token=`）；服务端 `verifyPrivyToken(token)` 得到 `userId = payload.sub` |
| **状态** | `ChatWebSocketService.clients`: `Map<userId, Set<WebSocket>>`，即每个用户当前所有 WS 连接；无「session id → 连接」持久化，断线即从 Map 移除 |
| **会话维度** | 消息/事件带 `sessionId`（ChatSession id），用于广播到该会话、序列号与 buffer 按 `sessionId` 维护 |

所以：**WS 层只有「用户 ↔ 若干连接」的映射，会话仍是 DB 里的 ChatSession**。

### 3.4 其他按用户维度的数据（与「session」相关的表）

以下表都以 `userId`（= `User.privyDid`）关联用户，新用户登录后若未使用对应功能，可能尚无记录：

| 表/概念 | 说明 |
|---------|------|
| **User** | 首次需要时可能由业务创建或通过 webhook 同步；主键 `privyDid` |
| **UserSettings** | 用户设置，`userId` 唯一 |
| **ChatSession** | 见上文 |
| **CopyTradeConfig** | 跟单配置 |
| **FavoriteToken** | 收藏代币 |
| **SwapHistory** | 兑换历史 |
| **Position** | 跟单持仓等 |
| **WalletExport** | 导出记录 |
| **BillingConsent / billing_* ** | 计费与授权 |
| **Polymarket*** | Polymarket 相关配置与持仓 |

---

## 4. 总结：新用户 Privy 登录后「都有什么 session」

1. **Privy 会话（前端）**  
   - 由 Privy SDK 管理：`user`、`getAccessToken()`、可能有的 localStorage 等。  
   - 我们只通过 `AuthTokenBridge` 把 token 接到 `authToken.ts` 供请求使用。

2. **API 请求「会话」**  
   - 无服务端 session 表；每次请求用 JWT 的 `sub` 作为当前用户。

3. **Chat 会话（后端）**  
   - **ChatSession**：每个对话一条记录，`sessionId = ChatSession.id`，归属 `userId`。  
   - 列表：`GET /api/chat/sessions`；创建：`POST /api/chat/sessions`。

4. **WebSocket「连接」**  
   - 按用户维护：`userId → Set<WebSocket>`；鉴权用同一 JWT，得到 `userId`。  
   - 不单独存「WS session id」，事件里用 `sessionId` 指向 ChatSession。

5. **Privy Session Signers（授权）**  
   - 与「自动交易/代签」相关，由 Privy 的 `delegated` 等表示，不是 HTTP/WS 的 session。

若需**跟踪**某新用户：用其 JWT 的 `sub`（或登录后前端拿到的 `user.id`）在后端查 `User.privyDid`、`ChatSession.userId`、以及各业务表的 `userId` 即可。
