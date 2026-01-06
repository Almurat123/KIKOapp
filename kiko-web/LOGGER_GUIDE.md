# Logger & Sentry 使用指南

## 🎯 快速开始

### 1. 配置 Sentry DSN

在 `.env` 文件中添加：

```bash
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

获取 DSN：
1. 访问 [sentry.io](https://sentry.io)
2. 创建项目（选择 React）
3. 复制 DSN 到 `.env`

### 2. 测试 Logger 和 Sentry

1. 启动项目：`npm run dev`
2. 打开浏览器，进入 **Wallet** 页面
3. 点击 **🧪 测试日志 & Sentry** 按钮
4. 打开浏览器控制台，查看彩色日志
5. 打开 Sentry 控制台，查看错误上报

---

## 📝 Logger 使用方法

### 基础日志

```typescript
import { logger } from '@/utils/logger';

// 信息日志
logger.info('App', '应用启动');

// 调试日志（仅开发环境）
logger.debug('Wallet', '查询余额', { address: '0x...' });

// 警告日志
logger.warn('API', 'Rate limit 接近上限');

// 错误日志（自动上报 Sentry）
logger.error('Swap', '交易失败', error);
```

### AI 模型调用

```typescript
// 请求模型
logger.ai('request', 'DeepSeek-V3.2', { 
  prompt: 'Hello', 
  temperature: 0.7 
});

// 流式输出
logger.ai('stream-start', 'Grok-4.1');
logger.ai('stream-chunk', 'Grok-4.1', { chunk: '...' });
logger.ai('stream-end', 'Grok-4.1');

// 响应
logger.ai('response', 'Claude-3.5', { 
  tokens: 1500, 
  duration: 1.2 
});

// 错误
logger.ai('error', 'Gemini-2.0', error);
```

### Swap 交易

```typescript
// 发起交易
logger.swap('init', { 
  tokenIn: 'ETH', 
  tokenOut: 'USDC', 
  amount: 1 
});

// 获取报价
logger.swap('quote', { price: 3421.5, slippage: 0.5 });

// 授权代币
logger.swap('approve', { token: 'USDC', spender: '0x...' });

// 执行交易
logger.swap('execute', { txHash: '0x...' });

// 成功/失败
logger.swap('success', { gasUsed: 150000 });
logger.swap('fail', error);
```

### 意图解析

```typescript
logger.intent('parse', { message: '帮我买 ETH' });
logger.intent('result', { type: 'swap', confidence: 0.95 });
logger.intent('error', error);
```

### 性能计时

```typescript
const timer = logger.time('AI', 'Claude 响应');
await callClaudeAPI();
timer.end();  // 输出: [AI] Claude 响应 完成 (1.23s)
```

### 分组日志

```typescript
logger.group('Swap', '交易流程');
logger.info('Swap', '步骤 1: 获取报价');
logger.info('Swap', '步骤 2: 授权代币');
logger.info('Swap', '步骤 3: 执行交易');
logger.groupEnd();
```

---

## 🎨 控制台效果

```
14:32:15 ℹ️ [AI] 📤 请求 DeepSeek-V3.2 { prompt: 'Hello' }
14:32:16 ℹ️ [AI] 📥 DeepSeek-V3.2 响应 { tokens: 1500 }
14:32:17 ℹ️ [Swap] 🔄 发起交易请求 { tokenIn: 'ETH', amount: 1 }
14:32:18 ❌ [Swap] ❌ 交易失败 Error: Slippage too high
```

---

## 🔧 配置选项

```typescript
import { Logger } from '@/utils/logger';

const customLogger = new Logger({
  enableDebug: true,              // 是否启用 debug 日志
  disableInProduction: false,     // 生产环境是否禁用
  showTimestamp: true,            // 是否显示时间戳
});
```

---

## 🚨 Sentry 集成

### 自动上报

所有 `logger.error()` 调用会自动上报到 Sentry：

```typescript
logger.error('AI', 'Claude 调用失败', error);
// ✅ 自动上报到 Sentry，包含分类标签和上下文
```

### 手动上报

```typescript
import * as Sentry from '@sentry/react';

Sentry.captureException(error, {
  tags: { feature: 'swap' },
  extra: { tokenIn: 'ETH', amount: 1 },
});
```

---

## 📊 日志分类

| 分类 | 用途 | 颜色 |
|------|------|------|
| `AI` | AI 模型调用 | 紫色 |
| `Swap` | 交易相关 | 绿色 |
| `Wallet` | 钱包操作 | 橙色 |
| `API` | 外部 API 调用 | 蓝色 |
| `Auth` | 认证相关 | 粉色 |
| `Error` | 错误处理 | 红色 |
| `Perf` | 性能监控 | 靛蓝 |
| `App` | 应用通用 | 灰色 |

---

## 💡 最佳实践

### ✅ 推荐

```typescript
// 关键业务逻辑
logger.info('Swap', '用户发起交易', { tokenIn, tokenOut, amount });

// 性能关键路径
const timer = logger.time('AI', 'Claude 响应');
// ...
timer.end();

// 错误处理
try {
  await swap();
} catch (error) {
  logger.error('Swap', '交易失败', error);
}
```

### ❌ 避免

```typescript
// 不要记录敏感信息
logger.info('Auth', '用户登录', { 
  password: '123456'  // ❌ 不要记录密码
});

// 不要在循环中大量日志
for (let i = 0; i < 10000; i++) {
  logger.debug('App', `循环 ${i}`);  // ❌ 会淹没控制台
}
```

---

## 🔍 调试技巧

### 查看特定分类

```typescript
// 在控制台过滤
// 输入: [AI]  -> 只看 AI 相关日志
// 输入: [Swap] -> 只看 Swap 相关日志
```

### 临时禁用 debug

```typescript
// 在 logger.ts 中修改
enableDebug: false  // 关闭 debug 日志
```

---

需要帮助？查看 `/src/utils/logger.ts` 源码或联系开发团队。
