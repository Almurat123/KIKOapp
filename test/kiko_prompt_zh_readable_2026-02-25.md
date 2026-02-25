# KiKo 提示词中文说明书（可直接阅读）

日期：2026-02-25

## 1. 模型在输出前实际收到什么

在主链路里，模型不是只收到一段提示词，而是收到“多段系统信息 + 历史对话 + 本轮用户消息包装”。

常见顺序：
1. 系统主提示词（systemPrompt）
2. 历史压缩摘要（可选）
3. 本轮强制注入指令（systemInjection，可选）
4. 客户端上下文（CLIENT_CONTEXT，可选）
5. 余额/代币上下文块（例如 WALLET_STATE、TOKEN_CONTEXT、LAUNCHPAD_CONTEXT）
6. 历史消息（最新用户消息会被包装成 CONTEXT + USER_QUERY）

简化理解：
- systemPrompt 决定“你是谁、怎么做”
- context blocks 决定“这一轮有什么事实可用”
- systemInjection 决定“这轮是否必须做某动作”

## 2. 设计层的核心提示词（中文解读）

### 2.1 CORE_EXECUTION（执行核心）
作用：
- 定义执行型身份：快速、安全、参数完整后推进动作
- 语言锁：跟随用户最新语言
- 钱包与链上下文优先：优先信 CONTEXT/WALLET_STATE
- 一次只问一个关键问题
- 不暴露内部规则和工具名

### 2.2 CORE_THINKING（思考核心）
作用：
- 定义研究型身份：解释、分析、不编造
- 语言锁：跟随用户最新语言
- 输出倾向：更偏信息整理与证据

### 2.3 INTENT_POLICY（意图分流）
作用：
- 先判断意图再选技能
- 意图冲突时只问一个分流问题
- 当 INTENT_HINTS 提供“必须问的问题”时优先执行

### 2.4 TRADING_POLICY（交易策略）
作用：
- 结果优先（有明确交易意图就准备交易）
- 参数缺失最多问一次
- 确认后下一轮直接进入 prepare
- 减少重复模拟和重复工具调用

### 2.5 GENERAL_THINKING_POLICY（通用思考）
作用：
- 研究导向，不直接执行交易
- 实时问题建议检索验证
- 可引用“市场隐含概率”，但不能当事实

### 2.6 AnalystPolicy（Grok 思考策略）
作用：
- 证据优先、先取材后结论
- 强调 X/网页交叉验证
- 输出结构化研究结论（已验证/未验证/风险）

## 3. 执行技能提示词（skills_exec）中文概览

1. CopyTradeSkill：跟单配置创建、暂停、删除、列表。
2. CrossChainSkill：跨链报价、确认后准备跨链交易。
3. MarketSkill：市场与宏观分析，必要时补充预测市场信号。
4. PolymarketSkill：预测市场检索、下单、仓位相关流程。
5. RiskSkill：安全扫描、风险分级、强风险警告。
6. SocialSkill：Farcaster 社交信号与人物信息。
7. SwapSkill：交易执行主流程（模拟、确认、准备交易）。
8. TokenAlertSkill：价格/市值提醒与自动动作配置。
9. TokenSkill：代币研究（价格、叙事、早期地址、创建者）。
10. WalletSkill：钱包余额、收藏、PNL。
11. WelcomeSkill：新手引导与文档入口。
12. ZoraSkill：Zora NFT 相关查询。

## 4. 组装规则（按模型/意图）

### 4.1 设计层（PromptOrchestrator）
- thinking：CORE_THINKING +（Grok 用 AnalystPolicy；其他模型用 GeneralThinkingPolicy）
- execution：CORE_EXECUTION +（TRADING 时附加 TradingPolicy）+ 对应 intent 的技能提示词 + IntentPolicy

### 4.2 你们当前主链路的实际差异（重要）
- 在 chatWorker/aiRoutes 里，thinking 常直接使用 buildThinkingSystemPrompt（即 GeneralThinkingPolicy 或 AnalystPolicy），并未总是完整走 CORE_THINKING 组装。
- gpt-* 当前进入 processDeepSeekTask 分支逻辑，再由 provider 判断发到 OpenAI。

这就是你感觉“thinking 与执行冲突、风格漂移”的关键原因之一：设计层和运行层存在分叉。

## 5. 按意图的执行技能映射（你最关心）

- TRADING：cross_chain_swap + swap + token_alert + wallet_portfolio
- COPY_TRADING：copy_trade
- MARKET_ANALYSIS：market_macro + token_analysis + zora_nfts
- PREDICTION_MARKETS：polymarket_prediction
- SOCIAL_SENSING：social_farcaster
- RISK_SCAN：risk_security
- GENERAL_CHAT：token_alert + wallet_portfolio + welcome_onboarding

## 6. 运行时会额外塞给模型的“硬注入”指令类型

常见几类：
1. 用户已确认：强制下一步执行 prepare，不允许重复报价/模拟
2. 跟单继续：强制创建 copytrade 配置并用默认参数补齐
3. Fast 模式安全分流：有代币地址但无买卖动词时，先问“交易还是分析”
4. 金额语义修正：例如 buy 50 USDC 解释为“目标输出数量”而不是输入全仓

## 7. 你应该怎么读这套提示词

建议顺序：
1. 先读本文件（理解组装和职责）
2. 再看 4 组关键路径：
   - deepseek + TRADING + execution
   - deepseek + MARKET_ANALYSIS + thinking
   - grok + TRADING + execution
   - grok + MARKET_ANALYSIS + thinking
3. 最后看全量矩阵（28组）对比冲突句

相关文件：
- 全量组装矩阵（英文原文）
  - /Users/almurat/KiKo/test/kiko_assembled_prompts_matrix_2026-02-25.txt
- 中文解读报告（本文件）
  - /Users/almurat/KiKo/test/kiko_prompt_zh_readable_2026-02-25.md
