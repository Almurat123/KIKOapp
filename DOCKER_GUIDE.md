# KiKo 项目 - Docker 部署指南

## 🚀 一键启动所有服务

```bash
# 1. 复制环境变量文件
cp .env.example .env

# 2. 编辑 .env 填入你的 API Keys

# 3. 启动所有服务
docker-compose up -d

# 4. 查看日志
docker-compose logs -f

# 5. 停止所有服务
docker-compose down
```

## 📦 包含的服务

| 服务 | 端口 | 说明 |
|------|------|------|
| **postgres** | 5432 | PostgreSQL 数据库 |
| **redis** | 6379 | Redis 缓存 |
| **grok-service** | 8001 | Grok AI 服务 (Python) |
| **api** | 3001 | 主 API 服务 (Node.js) |
| **web** | 5173 | 前端应用 (React) |

## 🔧 开发模式

如果你想在本地开发，不用 Docker：

```bash
# 终端 1: 启动数据库
docker-compose up postgres redis -d

# 终端 2: 启动 Grok 服务
cd grok-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload

# 终端 3: 启动 API
cd kiko-api
npm install
npm run dev

# 终端 4: 启动前端
cd kiko-web
npm install
npm run dev
```

## 📝 环境变量

创建 `.env` 文件在项目根目录：

```bash
# Database
POSTGRES_PASSWORD=kiko123

# xAI Grok
XAI_API_KEY=your_xai_api_key

# Other APIs
COINGECKO_API_KEY=your_key
DUNE_API_KEY=your_key
NEYNAR_API_KEY=your_key
# ... 其他 API Keys
```

## 🔍 健康检查

```bash
# 检查所有服务状态
docker-compose ps

# 检查 Grok 服务
curl http://localhost:8001/health

# 检查 API 服务
curl http://localhost:3001/health
```

## 🐛 故障排除

### 服务启动失败

```bash
# 查看日志
docker-compose logs grok-service
docker-compose logs api

# 重启服务
docker-compose restart grok-service
```

### 端口冲突

如果端口被占用，修改 `docker-compose.yml` 中的端口映射：

```yaml
ports:
  - "8002:8001"  # 改用 8002 端口
```

## 🎯 生产部署

```bash
# 构建生产镜像
docker-compose build

# 启动生产环境
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```
