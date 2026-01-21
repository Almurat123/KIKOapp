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
        return this.getAllTools().map(t => t.definition);
    }

    getAllDefinitions(): ToolDefinition[] {
        return this.getDefinitions();
    }

    async execute(name: string, args: any, context?: ToolContext): Promise<any> {
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool ${name} not found`);
        }
        return tool.handler(args, context);
    }
}

export const toolRegistry = new ToolRegistry();
