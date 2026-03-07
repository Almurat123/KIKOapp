import type { FastifyInstance } from 'fastify';
import { toolRegistry } from '../tooling/index.js';

type InternalToolExecBody = {
    tool_name: string;
    arguments?: Record<string, any>;
    context?: Record<string, any>;
};

function requireInternalServiceKey(fastify: FastifyInstance, req: any, reply: any): boolean {
    const expected = process.env.INTERNAL_SERVICE_KEY || '';
    const got = (req.headers['x-internal-service-key'] as string) || (req.headers['x-service-key'] as string) || '';
    if (!expected || got !== expected) {
        reply.status(401).send({ success: false, error: 'Unauthorized internal request' });
        return false;
    }
    return true;
}

export async function internalToolsRoutes(fastify: FastifyInstance) {
    fastify.get('/internal/tools/health', async (req, reply) => {
        if (!requireInternalServiceKey(fastify, req, reply)) return;
        return { status: 'ok' };
    });

    fastify.get('/internal/tools/definitions', async (req, reply) => {
        if (!requireInternalServiceKey(fastify, req, reply)) return;
        const defs = toolRegistry.getDefinitions().map((d) => ({
            type: 'function',
            function: {
                name: d.name,
                description: d.description,
                parameters: d.parameters,
            },
        }));
        return { success: true, tools: defs };
    });

    fastify.post('/internal/tools/execute', async (req, reply) => {
        if (!requireInternalServiceKey(fastify, req, reply)) return;
        const body = (req.body || {}) as InternalToolExecBody;
        const toolName = (body.tool_name || '').trim();
        if (!toolName) {
            return reply.status(400).send({ success: false, error: 'tool_name is required' });
        }
        try {
            const result = await toolRegistry.execute(toolName, body.arguments || {}, body.context || {});
            return { success: true, tool_name: toolName, result };
        } catch (e: any) {
            return reply.status(500).send({
                success: false,
                tool_name: toolName,
                error: e?.message || 'Tool execution failed',
            });
        }
    });
}
