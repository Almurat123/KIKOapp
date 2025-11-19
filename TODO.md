# KIKO App 开发 TODO 清单

## 📋 概述
本文档提供 KIKO App 的详细开发步骤，按照优先级和依赖关系组织。建议按顺序完成。

---

## 🎯 Phase 0: 项目初始化

### 0.1 项目脚手架
- [x] 检查 `kiko-demo` 项目结构 ✅ (项目名为 `kiko-web`)
- [x] 确认 `package.json` 依赖完整 ✅
- [x] 运行 `npm install` 安装依赖 ✅
- [x] 配置 TypeScript (`tsconfig.json`) ✅
- [x] 配置 Vite (`vite.config.ts`) ✅
- [x] 配置 ESLint 和 Prettier ✅
- [x] 创建 `.env` 文件并配置环境变量 ✅ (`.env.example` 已创建)
- [x] 创建 `.gitignore` 确保不提交敏感文件 ✅

### 0.2 基础配置
- [x] 配置路径别名 (`@/components`, `@/features`, `@/pages`) ✅
- [x] 配置设计令牌（Design Tokens）CSS 变量 ✅ (`src/styles/variables.css`)
- [x] 配置响应式断点工具函数 ✅ (`src/utils/breakpoints.ts`)
- [x] 创建基础组件目录结构 ✅ (Button/Card/Chip/Dialog/Skeleton/Input/Select 已创建)
- [ ] 配置路由结构（React Router） ⚠️ (当前使用状态管理，未使用 React Router)

---

## 🎨 Phase 1: 全局布局与设计系统

### 1.1 设计令牌实现
- [x] 实现颜色系统（`--bg`, `--card`, `--text`, `--primary` 等） ✅
- [x] 实现阴影系统（`--elev-1`, `--elev-2`, `--elev-3`） ✅ (`--shadow-sm`, `--shadow-md`, `--shadow-lg`)
- [x] 实现圆角系统（`--radius-sm`, `--radius-md`, `--radius-lg`） ✅
- [x] 实现字体系统（基础字体、标题层级） ✅
- [x] 实现间距系统（4/8/12/16/24/32px） ✅ (`--space-1` 到 `--space-8`)

### 1.2 基础组件
- [x] `Button` 组件（主要/次要/危险/警告变体） ✅
- [x] `Card` 组件（基础卡片容器） ✅
- [x] `Chip` 组件（标签/筛选芯片） ✅
- [x] `Dialog` 组件（模态对话框） ✅
- [x] `Skeleton` 组件（加载骨架） ✅
- [x] `Input` 组件（文本输入） ✅
- [x] `Select` 组件（下拉选择） ✅

### 1.3 布局组件
- [x] `Sidebar` 组件（左侧导航栏，280px 宽度） ✅ (`src/components/Layout/Sidebar.tsx`)
- [ ] `Topbar` 组件（顶部导航栏） ⚠️
- [x] `Hamburger` 组件（移动端菜单） ✅ (集成在 `Layout.tsx` 中)
- [ ] 响应式布局系统（12 列栅格） ⚠️
- [x] 移动端侧边栏滑出动画 ✅

### 1.4 路由配置
- [x] 配置路由：`/` (Chat) ✅ (使用状态管理实现)
- [x] 配置路由：`/news` (News) ✅ (使用状态管理实现)
- [x] 配置路由：`/marketdata` 及其子路由 ✅ (使用状态管理实现)
- [x] 配置路由：`/superdefi` 及其子路由 ✅ (使用状态管理实现)
- [ ] 实现路由守卫（如需要） ⚠️ (当前使用状态管理，未使用 React Router)

---

## 💬 Phase 2: Chat 主界面


- [x] 实现自动滚动到底部 ✅
- [x] 实现"跳到底部"浮标 ✅
- [x] 实现消息分组（同一作者连续消息） ✅
- [x] 实现日期分隔 ✅
- [x] 实现"停止生成"按钮 ✅
- [x] 实现"继续生成"功能 ✅
- [x] 实现思考占位（3 点跳动） ✅

### 卡片组件
- [x] `TokenCard` 组件 ✅
  - [x] 代币基本信息展示 ✅
  - [x] 市场数据（价格、流动性、24h 交易量） ✅
  - [x] 风险评分 ✅
  - [x] 最近交易记录 ✅
- [x] `StrategyCard` 组件 ✅
  - [x] 策略类型显示 ✅
  - [x] 触发条件展示 ✅
  - [x] 限额约束展示 ✅
  - [x] 确认/取消按钮 ✅
