# 🧪 测试模式指南 / Test Mode Guide

## 如何启用测试模式 / How to Enable Test Mode

### 1. 前端配置 (Frontend Configuration)

在 `kiko-web/.env` 文件中添加：
```bash
VITE_TEST_MODE=true
```

### 2. 后端配置 (Backend Configuration)

在 `kiko-api/.env` 文件中添加：
```bash
TEST_MODE=true
```

### 3. 重启服务 (Restart Services)

前端：
```bash
cd kiko-web && npm run dev
```

后端：
```bash
cd kiko-api && npm run dev
```

## 测试模式说明 / Test Mode Description

当测试模式启用时：
- **前端**: 跳过 Privy 认证，使用模拟用户 `test-user-123`
- **后端**: 接受所有请求，使用测试用户身份

## 注意事项 / Important Notes

⚠️ **仅用于开发和测试环境！**  
⚠️ **For development and testing only!**

生产环境中绝对不要启用测试模式。

## 测试流程 / Testing Flow

1. 启用测试模式
2. 启动前端和后端
3. 打开浏览器访问 `http://localhost:5173`
4. 你应该可以直接进入聊天界面，无需登录
5. 测试聊天功能
6. 完成后禁用测试模式

## 禁用测试模式 / Disable Test Mode

从 `.env` 文件中删除或注释掉相关行：
```bash
# VITE_TEST_MODE=true  # 前端
# TEST_MODE=true       # 后端
```
