# KIKO App 项目准备清单

## 📋 概述
本文档列出开发 KIKO App 所需的所有准备工作，包括技术栈、工具、账户、环境配置等。

---

## 🛠️ 技术栈准备

### 前端技术栈
- [/] **Node.js** (v18+ 或 v20+)
- [/] **包管理器**：npm 或 yarn 或 pnpm
- [/] **框架**：React 18+
- [/] **语言**：TypeScript 5+
- [/] **构建工具**：Vite
- [/] **样式方案**：CSS Modules 或 CSS-in-JS (styled-components/emotion)
- [ ] **状态管理**：
  - [ ] `react-query` (服务端状态)
  - [ ] `Zustand` 或 `Jotai` (UI 状态)
- [ ] **路由**：React Router v6+
- [ ] **图表库**：
  - [ ] `ECharts` (复杂图表：K 线、雷达、深度图)
  - [ ] `Recharts` (轻量图表：柱线图、仪表)
- [ ] **UI 组件库**（可选）：shadcn/ui、Radix UI、或自建组件库
- [ ] **工具库**：
  - [ ] `date-fns` (日期处理)
  - [ ] `lodash` 或 `ramda` (工具函数)
  - [ ] `zod` (数据验证)

### 后端技术栈
- [/] **运行时**：Node.js (v18+ 或 v20+)
- [/] **框架**：Fastify 或 Express
- [/] **语言**：TypeScript
- [ ] **数据库**（如需要）：
  - [ ] PostgreSQL 或 MongoDB
  - [ ] Redis (缓存/队列)
- [ ] **ORM/ODM**：Prisma、TypeORM 或 Mongoose

### 区块链交互
- [/] **Web3 库**：
  - [/] `ethers.js` v6 或 `viem`
  - [/] `wagmi` (React Hooks for Ethereum)
- [ ] **钱包集成**：
  - [ ] Privy SDK (托管钱包)
  - [ ] WalletConnect v2
  - [ ] MetaMask、Rainbow、Farcaster 等钱包适配器
- [ ] **RPC 节点**：
  - [ ] Infura 或 Alchemy 账户（多链 RPC）
  - [ ] 或自建节点

### AI 集成
- [/] **AI API**：
  - [/] DeepSeek API 账户与密钥
  - [ ] 备用方案：OpenAI API、Anthropic API

### 数据源 API
- [ ] **0x API**：交易路由与报价
  - [ ] 注册账户获取 API Key
- [ ] **市场数据**：
  - [ ] DexScreener API
  - [ ] DeFiLlama API
  - [ ] CoinGecko API
- [ ] **链上索引器**：
  - [ ] TheGraph 子图（如需要）
  - [ ] Goldsky API
- [ ] **价格预言机**：
  - [ ] Chainlink 数据源
  - [ ] Band Protocol（如需要）

---

## 🔑 账户与密钥准备

### 必需账户
- [ ] **DeepSeek API**：注册账户，获取 API Key
- [ ] **0x API**：注册账户，获取 API Key
- [ ] **RPC 节点服务**：
  - [ ] Infura 账户（Ethereum、Base、Arbitrum 等）
  - [ ] 或 Alchemy 账户
- [ ] **数据源账户**：
  - [ ] DexScreener API Key（如需要）
  - [ ] DeFiLlama API Key（如需要）
  - [ ] CoinGecko API Key（如需要）

### 开发环境密钥
- [ ] 创建 `.env` 文件模板
- [ ] 配置以下环境变量：
  ```
  # AI
  DEEPSEEK_API_KEY=your_key_here
  
  # Blockchain
  INFURA_API_KEY=your_key_here
  ALCHEMY_API_KEY=your_key_here
  
  # 0x API
  ZEROX_API_KEY=your_key_here
  
  # Data Sources
  DEXSCREENER_API_KEY=your_key_here
  DEFILLAMA_API_KEY=your_key_here
  COINGECKO_API_KEY=your_key_here
  
  # Privy
  PRIVY_APP_ID=your_app_id
  PRIVY_APP_SECRET=your_app_secret
  
  # Database (if needed)
  DATABASE_URL=your_database_url
  REDIS_URL=your_redis_url
  
  # Server
  PORT=3000
  NODE_ENV=development
  ```

---

## 🏗️ 开发环境准备

### 开发工具
- [/] **代码编辑器**：VS Code（推荐）或 WebStorm
- [/] **Git**：版本控制
- [/] **GitHub/GitLab**：代码仓库
- [/] **浏览器**：
  - [/] Chrome/Edge（开发调试）
  - [/] MetaMask 扩展（测试钱包）
  - [/] Rainbow 扩展（测试钱包）

