import type { ToolDefinition } from '../../tooling/registry.js';

// CONTEXT MEMORY
// Updated: 2026-04-16
// Author: Rowan
// Reason: the request-preparation boundary still defines provider families for
//         downstream model calls, and the normal provider family has moved from
//         DeepSeek to NVIDIA-hosted GLM/Kimi.
// Goal: preserve one canonical provider enum for request preparation while the
//       normal-model vendor changes underneath.
// Owns: provider enum and provider-specific request shaping in the legacy model gateway.
// Does Not Own: runtime routing decisions, pricing, or UI model selection.
// Design Language:
// - Provider families are stable internal contracts.
// - OpenAI keeps stream usage hints; NVIDIA inherits the generic OpenAI-compatible path.
// - Removed providers must not survive as default enum values.
// - Legacy compatibility values may remain in type unions until old workers are removed.
// Document Provenance:
// - Source: NVIDIA NIM model pages for moonshotai/kimi-k2-5 and z-ai/glm5
// - Kind: official API doc
// - Retrieved: 2026-04-16
// - Applied To: replacing the normal provider enum from DeepSeek to NVIDIA
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-nvidia-glm-kimi-provider-replacement.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

export type Provider = 'openai' | 'nvidia' | 'grok' | 'deepseek';

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

        // Non-OpenAI providers stay on the generic OpenAI-compatible request shape.

        return {
            provider: req.provider,
            model: req.model,
            requestBody: base,
        };
    }
}

export const modelGateway = new ModelGateway();
