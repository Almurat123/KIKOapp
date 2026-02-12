export const CHAIN_IDS = [1, 8453, 10, 42161, 137, 56, 900];

/**
 * Tool Definition Interfaces
 * 
 * Defines the structure for AI tools based on OpenAI/Claude function calling schemas.
 */

export interface ToolDefinition {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    function?: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, any>;
            required: string[];
        };
    };
}

export interface ToolContext {
    userId?: string;
    userAddress?: string;
    chainId?: number;
    [key: string]: any;
}

export interface Tool<TArgs = any, TResult = any> {
    // The schema definition sent to the LLM
    definition: ToolDefinition;

    // The implementation function
    handler: (args: TArgs, context?: ToolContext) => Promise<TResult>;

    // Optional: Permissions level (e.g. 'read-only', 'auth-required', 'admin')
    permissions?: 'public' | 'user' | 'authenticated';
}

/**
 * Registry to hold all available tools
 */
export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();
    private locks: Map<string, Promise<any>> = new Map();

    register(tool: Tool) {
        this.tools.set(tool.definition.name, tool);
    }

    getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    getAllTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    getDefinitions(): ToolDefinition[] {
        return this.getAllTools()
            .map(t => t.definition)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    getAllDefinitions(): ToolDefinition[] {
        return this.getDefinitions();
    }

    async execute(name: string, args: any, context?: ToolContext): Promise<any> {
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found`);
        }
        const key = this.buildIsolationKey(name, context);
        return this.runWithIsolation(key, () => tool.handler(args, context));
    }

    private buildIsolationKey(name: string, context?: ToolContext): string {
        const userKey =
            context?.userId ||
            (context as any)?.privyDid ||
            context?.userAddress ||
            'anon';
        return `${name}:${userKey}`;
    }

    private async runWithIsolation<T>(key: string, fn: () => Promise<T>): Promise<T> {
        const prev = this.locks.get(key) || Promise.resolve();
        const startWait = Date.now();
        const current = prev.then(async () => {
            const waitMs = Date.now() - startWait;
            if (waitMs > 50) {
                console.log(`[ToolRegistry] Isolation wait ${waitMs}ms for ${key}`);
            }
            return fn();
        });
        this.locks.set(key, current);
        try {
            return await current;
        } finally {
            if (this.locks.get(key) === current) {
                this.locks.delete(key);
            }
        }
    }
}

export const toolRegistry = new ToolRegistry();
