---
mode: agent
description: 为 kiko-web 创建新的 React 组件，遵循项目现有的组件模式和样式约定
---

# Create React Component

在 kiko-web 中创建一个新的 React 组件，遵循项目约定。

## 项目约定

- **样式**: CSS Modules（`.module.css`），不用 inline styles 或 Tailwind
- **图标**: `lucide-react`
- **类型**: 完整 TypeScript，props 接口必须定义
- **状态**: 组件内用 `useState`，跨页面数据用 Hook（`useXxx`）
- **API 请求**: 不在组件内直接 fetch，封装到 `src/services/` 或 `src/hooks/`
- **目录**: `src/components/<Category>/<ComponentName>.tsx` + `<ComponentName>.module.css`

## 组件模板

```typescript
// src/components/<Category>/<ComponentName>.tsx
import React from 'react';
import styles from './<ComponentName>.module.css';

interface <ComponentName>Props {
    // 定义 props
}

export const <ComponentName>: React.FC<<ComponentName>Props> = ({ /* props */ }) => {
    return (
        <div className={styles.container}>
            {/* 内容 */}
        </div>
    );
};
```

## CSS Module 模板

```css
/* src/components/<Category>/<ComponentName>.module.css */
.container {
    /* 使用项目已有的 CSS 变量，参考 src/styles/ */
}
```

## 步骤

1. **读取相近组件**作为参考（如 `AssetList.tsx`、`TransactionList.tsx`）
2. **创建** `.tsx` 文件（组件 + 类型定义）
3. **创建** `.module.css` 文件
4. **导出** — 确认 barrel export（如果目录有 `index.ts`）
5. **在页面中引入** — 在对应 Page 里 import 并使用

## 注意事项

- Loading 状态用 `<Skeleton>` 组件（参考 `src/components/Skeleton.tsx`）
- 空状态要有 `emptyState` className 的提示
- Token/钱包图片要有 `onError` fallback（参考 `TokenIcon` 组件）
- 移动端适配（钱包 App 需要响应式）
