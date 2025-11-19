# KIKO App 前端设计要求

## 总体原则
- 视觉风格温暖简洁，背景米白色，信息清晰可读，风格与 ChatGPT 近似但品牌化。
- 前端组件必须响应式，移动端与桌面端体验一致。
- 模块化文件结构，每个功能独立文件与组件，复用通用基础组件。
- 严格安全与合规：不生成或展示私钥/助记词；所有交易需用户明确确认；风险提示可见。

## 信息架构与路由
- 路由与页面结构与产品文档一致：
```
/                    → Chat 主界面
/news                → News 新闻情报页面
/marketdata          → MarketData 面板
  /overview          → 市场概览
  /chains            → 链数据
  /tokens            → 代币分析
  /activity          → 链上活动
  /risk              → 风险分析
/superdefi           → SuperDefi 协议面板
  /protocol/:id      → 协议详情页
```
- 全局导航：品牌Logo、新聊天、最近聊天、链接钱包、页面链接。

## 布局系统
- 桌面端：左侧固定侧边栏（约 280px），右侧主内容 12 列栅格，页内模块用卡片块组织。
- 移动端：侧边栏进入汉堡菜单，点击滑出（平滑动画），主内容单列布局。
- Chat 页面：
  - 欢迎区居中，四周显示 3–5 个简短提示气泡（圆角、淡入动画）。
  - 输入框聚焦时，消息列表滚动锚点定位到底部，保证连续输入的沉浸感。
  - 消息发送后自动滚动到底部，仅在用户接近底部时启用平滑过渡，避免抢焦点。

## 响应式断点
- `xs ≤ 480`、`sm ≤ 768`、`md ≤ 1024`、`lg ≤ 1440`、`xl ≥ 1440`
- 移动端单列；平板常用双列；桌面端 12 列栅格；图表与表格自适应宽度，移动端不出现横向滚动。

## 设计令牌（Design Tokens）
- 颜色：`--bg:#FAF7F2`、`--card:#FFFFFF`、`--text:#111`、`--muted:#666`
- 强调色：`--primary:#5B8DEF`、`--success:#3BA55D`、`--danger:#E45454`、`--warning:#F4B740`
- 阴影：`--elev-1`、`--elev-2`、`--elev-3`（轻到重）
- 圆角：`--radius-sm:8px`、`--radius-md:12px`、`--radius-lg:16px`
- 字体：基础 `16px`；`h1 28`、`h2 22`、`h3 18`；行高 `1.5`
- 间距：4/8/12/16/24/32 px 节奏

## 动效与交互
- 气泡与卡片淡入、位移过渡；按钮与输入的 hover/focus 细微阴影与色彩变化。
- 聊天自动滚动、发送动效 150–300ms；支持降低动效（系统“减少动画”时退化）。
- 移动端侧边栏滑出时锁定页面滚动，遮罩层点击关闭，保证焦点陷阱与可访问性。

## 无障碍（Accessibility）
- 文本对比度 ≥ 4.5:1；键盘可达；焦点样式清晰；跳转到内容快捷键。
- 图表提供可读的图例、标签与替代说明；支持“减少动画”偏好。

## 安全与合规
- 不生成、不传输私钥或助记词；导出仅在用户本地钱包端完成；系统不留存密钥。
- 交易操作需用户明确确认；不提供投资建议；展示风险提示与审计信息。
- 对“价格偏差 > 50% 禁止交易”的规则在相关卡片与预览中明确告知。

## 页面设计

### Chat（聊天）
- 欢迎区域：居中布局，简短提示气泡（圆角、淡入动画）。
- 布局与排版（对标 ChatGPT/Gemini）：
  - 视口宽度 `lg`/`xl` 下会话容器最大宽度 `760px`，两侧留白；`md` 以下容器自适应 100% 减去内边距。
  - 用户消息（右侧）使用气泡样式：圆角 `16px`，背景 `--primary` 10% 透明，文字颜色深色；气泡尾巴与边距对齐右侧。
  - AI 消息（左侧）不使用气泡，采用无边框内容块：背景 `--card`，顶部留出头像与名称区，正文排版更贴近文档阅读。
  - 同一作者连续消息进行分组：组内消息上下间距 `8px`，组与组之间 `16px`；日期分隔 `24px`。
  - 头像：AI 左侧圆形头像 `24px`；用户右侧头像 `24px`；显示名称（AI/You）与时间戳 `12px` 灰色。
  - 时间戳位置：用户消息右下角，AI 消息左上角名称旁；长消息采用组级时间戳。
  - 消息宽度：单条消息最大宽度不超过容器宽度的 `85%`（避免超宽难读）。
  - 代码块：等宽字体、行号可选、复制按钮；暗色面板与浅色页面形成对比；水平滚动保留但容器内边距增大。
  - Markdown 支持：标题层级、列表、表格、引用、链接；表格在移动端转为横滑容器并保留表头冻结。
  - 引用与继续：长消息底部显示“复制/引用/继续生成”操作；用户消息支持“编辑并重试”。
  - 消息操作：复制、点赞/点踩（反馈）、三点菜单（分享、固定、举报）。