- [x] `ExecutionPreviewCard` 组件 ✅
  - [x] 交易步骤展示（Approve + Swap） ✅
  - [x] 预估输出 ✅
  - [x] 滑点设置 ✅
  - [x] 风险提示 ✅
  - [x] 跨页链接 ✅
- [x] `ManualTradingConfirmationCard` 组件 ✅
  - [x] 实时价格、24h 交易量、流动性、市场深度 ✅
  - [x] 分步引导（选择链/代币 → 输入金额 → 设置滑点） ✅ (静态展示已实现)
  - [ ] 模板化填写 ⚠️ (需要交互式表单)
- [x] `AIReportCard` 组件 ✅
  - [x] 来源页面 ✅
  - [x] 核心洞察 ✅
  - [x] 关键指标 ✅
  - [x] 建议动作 ✅
  - [x] 相关链接 ✅

###  执行流程可视化
- [x] 实现进度条（`plan → risk_check → preview → confirm → execute`） ✅ (在 ExecutionPreviewCard 中实现)
- [x] 实现风险检查结果展示 ✅ (在 ExecutionPreviewCard 中实现)
- [x] 实现审计摘要查看 ✅ (在 ExecutionPreviewCard 中实现)
- [x] 实现阻断原因与建议展示 ✅ (风险警告已实现)

### AI 集成
- [x] 集成 DeepSeek API ✅
- [x] 实现 Intent 解析（自然语言 → JSON） ✅
- [x] 实现 Intent 类型映射（`token_info`, `swap`, `auto_buy` 等） ✅
- [x] 实现错误处理与重试 ✅

---

## 📊 Phase 3: MarketData 市场数据面板

### 3.1 概览页面 (`/marketdata/overview`)
- [ ] AIReport 区域（120–160px 高度）
- [ ] 关键指标卡片（Market Cap、24h Volume、Stablecoin Flows）
- [ ] 情绪仪表（Sentiment Gauge）
- [ ] 稳定币供应趋势图
- [ ] 涨跌排行榜（Top Gainers/Losers）
- [ ] 响应式布局（移动端堆叠）

### 3.2 链数据页面 (`/marketdata/chains`)
- [ ] AIReport 区域
- [ ] 链指标总览卡（TPS、Gas、Active、TVL）
- [ ] 链对比图表（Chains Comparison Chart）
- [ ] 桥接资产摘要（Bridge Assets Summary）
- [ ] 链明细表格（Chains Table）
- [ ] 响应式布局

### 3.3 代币分析页面 (`/marketdata/tokens`)
- [ ] AIReport 区域
- [ ] 搜索区（输入框、筛选、时间区间芯片）
- [ ] 代币价格摘要（Token Price Summary）
- [ ] K 线图表（K-Line Chart，使用 ECharts）
- [ ] 深度图（Depth Chart）
- [ ] 流动性趋势图（Liquidity Trend）
- [ ] 交易量趋势图（Volume Trend）
- [ ] 风险评分卡片（Risk Score Card）
- [ ] **热门代币展示**（Hot Tokens，100–140px 卡片，多维度筛选）
- [ ] 代币表格（Tokens Table）
- [ ] 响应式布局

### 3.4 链上活动页面 (`/marketdata/activity`)
- [ ] AIReport 区域
- [ ] 大户交易流（Whale Transactions Stream）
- [ ] 热门代币追踪（Trending Tokens）
- [ ] 聪明钱包行为（Smart Wallet Behaviors）
- [ ] 链上统计（On-chain Stats）
- [ ] 响应式布局

### 3.5 风险分析页面 (`/marketdata/risk`)
- [ ] AIReport 区域
- [ ] 风险雷达图（Risk Radar，使用 ECharts）
- [ ] 风险维度详情（Risk Dimensions Detail）
- [ ] 风险检测项（Risk Detections）
- [ ] **风险评估交互优化**：
  - [ ] 风险弹窗组件（RiskExplanationDialog）
  - [ ] 技术原理说明
  - [ ] 动态阈值警告系统（轻微/中等/严重/阻断）
  - [ ] 二次确认对话框（ConfirmationDialog）
  - [ ] 规则一致性展示（"价格偏差 > 50% 禁止交易"）
- [ ] 响应式布局