### VS Code 扩展（推荐）
- [/] ESLint
- [/] Prettier
- [/] TypeScript Vue Plugin (Volar)
- [/] Tailwind CSS IntelliSense（如使用 Tailwind）
- [/] GitLens
- [/] Error Lens

### 本地开发环境
- [/] **Node.js 环境**：
  ```bash
  node --version  # 确保 v18+
  npm --version
  ```
- [/] **Git 配置**：
  ```bash
  git config --global user.name "Your Name"
  git config --global user.email "your.email@example.com"
  ```
- [/] **项目目录结构**：
  ```
  Kiko/
  ├── kiko/        # 前端项目
  ├── backend/          # 后端项目（如需要）
  ├── Kiko.md          # 产品文档
  ├── DesignPage.md    # 设计文档
  └── ...
  ```

---

## 📦 项目依赖准备

### 前端依赖（kiko-demo）
检查 `package.json`，确保包含：
- [ ] React 相关：`react`, `react-dom`, `react-router-dom`
- [ ] TypeScript：`typescript`, `@types/react`, `@types/node`
- [ ] 构建工具：`vite`, `@vitejs/plugin-react`
- [ ] 样式：`tailwindcss`（如使用）或 CSS Modules
- [ ] Web3：`ethers` 或 `viem`, `wagmi`, `@privy/react`
- [ ] 状态管理：`@tanstack/react-query`, `zustand`
- [ ] 图表：`echarts`, `recharts`
- [ ] 工具库：`date-fns`, `zod`, `lodash`

### 后端依赖（如需要）
- [ ] Fastify 或 Express
- [ ] TypeScript 配置
- [ ] 数据库驱动
- [ ] 环境变量管理：`dotenv`

---

## 🔐 安全与合规准备

### 密钥管理
- [ ] 使用 `.env` 文件存储敏感信息
- [ ] 将 `.env` 添加到 `.gitignore`
- [ ] 创建 `.env.example` 模板（不含真实密钥）
- [ ] 使用密钥管理服务（生产环境）：AWS Secrets Manager、Vercel Environment Variables 等

### 合规检查清单
- [ ] 确认不生成/传输私钥/助记词的实现方案
- [ ] 确认钱包导出仅在本地完成的流程
- [ ] 确认系统不留存密钥的架构设计
- [ ] 准备用户协议与免责声明
- [ ] 准备风险提示文案

---

## 🧪 测试环境准备

### 测试钱包
- [ ] 准备测试网钱包（每个链）：
  - [ ] Ethereum Sepolia/Goerli
  - [ ] Base Sepolia
  - [ ] Arbitrum Sepolia
  - [ ] Polygon Mumbai
- [ ] 获取测试网代币（水龙头）
- [ ] 准备测试账户（用于自动化测试）

### 测试数据
- [ ] 准备测试代币地址列表
- [ ] 准备测试交易对
- [ ] 准备模拟数据（开发阶段）

---

## 📚 文档与资源

### 文档准备
- [ ] 阅读 `Kiko.md`（产品文档）
- [ ] 阅读 `DesignPage.md`（设计文档）
- [ ] 准备 API 文档模板
- [ ] 准备开发指南模板

### 学习资源
- [ ] 熟悉 React + TypeScript
- [ ] 熟悉 Web3 开发（ethers.js/viem）
- [ ] 熟悉 0x API 文档
- [ ] 熟悉 Privy 文档
- [ ] 熟悉 DeepSeek API 文档

---

## 🚀 部署准备（后期）

### 前端部署
- [ ] **Vercel** 账户（推荐）或 **Netlify**
- [ ] 配置环境变量
- [ ] 配置自定义域名（如需要）

### 后端部署（如需要）
- [ ] **Vercel**（Serverless）或 **Railway** 或 **AWS**
- [ ] 数据库服务（如需要）：Supabase、PlanetScale、MongoDB Atlas
- [ ] Redis 服务（如需要）：Upstash、Redis Cloud

### CI/CD
- [ ] GitHub Actions 配置（如需要）
- [ ] 自动化测试流程
- [ ] 自动化部署流程

---

## ✅ 检查清单

在开始开发前，请确认：

- [ ] ✅ Node.js 环境已安装并配置
- [ ] ✅ 所有必需的 API 账户已注册
- [ ] ✅ 所有 API Key 已获取并安全存储
- [ ] ✅ 开发工具已安装
- [ ] ✅ 项目依赖已安装
- [ ] ✅ 环境变量已配置
- [ ] ✅ 测试钱包已准备
- [ ] ✅ 文档已阅读
- [ ] ✅ Git 仓库已创建并配置

---

## 📝 下一步

完成以上准备后，请查看 `TODO.md` 获取详细的开发步骤清单。