- 消息列表：虚拟化渲染避免性能问题；靠近底部时启用平滑自动滚动；远离底部时显示“跳到底部”浮标。
- 输入框：多行输入、`Enter` 发送（`Shift+Enter` 换行）、附件芯片（代币地址/链选择），发送/停止按钮；执行中禁用；底部显示建议提示词（Chips）。
- 上下文芯片：在输入框上方展示当前上下文（所选链/代币/页面来源），可关闭或切换；与 Agent 联动。
- 输出卡片：
  - TokenCard：名称/符号/精度，价格、流动性、24h 交易量、风险评分、最近交易。
  - StrategyCard：策略类型、目标代币、触发条件（含 `window_s`/`min_duration_s`）、执行金额、限额约束（`max_usd_per_day`/`max_trades_per_day`/`cooldown_s`）。
  - ExecutionPreviewCard：步骤（Approve + Swap）、预估输出、滑点设置、风险提示、`risk_id`。
  - AIReportCard（跨页分析）：来源页面、核心洞察、关键指标、建议动作、相关链接（可跳转 MarketData/News/SuperDefi）。
- 执行流程可视化：`plan → risk_check → preview → confirm → execute` 阶段进度条，风险检查结果与审计摘要可见；当风险触发时显示阻断原因与建议。

#### Chat 排版网格与分布
- 容器：居中栅格 `max-width:760px`，左右内边距 `24px`；移动端内边距 `16px`。
- 顶部区：欢迎横幅高度 `120px`；下方提示气泡 3–5 个，间距 `12px`，对齐栅格左右边界。
- 会话区：
  - 行间距：消息组间 `16px`，组内 `8px`；日期分隔 `24px`。
  - 用户气泡内边距 `12px 16px`；AI 内容块内边距 `16px 20px`；代码块内边距 `12px 16px`，最小高度 `40px`。
  - 头像位置：用户右边距 `8px`；AI 左边距 `8px`；名称与时间戳行高 `18px`。
- 输入区：
  - 输入框高度自适应，最小高度 `44px`，最大高度 `160px`；内边距 `10px 12px`。
  - 附件芯片区域高度 `36px`；芯片间距 `8px`；左右边距 `12px`。
  - 操作按钮区宽度 `fit-content`，按钮间距 `8px`；发送主按钮最小宽 `96px`。

#### Chat Streaming 输出规范
- 输出形态：AI 文本采用打字式流输出（streaming），每帧追加内容到现有消息块。
- 流速与节奏：默认 30–60 FPS 等效输出节奏，长文本分段追加；代码块优先完整片段后再渲染高亮，避免闪烁。
- 滚动行为：当视口接近底部时保持自动滚动；远离底部时不抢焦点，显示“跳到底部”浮标。
- 中断与继续：提供“停止生成”按钮；停止后显示已生成内容并提供“继续生成”入口。
- 思考占位：在输出前显示思考占位（3 点跳动），最长 3 秒或直到首帧到达；超时显示“等待数据源”提示。
- 复制与引用：流输出过程中允许复制已生成片段；引用按钮会插入已生成文本到输入框尾部。
- 语义块分割：对标题/列表/段落边界启用块级缓冲，优先完整块落盘再渲染，保证排版稳定。

### MarketData（市场数据）
- 概览：全球市值、24h 交易量、稳定币流动、情绪指标（时间区间 24h/7d/30d）。
- 链数据：TPS、Gas、活跃钱包、TVL，多链对比卡片与图表。
- 代币：地址/名称搜索；价格、流动性、24h 交易量；K 线、深度图；风险评分。
- 活动：大户交易、聪明钱包行为、热门代币排行、链上统计流。
- 风险：雷达图、风险维度与检测项；显式提示“价格偏差 > 50% 禁止交易”。
- 移动端：卡片化堆叠；图表与表格填满容器宽度；无横向滚动。
 - AI 分析报告：在每个子页面顶部预留 AIReport 区域，展示 Agent 的最新洞察、数据冲突提示与操作建议；与 Chat 页面联动（点击可跳转或生成卡片）。