### 3.6 数据集成
- [ ] 集成 DexScreener API
- [ ] 集成 DeFiLlama API
- [ ] 集成 CoinGecko API
- [ ] 集成 RPC 节点（链上数据）
- [ ] 实现数据缓存（react-query）
- [ ] 实现错误处理与重试

---

## 📰 Phase 4: News 新闻情报页面

### 4.1 新闻流
- [ ] AIReport 区域
- [ ] 最新新闻流（Latest News Feed）
  - [ ] 卡片布局（100–140px 高度）
  - [ ] 标题、来源、时间、摘要、关联代币
- [ ] 社交趋势（Social Trending）
  - [ ] 热门帖子展示
  - [ ] 互动数据（评论、热度）
  - [ ] 情感标签（正面/负面）
- [ ] 精选故事（Featured Stories）

### 4.2 筛选与分类
- [ ] 主题筛选（DeFi/Technology/Regulation/NFT/Market）
- [ ] 时间筛选
- [ ] 来源筛选
- [ ] 移动端抽屉式筛选

### 4.3 数据集成
- [ ] 集成新闻数据源（CoinDesk、The Block 等）
- [ ] 集成社交媒体数据（Twitter、Reddit、Farcaster）
- [ ] 集成链上事件数据
- [ ] 实现数据聚合与去重

---

## 🏦 Phase 5: SuperDefi DeFi 协议整合

### 5.1 协议概览页面 (`/superdefi`)
- [ ] AIReport 区域
- [ ] 核心指标卡片（TVL、24h Volume、Active Pools、Users）
- [ ] TVL 趋势图
- [ ] 交易量趋势图
- [ ] 主要池/市场列表（Top Pools/Markets）
- [ ] 响应式布局

### 5.2 协议详情页面 (`/superdefi/protocol/:id`)
- [ ] AIReport 区域
- [ ] 头部信息（Hero）：协议名称、徽标、简介、关键指标
- [ ] 实时指标（Realtime Metrics）
- [ ] 多链分布（Multi-chain Distribution）
- [ ] 关键池表格（Key Pools）
- [ ] 协议风险评分（Protocol Risk Score）
- [ ] 用户活动模式（User Activity Patterns）
- [ ] 响应式布局

### 5.3 协议列表与筛选
- [ ] 协议选择器
- [ ] 协议分类筛选（DEX/借贷/衍生品/质押）
- [ ] 按链筛选
- [ ] 按 TVL 排序

### 5.4 数据集成
- [ ] 集成 DeFiLlama API（TVL、APY）
- [ ] 集成协议合约（直接查询）
- [ ] 集成链上索引器（TheGraph、Goldsky）
- [ ] 实现数据缓存

---

## 🔔 Phase 6: 通知与个性化系统

### 6.1 通知系统
- [ ] 通知设置页面 (`/settings/notifications`)
- [ ] 自定义阈值设置（价格/流动性/交易量/社交提及）
- [ ] 市场波动提醒开关
- [ ] 风险预警开关
- [ ] 重要新闻推送开关
- [ ] 通知渠道选择（应用内/Web 推送/邮件）
- [ ] 实现通知触发逻辑

### 6.2 个性化推荐
- [ ] 关注列表管理（链/协议/资产/钱包）
- [ ] 推荐偏好设置
- [ ] 数据优先级调整（拖拽排序）
- [ ] 实现推荐算法（基于行为分析）

---

## 🤖 Phase 7: AgentLink 跨页联动

### 7.1 事件总线
- [ ] 实现 `agent-link` 事件总线
- [ ] 实现事件订阅机制
- [ ] 实现事件发布机制

### 7.2 导航协议
- [ ] 实现 `agent://navigate` 协议解析
- [ ] 实现路由跳转与参数传递
- [ ] 实现上下文传递（`context.page`, `context.section`）

### 7.3 卡片协议
- [ ] 实现 `agent://open-card` 协议解析
- [ ] 实现在目标页面打开指定卡片
- [ ] 实现卡片数据传递

### 7.4 API 集成
- [ ] 集成 `POST /agent/report`（生成页面分析报告）
- [ ] 集成 `POST /agent/link`（创建跨页联动动作）
- [ ] 实现 Intent 上下文传递（`link.targets[]`）

### 7.5 页面集成
- [ ] 在所有主页面预留 AIReport 区域
- [ ] 实现 AIReportCard 实时展示
- [ ] 实现点击链接跳转功能

---

## 💰 Phase 8: 交易与策略系统

