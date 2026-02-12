import type { ToolDefinition } from '../../tooling/registry.js';

export type Provider = 'openai' | 'deepseek' | 'grok';

export interface ConversationStateRef {
    previousResponseId?: string;
    compactionCursor?: string;
    version?: number;
}

export interface AllowedToolsPolicy {
    names: string[];
}

export interface GatewayRequest {
    model: string;
    provider: Provider;
    system: string;
    messages: any[];
    tools: Array<{ type: 'function'; function: ToolDefinition }>;
    allowedTools?: AllowedToolsPolicy;
    conversationRef?: ConversationStateRef;
    stream?: boolean;
    metadata?: Record<string, any>;
}

export interface GatewayResponse {
    provider: Provider;
    model: string;
    requestBody: Record<string, any>;
}

function toStrictSchema(def: ToolDefinition): ToolDefinition {
    const properties = def.parameters?.properties || {};
    const required = Array.isArray(def.parameters?.required)
        ? def.parameters.required
        : Object.keys(properties);

    const normalizedParameters = {
        type: 'object' as const,
        properties,
        required,
        additionalProperties: false,
    } as any;

    return {
        ...def,
        parameters: normalizedParameters,
    };
}

function stableSortTools(tools: Array<{ type: 'function'; function: ToolDefinition }>) {
    return [...tools].sort((a, b) => a.function.name.localeCompare(b.function.name));
}

function normalizeMetadata(metadata?: Record<string, any>): Record<string, string> | undefined {
    if (!metadata) return undefined;
    const entries = Object.entries(metadata)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)] as const);
    if (entries.length === 0) return undefined;
    return Object.fromEntries(entries);
}

export class ModelGateway {
    prepareRequest(req: GatewayRequest): GatewayResponse {
        const sortedTools = stableSortTools(req.tools).map(t => ({
            ...t,
            function: toStrictSchema(t.function),
        }));

        const allowedSet = new Set((req.allowedTools?.names || []).map(n => String(n)));
        const finalTools = allowedSet.size > 0
            ? sortedTools.filter(t => allowedSet.has(t.function.name))
            : sortedTools;
        const normalizedMetadata = normalizeMetadata(req.metadata);

        const base: Record<string, any> = {
            model: req.model,
            messages: [
                { role: 'system', content: req.system },
                ...req.messages,
            ],
            stream: req.stream ?? true,
            tools: finalTools,
            tool_choice: 'auto',
        };

        if (req.provider === 'openai') {
            base.stream_options = { include_usage: true };
            // Keep state hints in metadata while we still interop with chat.completions.
            if (req.conversationRef?.previousResponseId) {
                base.metadata = {
                    ...(normalizedMetadata || {}),
                    previous_response_id: req.conversationRef.previousResponseId,
                };
            } else if (normalizedMetadata) {
                base.metadata = normalizedMetadata;
            }
        }

        // DeepSeek rejects metadata unless store=true; we don't use store in chat flow.
        // Keep metadata disabled for DeepSeek requests to avoid hard API errors.

        return {
            provider: req.provider,
            model: req.model,
            requestBody: base,
        };
    }
}

export const modelGateway = new ModelGateway();