#### MarketData 简约设计策略
- 渐进披露：默认仅展示关键指标与一张核心图；高级维度以折叠面板呈现，点击展开。
- 密度模式：支持 `紧凑`/`舒适` 两种密度，影响表格行高（`40px/56px`）与卡片内边距。
- 粘性筛选条：顶部固定筛选（链、时间区间、类别），移动端为抽屉式筛选。
- 快速统计：重要指标（市值、24h量、稳定币流）以一行卡片呈现，点击进入详情页或展开更多。
- 空间节约：多图表并列时采用最小高度与简化图例；在移动端仅保留关键轴与数据点。

#### MarketData 概览（/overview）布局
- 栅格：12 列；列间距 `16px`；行间距 `16px`。
- 顶部（AIReport 区域）：跨 12 列，高度 `120–160px`。
- 第一行（关键指标）：
  - `Market Cap` 跨 4 列，高 `120px`
  - `24h Volume` 跨 4 列，高 `120px`
  - `Stablecoin Flows` 跨 4 列，高 `120px`
- 第二行（情绪与趋势）：
  - `Sentiment Gauge` 跨 4 列，高 `240px`
  - `Stablecoin Supply Trend` 跨 8 列，高 `240px`
- 第三行（涨跌榜）：
  - `Top Gainers` 跨 6 列，高 `320px`
  - `Top Losers` 跨 6 列，高 `320px`
- 移动端：顺序为 AIReport → 三指标 → 供给趋势 → 情绪仪表 → 涨跌榜；全部跨 12 列，卡片堆叠。

##### 组件与字段
- Market Cap：`value`、`change24h`、`lastUpdated`
- 24h Volume：`value`、`change24h`、`dominance`
- Stablecoin Flows：`netFlow`、`inflow`、`outflow`
- Sentiment Gauge：`score`、`trend`
- Stablecoin Supply Trend：`series[{time,value}]`
- Top Gainers/Losers：列 `Token/ Price/ Change24h/ Volume/ Liquidity/ Risk`

#### MarketData 链数据（/chains）布局
- 顶部（AIReport）：跨 12 列，高 `120–160px`。
- 第一行（链指标总览卡）：
  - `TPS` 跨 3 列，高 `140px`
  - `Gas Price` 跨 3 列，高 `140px`
  - `Active Wallets` 跨 3 列，高 `140px`
  - `TVL` 跨 3 列，高 `140px`
- 第二行（链对比图）：
  - `Chains Comparison Chart` 跨 8 列，高 `360px`
  - `Bridge Assets Summary` 跨 4 列，高 `360px`
- 第三行（链明细表）：
  - `Chains Table` 跨 12 列，高 `auto`，分页；列包含 `Chain/ TPS/ Gas/ Active/ TVL/ 24h Tx`。
- 移动端：指标卡堆叠；对比图与摘要上下排列；表格转为卡片列表，每项显示核心列并支持展开。

##### 组件与字段
- TPS/ Gas/ Active/ TVL 卡片：各自 `value`、`change24h`
- Chains Comparison Chart：`series[{chain,metric,time,value}]`
- Bridge Assets Summary：`totalBridged`、`topBridges[]`
- Chains Table：`Chain/ TPS/ Gas/ Active/ TVL/ 24h Tx`

#### MarketData 代币（/tokens）布局
- 顶部（AIReport）：跨 12 列，高 `120–160px`。
- 搜索区：跨 12 列，高 `80px`，包含输入框、筛选（链/类别）、时间区间芯片。
- 第一行（价格与K线）：
  - `Token Price Summary` 跨 4 列，高 `180px`
  - `K-Line Chart` 跨 8 列，高 `360px`
- 第二行（深度与流动性）：
  - `Depth Chart` 跨 6 列，高 `320px`
  - `Liquidity Trend` 跨 6 列，高 `320px`
- 第三行（交易量与风险）：
  - `Volume Trend` 跨 6 列，高 `320px`
  - `Risk Score Card` 跨 6 列，高 `240px`
- 第四行（结果列表）：
  - `Tokens Table` 跨 12 列，高 `auto`；列包含 `Token/ Price/ Liquidity/ 24h Volume/ Risk`。