### 8.1 交易执行
- [ ] 集成 0x API（交易路由与报价）
- [ ] 实现交易计划生成（`POST /agent/tx/plan`）
- [ ] 实现交易预览（`POST /agent/tx/preview`）
- [ ] 实现交易执行（`POST /agent/tx/execute`）
- [ ] 实现 Approve + Swap 两步流程
- [ ] 实现用户签名确认

### 8.2 策略管理
- [ ] 策略列表页面 (`/strategies`)
- [ ] 策略创建对话框（StrategyDialog）
- [ ] 策略编辑功能
- [ ] 策略删除功能
- [ ] 策略状态管理（活跃/暂停/已触发）
- [ ] 集成 API：
  - [ ] `POST /agent/strategies`
  - [ ] `PATCH /agent/strategies/:id`
  - [ ] `DELETE /agent/strategies/:id`

### 8.3 触发器系统
- [ ] 触发器列表（TriggerList）
- [ ] 触发器注册（`POST /agent/triggers`）
- [ ] 触发器删除（`DELETE /agent/triggers/:id`）
- [ ] 触发器状态显示（监听中/已触发/已失效）
- [ ] 支持触发器类型：
  - [ ] `price_cross`
  - [ ] `price_drop_pct`
  - [ ] `liquidity_change_pct`
  - [ ] `wallet_activity`
  - [ ] `volume_spike`
  - [ ] `social_mention_score`

### 8.4 任务队列
- [ ] 任务队列状态页面 (`/status`)
- [ ] 任务列表展示（QueueStatusList）
- [ ] 任务状态显示（等待中/处理中/已完成/失败）
- [ ] 任务取消功能
- [ ] 集成 `GET /agent/queue`

---

## 🔐 Phase 9: 钱包管理

### 9.1 钱包连接
- [ ] 钱包连接对话框（WalletConnectionDialog）
- [ ] 集成 Privy SDK（托管钱包）
- [ ] 集成 MetaMask
- [ ] 集成 Rainbow
- [ ] 集成 Farcaster
- [ ] 集成 Binance Wallet
- [ ] 集成 WalletConnect v2
- [ ] 实现钱包状态显示（已连接地址、链信息）

### 9.2 授权管理
- [ ] 授权管理对话框（AllowanceDialog）
- [ ] 显示当前代币授权列表
- [ ] 撤销授权功能
- [ ] 修改授权额度功能
- [ ] 授权额度使用情况提示
- [ ] 高风险授权提醒
- [ ] 集成 `POST /agent/wallet/allowance`

### 9.3 密钥合规
- [ ] 确认不显示私钥/助记词输入框
- [ ] 实现钱包导出功能（仅在本地完成）
- [ ] 添加密钥合规提示文案

---

## 📊 Phase 10: 盈亏与历史记录

### 10.1 盈亏总览
- [ ] 盈亏展示页面 (`/history`)
- [ ] 数字总览区域（PnLSummaryCard）：
  - [ ] 策略盈亏
  - [ ] 累计 PnL
  - [ ] 胜率
  - [ ] 最大回撤
- [ ] 时间区间切换（24h/7d/30d/全部）
- [ ] 实时更新

### 10.2 历史交易明细
- [ ] 历史交易表格（TransactionHistoryTable）
- [ ] 表格列：交易日期、代币、执行价格、滑点、交易量、费用、策略、状态
- [ ] 筛选功能（按时间/资产/策略）
- [ ] 搜索功能
- [ ] 分页功能（每页 20 条）
- [ ] 排序功能
- [ ] CSV 导出功能

### 10.3 审计日志
- [ ] 审计日志列表（AuditLogList）
- [ ] 显示字段：`intent_id`、`user_id`、`risk_id`、`tx_hash`、`quote_snapshot`、`decision`
- [ ] 详细审计摘要查看（报价快照、风险结果、用户决策）
- [ ] 筛选与搜索功能
- [ ] 集成 `GET /agent/audit`

---

## 🧪 Phase 11: 测试与质量保障

### 11.1 单元测试
- [ ] 组件渲染测试
- [ ] 交互状态测试
- [ ] 响应式断点测试
- [ ] 工具函数测试

### 11.2 集成测试
- [ ] 卡片渲染与接口模拟
- [ ] 聊天自动滚动与发送行为
- [ ] 交易流程测试
- [ ] 策略创建与触发测试

### 11.3 视觉回归
- [ ] 关键布局快照
- [ ] 响应式快照
- [ ] 卡片样式快照

