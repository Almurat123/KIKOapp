# kikoapi

Go 版本 KIKO Backend API。由 [kiko-api](../kiko-api)（TypeScript/Fastify/Prisma）按文件夹逐步迁移而来。

## 结构

- `cmd/api` — HTTP 服务入口
- `internal/` — 内部包（config, types, utils, db, cache, middleware, repositories, services, handlers, jobs, skills, tooling, tools）
- `migrations/` — PostgreSQL 迁移 SQL

## 开发

```bash
go build ./...
go run ./cmd/api
```

## 环境变量

与 kiko-api 的 `env.example` 保持一致（如 `DATABASE_URL`、`REDIS_URL` 等）。