- 移动端：搜索区 → 价格摘要 → K线 → 深度 → 流动性 → 交易量 → 风险 → 表格卡片列表。

##### 组件与字段
- Token Price Summary：`price`、`change24h`、`marketCap`
- K-Line：`series[{time,open,high,low,close,volume}]`
- Depth Chart：`bids[]`、`asks[]`
- Liquidity Trend：`series[{time,value}]`
- Volume Trend：`series[{time,value}]`
- Risk Score Card：`score`、`dimensions{price,liquidity,volume,tax,lock}`
- Tokens Table：`Token/ Price/ Change24h/ Volume/ Liquidity/ Risk`

#### MarketData 活动（/activity）布局
- 顶部（AIReport）：跨 12 列，高 `120–160px`。
- 第一行：
  - `Whale Transactions Stream` 跨 7 列，高 `auto`，条目高度 `80–120px`
  - `Trending Tokens` 跨 5 列，高 `auto`，卡片高度 `72–96px`
- 第二行：
  - `Smart Wallet Behaviors` 跨 7 列，高 `auto`
  - `On-chain Stats` 跨 5 列，高 `auto`
- 移动端：流式列表上下排列；条目卡片化；提供过滤器抽屉。

##### 组件与字段
- Whale Transactions：`items[{hash,token,amount,usd,from,to,time}]`
- Trending Tokens：`items[{token,mentionScore,volumeChange}]`
- Smart Wallet Behaviors：`patterns[{wallet,behavior,explain}]`
- On-chain Stats：`metrics[{name,value,change24h}]`

#### MarketData 风险（/risk）布局
- 顶部（AIReport）：跨 12 列，高 `120–160px`。
- 第一行：
  - `Risk Radar` 跨 6 列，高 `360px`
  - `Risk Dimensions Detail` 跨 6 列，高 `360px`
- 第二行：
  - `Risk Detections` 跨 12 列，高 `auto`；包含 `价格数据可用性/ 流动性充足性/ 交易量充足性/ 税费/ 锁定/ 价格偏差>50% 禁止交易`。
- 移动端：雷达 → 维度 → 检测项卡片列表。

##### 组件与字段
- Risk Radar：`dimensions[{name,score}]`
- Risk Dimensions Detail：`items[{name,explain,score}]`
- Risk Detections：`checks[{name,status,threshold}]`

### News（新闻）
- 最新新闻：来自 Twitter/Farcaster/Reddit 与协议公告。
- 卡片信息：标题、来源、发布时间、摘要、关联代币。
- 社交动态：热门帖子与互动数据（评论数、讨论热度），情感标签（正面/负面）。
- 移动端优先展示重点新闻，列表卡片自适应布局。
 - AI 分析报告：对重点新闻与社交讨论生成简短结论与情感评分变化趋势；添加“去 MarketData 查看影响”与“订阅触发器”按钮。

#### News 简约设计策略
- 卡片密度：统一卡片高度范围 `100–140px`，标题最多两行，超出省略；摘要最长 120 字。
- 来源标识：左上显示来源图标与域名；右上显示时间与情感标签（绿/红）。
- 主题筛选：顶部粘性标签（DeFi/Technology/Regulation/NFT/Market），移动端为芯片行。
- 聚合与去重：相同主题聚合为一组，减少重复信息；提供“展开相似条目”。
- 交互：点击卡片进入详情抽屉；支持收藏与分享。

#### News 布局
- 顶部（AIReport）：跨 12 列，高 `120–160px`。
- 第一行：
  - `Latest News Feed` 跨 8 列，高 `auto`；卡片高度 `100–140px`，显示标题/来源/时间/摘要/关联代币。
  - `Social Trending` 跨 4 列，高 `auto`；展示热帖与互动数据（评论、热度），情感标签。
- 第二行：
  - `Featured Stories` 跨 12 列，高 `auto`；大卡片横向滚动或网格。
- 移动端：AIReport → Featured → News → Social；全部堆叠。

##### 组件与字段
- Latest News Feed：`items[{title,source,time,summary,tokens[]}]`
- Social Trending：`posts[{platform,author,content,interactions,sentiment}]`
- Featured Stories：`items[{title,heroImage,summary,source}]`

