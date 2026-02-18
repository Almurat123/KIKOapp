---
mode: agent
description: 深度技术调研技能 — 综合使用搜索+浏览器+抓取能力，对技术问题进行全面研究
tools:
  - mcp_fetch_fetch
---

# Deep Research Skill

对复杂技术问题进行深度调研。使用所有可用的搜索和浏览工具。

## 调研流程

### Phase 1: 广度搜索
用 DuckDuckGo MCP 或 Google Search MCP 搜索至少 3 个不同角度的关键词：
- 官方文档关键词：`site:docs.xxx.com <topic>`
- 实现案例：`<topic> example implementation github`
- 最新动态：`<topic> 2025 update changelog`

### Phase 2: 深度抓取
对每个角度，用 `mcp_fetch_fetch` 读取 2-3 页重要文档：
- 先读首页/概览，了解结构
- 再读最相关的具体 API 或用法页
- 必要时翻页（start_index 参数）

### Phase 3: 代码验证
如果是代码问题，从 GitHub 等平台找真实使用示例：
- 搜索 `<package> usage example`
- 读取相关 README 或源码注释

### Phase 4: 综合报告
输出结构化调研报告，包含：
- **核心结论**（1-3句话）
- **详细说明**（分点）
- **代码示例**（如适用）
- **参考来源**（附 URL）
- **注意事项 / 坑点**

## 适用场景
- 评估新技术/库是否适合项目
- 查找某个 API 的完整用法
- 对比多个方案的优缺点
- 排查难以定位的 Bug（找相关 issue）
