---
mode: agent
description: Chrome 浏览器控制技能 — 通过 Chrome DevTools MCP 控制浏览器进行自动化操作
tools: []
---

# Browser Control Skill

使用 `chrome-devtools` MCP 控制本地 Chrome 浏览器，实现自动化浏览、截图、页面交互。

## 前置要求

Chrome 必须以 **远程调试模式** 启动：

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug

# 或者创建别名（加入 ~/.zshrc）
alias chrome-debug='/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug'
```

验证是否启动成功：
```bash
curl http://localhost:9222/json/version
```

## 可用能力

| 能力 | 说明 |
|------|------|
| 导航 | 打开任意 URL |
| 截图 | 截取页面或元素快照 |
| DOM 操作 | 读取/修改页面元素 |
| 执行 JS | 在页面上下文中运行脚本 |
| 网络监控 | 拦截/分析网络请求 |
| 控制台读取 | 获取 console.log 输出 |

## 典型使用场景

### 场景 1: 检查线上页面状态
```
指令: 打开 https://app.kiko.ai 截图，检查是否有报错
```

### 场景 2: 抓取需要登录的页面
```
指令: 在已登录的 Chrome 中，打开钱包页面并读取 DOM 结构
```

### 场景 3: 调试前端渲染
```
指令: 打开本地开发服务器 http://localhost:5173，执行 window.__APP_STATE__ 并返回结果
```

## 注意事项
- Chrome DevTools MCP 连接的是**你本地已打开的 Chrome 实例**
- 如果 Chrome 没有以调试模式运行，工具会连接失败
- 调试端口默认 9222，可在 MCP 参数中修改
