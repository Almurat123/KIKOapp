---
mode: agent
description: 为 kiko-api 添加新的 Fastify REST API 路由，包含完整的 Service、Route、类型定义
---

# Add Fastify API Endpoint

为 kiko-api 添加一个新的 REST API endpoint，遵循项目现有模式。

## 项目约定

- **框架**: Fastify（TypeScript）
- **认证**: `requireAuth` + `getUserId` from `../middleware/auth.js`
- **数据库**: Prisma（`import prisma from '../db/prisma.js'`）
- **缓存**: Redis（`import { get, set } from '../cache/cacheClient.js'`）
- **日志**: 使用 `fastify.log.error(error)`
- **响应格式**: `{ success: true, data: ... }` 或 `{ success: false, message: '...' }`

## 步骤

### 1. 在 `kiko-api/src/routes/` 创建路由文件

参考 [kiko-api/src/routes/wallets.ts](kiko-api/src/routes/wallets.ts) 的模式：

```typescript
import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { ${SERVICE_NAME}Service } from '../services/${SERVICE_NAME}Service.js';
import { requireAuth as authMiddleware, getUserId } from '../middleware/auth.js';

export default async function ${RESOURCE}Routes(fastify: FastifyInstance, options: FastifyPluginOptions) {
    fastify.addHook('preHandler', authMiddleware);

    fastify.get('/', async (request: any, reply) => {
        try {
            const userId = getUserId(request);
            if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

            const data = await ${SERVICE_NAME}Service.getAll(userId);
            return reply.send({ success: true, data });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ success: false, message: 'Internal server error' });
        }
    });

    fastify.post('/', async (request: any, reply) => {
        try {
            const userId = getUserId(request);
            if (!userId) return reply.status(401).send({ success: false, message: 'Unauthorized' });

            const body = request.body as { /* define fields */ };
            const result = await ${SERVICE_NAME}Service.create(userId, body);
            return reply.status(201).send({ success: true, data: result });
        } catch (error: any) {
            fastify.log.error(error);
            return reply.status(500).send({ success: false, message: 'Internal server error' });
        }
    });
}
```

### 2. 创建 Service 文件

在 `kiko-api/src/services/` 创建 `${SERVICE_NAME}Service.ts`：

```typescript
import prisma from '../db/prisma.js';
import { get as cacheGet, set as cacheSet } from '../cache/cacheClient.js';

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { timestamp: number; data: any }>();

export const ${SERVICE_NAME}Service = {
    async getAll(userId: string) {
        const cacheKey = `${SERVICE_NAME}:${userId}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) return cached.data;

        const data = await prisma.${MODEL_NAME}.findMany({ where: { userId } });
        cache.set(cacheKey, { timestamp: Date.now(), data });
        return data;
    },

    async create(userId: string, input: { /* fields */ }) {
        return await prisma.${MODEL_NAME}.create({
            data: { ...input, userId }
        });
    }
};
```

### 3. 注册路由

在 `kiko-api/src/server.ts` 或路由注册文件中添加：

```typescript
fastify.register(${RESOURCE}Routes, { prefix: '/api/${RESOURCE_PLURAL}' });
```

### 4. 添加 Prisma Schema（如需新表）

在 `kiko-api/prisma/schema.prisma` 添加 Model，然后运行：
```bash
cd kiko-api && npx prisma migrate dev --name add_${RESOURCE}
```

## 注意事项

- 所有导入使用 `.js` 扩展名（ESM 要求）
- 用 `request.params as any` 处理路径参数
- 验证用户对资源的访问权限（不要只校验登录）
- 添加内存缓存 + Redis 二级缓存（参考 walletService.ts）