### SuperDefi（协议）
- 协议概览：TVL、24h 量、活跃池、用户数、协议代币价格；趋势图。
- 协议详情：功能、特点、使用指南；实时/历史数据；多链分布；关键池与市场；风险评分。
- 桌面模块化网格；移动端单列堆叠，图表/表格卡片化。
 - AI 分析报告：协议风险变化、用户活跃度、主要池子健康度；建议行动（增持/减持/观察）以信息卡形式展示，需用户确认，不做投资建议。

#### SuperDefi 简约设计策略
- 协议列表最小信息集：仅显示名称、TVL、24h 量、主链与徽标；点击进入详情。
- 关键指标优先：趋势图仅展示 1–2 条核心曲线；图例简化为点击高亮。
- 折叠面板：高级数据（池深度、费率模型、用户画像）置于折叠面板，默认收起。
- 统一表格：池/市场表格统一列集与排序，支持列显隐与快速筛选。

#### SuperDefi 概览布局
- 顶部（AIReport）：跨 12 列，高 `120–160px`。
- 第一行（核心指标）：
  - `TVL` 跨 3 列，高 `140px`
  - `24h Volume` 跨 3 列，高 `140px`
  - `Active Pools` 跨 3 列，高 `140px`
  - `Users` 跨 3 列，高 `140px`
- 第二行（趋势图）：
  - `TVL Trend` 跨 6 列，高 `360px`
  - `Volume Trend` 跨 6 列，高 `360px`
- 第三行（主要池/市场）：
  - `Top Pools/Markets` 跨 12 列，高 `auto`；卡片高度 `96–128px`。
- 移动端：指标堆叠 → 趋势图 → 主要池。

##### 组件与字段
- 指标卡：`TVL/24h Volume/Active Pools/Users` 各自 `value`、`change24h`
- 趋势图：`series[{time,tvl,volume}]`
- Top Pools/Markets：`items[{name,pair,tvl,apy,volume,fee}]`

#### SuperDefi 协议详情布局（/protocol/:id）
- 顶部（AIReport）：跨 12 列，高 `120–160px`。
- 头部信息（Hero）：跨 12 列，高 `200–240px`；包含协议名称、徽标、简介、关键指标（TVL、24h 量、用户数、代币价）。
- 第一行（指标与分布）：
  - `Realtime Metrics` 跨 6 列，高 `320px`
  - `Multi-chain Distribution` 跨 6 列，高 `320px`
- 第二行（关键池/市场）：
  - `Key Pools` 跨 12 列，高 `auto`；表格列 `Pool/ Pair/ TVL/ APY/ Volume/ Fee`。
- 第三行（风险与活动）：
  - `Protocol Risk Score` 跨 6 列，高 `240px`
  - `User Activity Patterns` 跨 6 列，高 `240px`
- 移动端：Hero → 指标 → 分布 → 池表 → 风险 → 活动。

##### 组件与字段
- Hero：`name,logo,desc,keyMetrics{tvl,volume24h,users,tokenPrice}`
- Realtime Metrics：`metrics[{name,value,change}]`
- Multi-chain Distribution：`chains[{name,tvl,users}]`
- Key Pools：`items[{pool,pair,tvl,apy,volume,fee}]`
- Protocol Risk Score：`score,dimensions`
- User Activity Patterns：`patterns[{segment,behavior}]`

## 组件清单
- 导航：Sidebar（品牌、入口、最近、钱包、路由）、Topbar（搜索可选、账户、通知）、移动 Hamburger 抽屉。
- 聊天：MessageList（虚拟化渲染）、MessageBubble（入/出样式）、ChatInput（芯片与选择器）、HintBubble。
- 卡片：TokenCard、StrategyCard、ExecutionPreviewCard、MarketDataCard（时间区间可切换）。
 - AIReportCard：跨页面分析卡片，包含 `sourcePage`、`insights[]`、`metrics[]`、`recommendations[]`、`links[]`。
- 图表：封装 `LineChart`、`BarChart`、`RadarChart`、`DepthChart` 等，统一容器与响应式策略。

