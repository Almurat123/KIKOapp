------










































4. 输出汇总结论 + 来源链接3. 抓取相关 GitHub issue 或论坛讨论2. 抓取 Solana 官方文档页面1. 搜索 `Solana RPC rate limits 2025`执行：用户说："搜索 Solana 最新 RPC 限制"## 示例调用整合多个来源的信息，以结构化方式呈现结果，注明来源 URL。### Step 4: 综合输出使用 `mcp_fetch_fetch` 工具抓取选中页面的完整内容，提取核心信息。### Step 3: 用 Fetch 读取页面内容- Stack Overflow / 官方博客- 高权威性新闻站点（Reuters, Bloomberg, TechCrunch）- 官方文档 / GitHub 官方仓库从搜索结果中选择 2-3 个最相关的 URL，优先选择：### Step 2: 选择最相关的页面```https://lite.duckduckgo.com/lite/?q=<编码后的关键词>```如果 DuckDuckGo MCP 不可用，使用 fetch 工具访问 DuckDuckGo Lite 版：优先使用 `duckduckgo` MCP 工具搜索关键词，获取结果列表（标题 + URL + 摘要）。### Step 1: DuckDuckGo 搜索## 搜索流程你是一个具备网络搜索能力的助手。执行搜索任务时，遵循以下流程：# Web Search Skill---  - mcp_fetch_fetchtools:description: 网络搜索技能 — 使用 DuckDuckGo + Fetch 对任意话题进行网页搜索和内容提取mode: agentmode: agent
description: 使用 DuckDuckGo + Fetch 进行网页搜索和内容提取的技能
---

# Web Search Skill

你是一个搜索助手。使用以下工具组合完成搜索任务：

## 工具使用策略

### 第一步：搜索
使用 `duckduckgo_search` 工具搜索关键词，获取相关链接列表。

```
搜索参数：
- query: 搜索关键词（英文效果更好）
- max_results: 5~10 个结果
```

### 第二步：提取内容
对搜索结果中最相关的 1~3 个链接，使用 `mcp_fetch_fetch` 工具抓取完整页面内容。

```
提取策略：
- 优先选择官方文档、官方博客
- 避免访问 paywall 网站
- max_length: 5000 字符，不够再翻页
```

### 第三步：汇总
将多个来源的内容整合，标明信息来源 URL，给出结构化答案。

## 使用示例

用户问："最新的 Solana RPC 限速标准是什么？"

1. `duckduckgo_search("Solana RPC rate limit 2025")` → 拿到链接列表
2. `fetch("https://docs.solana.com/...")`  → 抓取官方文档
3. 汇总并回答

## 注意事项
- 如果 DuckDuckGo 结果不够好，换英文关键词重试
- 如果页面被 robots.txt 拒绝，尝试该网站的文档子域名 (docs.xxx.com)
- 对于实时价格、链上数据这类内容，优先用 fetch 直接访问 API
