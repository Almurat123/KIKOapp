import type { ToolDefinition } from '../../tooling/registry.js';

// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Rowan
// Reason: the request-preparation boundary still defines provider families for
//         downstream model calls, and the normal provider family has moved from
//         DeepSeek to OpenAI.
// Goal: preserve one canonical provider enum for request preparation while the
//       normal-model vendor changes underneath.
// Owns: provider enum and provider-specific request shaping in the legacy model gateway.
// Does Not Own: runtime routing decisions, pricing, or UI model selection.
// Design Language:
// - Provider families are stable internal contracts.
// - OpenAI keeps stream usage hints.
// - Removed providers must not survive as default enum values.
// - Legacy compatibility values may remain in type unions until old workers are removed.
// Document Provenance:
// - Kind: product doc
// - Retrieved: 2026-04-23
// - Applied To: replacing the normal provider enum from DeepSeek to OpenAI
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type Provider = 'openai' | 'grok' | 'deepseek';

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

function schemaAllowsNull(schema: any): boolean {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return false;
    if (schema.type === 'null') return true;
    if (Array.isArray(schema.type) && schema.type.includes('null')) return true;
    if (Array.isArray(schema.enum) && schema.enum.includes(null)) return true;
    for (const keyword of ['oneOf', 'anyOf'] as const) {
        if (Array.isArray(schema[keyword]) && schema[keyword].some((item: any) => schemaAllowsNull(item))) {
            return true;
        }
    }
    return false;
}

function makeSchemaNullable(schema: any): any {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema) || schemaAllowsNull(schema)) {
        return schema;
    }
    const cloned: Record<string, any> = { ...schema };
    if (typeof cloned.type === 'string' && cloned.type !== 'null') {
        cloned.type = [cloned.type, 'null'];
    } else if (Array.isArray(cloned.type)) {
        cloned.type = [...cloned.type.filter((item: any) => item !== 'null'), 'null'];
    } else if (Array.isArray(cloned.anyOf)) {
        cloned.anyOf = [...cloned.anyOf, { type: 'null' }];
    } else if (Array.isArray(cloned.oneOf)) {
        cloned.oneOf = [...cloned.oneOf, { type: 'null' }];
    } else {
        cloned.anyOf = [schema, { type: 'null' }];
    }
    if (Array.isArray(cloned.enum) && !cloned.enum.includes(null)) {
        cloned.enum = [...cloned.enum, null];
    }
    return cloned;
}

function strictifySchemaNode(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;

    if (Array.isArray(schema)) {
        return schema.map((item) => strictifySchemaNode(item));
    }

    const cloned: Record<string, any> = { ...schema };
    const isObjectSchema = cloned.type === 'object' || cloned.properties || cloned.required || cloned.additionalProperties !== undefined;

    if (cloned.items !== undefined) {
        cloned.items = strictifySchemaNode(cloned.items);
    }

    for (const keyword of ['oneOf', 'anyOf', 'allOf'] as const) {
        if (Array.isArray(cloned[keyword])) {
            cloned[keyword] = cloned[keyword].map((item: any) => strictifySchemaNode(item));
        }
    }

    if (cloned.not) {
        cloned.not = strictifySchemaNode(cloned.not);
    }

    if (isObjectSchema) {
        const properties = cloned.properties && typeof cloned.properties === 'object' && !Array.isArray(cloned.properties)
            ? cloned.properties
            : {};
        const originalRequired = new Set(Array.isArray(cloned.required) ? cloned.required.map((item: any) => String(item)) : []);
        cloned.type = 'object';
        cloned.properties = Object.fromEntries(
            Object.entries(properties).map(([key, value]) => {
                const normalized = strictifySchemaNode(value);
                return [
                    key,
                    originalRequired.has(String(key))
                        ? normalized
                        : makeSchemaNullable(normalized),
                ];
            }),
        );
        cloned.required = Object.keys(cloned.properties);
        cloned.additionalProperties = false;
    }

    return cloned;
}

function toStrictSchema(def: ToolDefinition): ToolDefinition {
    const properties = def.parameters?.properties || {};
    const normalizedParameters = strictifySchemaNode({
        ...def.parameters,
        type: 'object',
        properties,
        additionalProperties: false,
    });

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

        // Non-OpenAI providers stay on the generic OpenAI-compatible request shape.

        return {
            provider: req.provider,
            model: req.model,
            requestBody: base,
        };
    }
}

export const modelGateway = new ModelGateway();
