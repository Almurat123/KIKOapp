# API 接口文档

KiKo 的后端采用 FastAPI 构建，提供了一系列标准化的 RESTful 接口供前端调用。

## 核心接口列表

### 1. 对话流 (`POST /grok/chat`)
- **功能**: 发起 AI 对话，支持流式 (Streaming) 返回。
- **参数**:
  - `message`: 用户输入的文本。
  - `history`: 之前的聊天上下文。
- **鉴权**: 需要有效的 Privy Bearer Token。

### 2. 钱包余额 (`GET /api/wallets/:address/balance`)
- **功能**: 获取指定地址在特定链的资产分布。
- **Query Params**:
  - `chain`: eth, base, solana 等。

### 3. 工具执行 (`POST /api/tools/execute`)
- **功能**: 手动触发内部工具调用（通常由 AI 自动路由，但也支持 API 直接调用）。

### 4. 社交数据 (`GET /api/social/farcaster/trending`)
- **功能**: 拉取 Farcaster 最新的趋势 Casts。

## 认证说明

KiKo 所有的写入操作和敏感数据查询都强制要求 `Authorization` 头：
```bash
Authorization: Bearer <PRIVY_JWT_TOKEN>
```
开发者在本地调试时，可以通过设置环境变量 `SKIP_AUTH=true` 来绕过鉴权。

## OpenAPI 交互文档

启动 `kiko-python` 后，你可以访问以下地址查看完整的交互式 API 文档：
- `http://localhost:8000/docs` (Swagger UI)
- `http://localhost:8000/redoc` (ReDoc)