## 数据与接口集成
- 按 REST 路径集成（符合 KIKO 文档）：
```
GET    /agent/tokens/:address
POST   /agent/strategies
PATCH  /agent/strategies/:id
DELETE /agent/strategies/:id
POST   /agent/tx/plan
POST   /agent/tx/preview
POST   /agent/tx/execute
POST   /agent/triggers
GET    /agent/triggers
GET    /agent/queue
GET    /agent/audit
GET    /agent/status
GET    /agent/health
POST   /agent/wallet/allowance
```
- 意图映射（Intent）：UI 展示解析后的 `action`、`token_in/out`、`amount_asset`、`chain_id`、`slippage_bps`、触发器参数等。
- 执行流水线：在预览卡片中呈现 `plan → risk_check → preview → confirm → execute`，风险结果带 `risk_id`，审计摘要（报价快照、决策）可查看。
 - 跨页联动（AgentLink）：前端订阅 `agent-link` 事件总线或路由深链协议：
   - 事件：`agent://navigate?to=/marketdata/tokens&id=...`、`agent://open-card?type=AIReportCard&payload=...`
   - API：`POST /agent/report`（生成页面分析报告卡片）、`POST /agent/link`（创建跨页联动动作），与 Chat 卡片互通。

## 状态与错误
- 加载：列表、卡片、图表骨架；闪动时间 ≤ 1.2s，避免大面块占满。
- 空状态：解释文案 + 主按钮；避免死路。
- 错误：行内错误条；支持重试与退避；速率限制提示；网络离线提示。
- 过期：显示最近更新时间；提供刷新按钮。

## 图表规范
- 框架选择：
  - 复杂交互/K 线/雷达/深度图：优先 `ECharts`。
  - 轻量柱线与仪表概览：可用 `Recharts`。
- 延迟加载重型图表库；容器固定最小高度；容器宽度变化时重算布局。
- 可访问：图例、工具提示文本清晰；配色兼容色弱用户。

## 性能要求
- 数据层：使用请求缓存与去重；取消未完成请求；指数退避重试；断路与回退数据源。
- 列表虚拟化：新闻/活动长列表窗口渲染，降低内存占用。
- 代码分割：按路由与模块拆分；图表库懒加载；图像与图标优化。
- 预算：中端手机首屏可用 ≤ 2.5s；路由切换 ≤ 300ms。

## 状态管理
- 服务端状态：`react-query` 管理缓存、重试与失效策略。
- UI 状态：轻量状态（如 `Zustand`）管理侧边栏、对话框、选择器。
- 聊天并发：请求队列与互斥，防止重复提交。

## 测试与质量保障
- 单元测试：组件渲染、交互状态、响应式断点行为。
- 集成测试：卡片渲染与接口模拟；聊天自动滚动与发送行为。
- 视觉回归：关键布局与响应式快照。
- 无障碍审计：键盘导航、对比度、ARIA 标签、减少动画。

## 观测与分析
- 非敏感指标：页面性能、错误率、加载耗时；不采集钱包或个人敏感信息。
- 错误上报需脱敏；可选、可关闭；透明化告知用户。

## 国际化
- 英文/中文标签与文案；用户偏好自动选择；日期、数值与货币本地化。

## 构建与工程
- 使用 Vite；ESM；路径别名（`components`、`features`、`pages`）。
- ESLint + Prettier；样式采用 CSS Modules 或 CSS-in-JS，统一设计令牌变量。
- 环境分级：开发、预发布、生产；模拟数据模式可切换。

## 文件结构（模块化）
- `src/pages/`：`chat/`、`news/`、`marketdata/`、`superdefi/`
- `src/features/`：`cards/`、`charts/`、`sidebar/`、`chat-input/`
- `src/components/`：基础组件 `Button`、`Card`、`Chip`、`Dialog`、`Skeleton`
- `src/stores/`：UI 状态；`src/services/`：API 客户端
- 每个功能目录包含 `index.tsx`、`types.ts`、`styles.ts`，严禁跨功能耦合。

## 验收标准
- 全页面响应式，移动端无横向滚动；字体与对比度满足可读性。
- 聊天自动滚动与动效实现；支持“减少动画”。
- 三态渲染（加载/空/错误）完善；卡片契约字段完整且版本一致。
- MarketData 图表与表格动态加载并适配容器宽度。
- News 集成社交与情感标签；移动端重点内容优先展示。
- 无私钥/助记词相关 UI；钱包仅处理授权与用户确认。
- API 路径与 Intent 展示与产品文档一致；风险规则“价格偏差 > 50% 禁止交易”可见。

## 里程碑计划
- M1：全局布局、设计令牌、侧边栏/汉堡、路由脚手架
- M2：聊天基础组件、提示气泡、消息列表、输入框、卡片骨架
- M3：MarketData 概览/链/代币图表与响应式
- M4：News 新闻流与社交、情感标签
- M5：SuperDefi 概览与协议详情、图表与表格卡片
- M6：无障碍与性能优化、测试与 QA、验收合规