### 11.4 无障碍审计
- [ ] 键盘导航测试
- [ ] 对比度检查
- [ ] ARIA 标签检查
- [ ] 减少动画支持测试

---

## 🚀 Phase 12: 性能优化

### 12.1 数据层优化
- [ ] 实现请求缓存与去重
- [ ] 实现取消未完成请求
- [ ] 实现指数退避重试
- [ ] 实现断路与回退数据源

### 12.2 渲染优化
- [ ] 列表虚拟化（新闻/活动长列表）
- [ ] 代码分割（按路由与模块）
- [ ] 图表库懒加载
- [ ] 图像与图标优化

### 12.3 性能预算
- [ ] 首屏可用时间 ≤ 2.5s（中端手机）
- [ ] 路由切换 ≤ 300ms
- [ ] 实现性能监控

---

## 📱 Phase 13: 响应式与移动端优化

### 13.1 移动端布局
- [ ] 所有页面移动端适配
- [ ] 侧边栏汉堡菜单
- [ ] 移动端卡片堆叠
- [ ] 移动端表格转为卡片列表
- [ ] 移动端图表适配

### 13.2 移动端交互
- [ ] 触摸手势支持
- [ ] 移动端输入优化
- [ ] 移动端滚动优化
- [ ] 移动端性能优化

---

## 🔒 Phase 14: 安全与合规

### 14.1 安全实现
- [ ] 确认无私钥/助记词相关 UI
- [ ] 确认钱包仅处理授权与用户确认
- [ ] 实现风险提示可见性
- [ ] 实现交易确认机制

### 14.2 合规检查
- [ ] 用户协议与免责声明
- [ ] 风险提示文案
- [ ] 密钥合规提示
- [ ] 数据隐私政策

---

## 🎯 Phase 15: 部署与上线

### 15.1 生产环境配置
- [ ] 配置生产环境变量
- [ ] 配置 API 密钥（生产环境）
- [ ] 配置数据库（如需要）
- [ ] 配置 Redis（如需要）

### 15.2 前端部署
- [ ] 部署到 Vercel/Netlify
- [ ] 配置自定义域名
- [ ] 配置 CDN
- [ ] 配置环境变量

### 15.3 后端部署（如需要）
- [ ] 部署到 Vercel/Railway/AWS
- [ ] 配置数据库连接
- [ ] 配置 Redis 连接
- [ ] 配置监控与日志

### 15.4 CI/CD
- [ ] 配置 GitHub Actions
- [ ] 自动化测试流程
- [ ] 自动化部署流程

---

## ✅ 验收检查清单

### 功能验收
- [ ] 全页面响应式，移动端无横向滚动
- [ ] 聊天自动滚动与动效实现
- [ ] 三态渲染（加载/空/错误）完善
- [ ] 卡片契约字段完整且版本一致
- [ ] MarketData 图表与表格动态加载
- [ ] News 集成社交与情感标签
- [ ] 无私钥/助记词相关 UI
- [ ] API 路径与 Intent 展示一致
- [ ] 风险规则"价格偏差 > 50% 禁止交易"可见
- [ ] 手动交易确认卡片与 ExecutionPreviewCard 协同展示
- [ ] 风险评估弹窗与教程完整
- [ ] 动态阈值警告分级显示
- [ ] 盈亏展示与历史记录支持筛选与导出
- [ ] 策略管理界面功能完整
- [ ] AgentLink 跨页联动正常工作
- [ ] 通知与个性化设置功能完整

### 性能验收
- [ ] 首屏可用时间 ≤ 2.5s
- [ ] 路由切换 ≤ 300ms
- [ ] 无内存泄漏
- [ ] 无控制台错误

### 安全验收
- [ ] 无私钥/助记词泄露风险
- [ ] 所有交易需用户确认
- [ ] 风险提示可见
- [ ] 密钥合规实现

---

## 📝 注意事项

1. **优先级**：Phase 0-2 是基础，必须优先完成；Phase 3-5 是核心功能；Phase 6-10 是增强功能；Phase 11-15 是优化与上线。

2. **依赖关系**：某些 Phase 有依赖关系，建议按顺序完成。如需要并行开发，请确保依赖的 Phase 已完成。

3. **测试**：每个 Phase 完成后应进行基本测试，确保功能正常。

4. **文档**：重要功能实现后应及时更新文档。

5. **代码审查**：重要功能提交前应进行代码审查。

---

## 🎉 完成标准

当所有 Phase 完成且验收检查清单全部通过后，项目即可进入生产环境部署阶段。

