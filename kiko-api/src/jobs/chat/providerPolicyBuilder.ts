import type { ChatContextSnapshot } from './contracts.js';

export interface ProviderInfo {
    provider: 'openai' | 'deepseek' | 'grok';
    model: string;
    supportsNativeSearch: boolean;
    supportsPreviousResponse: boolean;
}

export function resolveProviderInfo(model: string): ProviderInfo {
    const normalized = String(model || '').toLowerCase();
    if (normalized.includes('grok')) {
        return {
            provider: 'grok',
            model,
            supportsNativeSearch: true,
            supportsPreviousResponse: true,
        };
    }
    if (normalized.startsWith('gpt') || normalized.startsWith('o')) {
        return {
            provider: 'openai',
            model,
            supportsNativeSearch: false,
            supportsPreviousResponse: false,
        };
    }
    return {
        provider: 'deepseek',
        model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };
}

export function buildProviderOptions(snapshot: ChatContextSnapshot, providerInfo: ProviderInfo, query: string) {
    if (providerInfo.provider !== 'grok') {
        return {
            metadata: {
                session_id: String(snapshot.sessionId || ''),
                task_id: String(snapshot.taskId || ''),
            },
            tool_context: snapshot.runtime.toolContext || {},
            enable_search: false,
        };
    }

    const lower = String(query || '').toLowerCase();
    const requiresRealtimeSocialSearch =
        ['trending', 'trend', 'latest', 'today', 'current', 'farcaster', 'twitter', 'x.com', 'social', 'sentiment', 'hot'].some((word) => lower.includes(word))
        || ['趋势', '今天', '现在', '社交', '情绪'].some((word) => String(query || '').includes(word));
    const requestsOnchainEvidence =
        ((snapshot.requestedTokenAddresses || []).length > 0) &&
        (
            ['early buyers', 'earliest buyers', 'first buyers', 'holders', 'first trades', 'first swaps', 'creator', 'deployer'].some((word) => lower.includes(word))
            || ['早期买家', '首批买家', '持有人', '创建者', '部署者', '前几位买家'].some((word) => String(query || '').includes(word))
        );
    const nativeSearchRequired = requiresRealtimeSocialSearch;

    const xSeedHandles = extractXHandles([
        snapshot.runtime.farcaster,
        snapshot.runtime.launchpad,
        snapshot.runtime.tokenSnapshot,
        snapshot.runtime.pageContext,
    ]);
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return {
        metadata: {
            session_id: String(snapshot.sessionId || ''),
            task_id: String(snapshot.taskId || ''),
        },
        tool_context: snapshot.runtime.toolContext || {},
        tool_policy: {
            control_plane: 'node',
            native_tools: {
                enable_search: true,
                enabled_tools: ['web_search', 'x_search'],
                required: nativeSearchRequired,
                preferred_required_tool: nativeSearchRequired ? 'x_search' : null,
                include_options: ['inline_citations', ...(requiresRealtimeSocialSearch ? ['web_search_call_output', 'x_search_call_output'] : [])],
                allow_extra_sdk_tools: true,
                reason: requestsOnchainEvidence
                    ? 'native_search_required_with_local_chain_tools'
                    : requiresRealtimeSocialSearch
                        ? 'required_realtime_social_search'
                        : 'native_search_available',
            },
            execution: {
                per_tool_timeout_ms: 20000,
                total_tool_budget_ms: 45000,
            },
        },
        tool_config: {
            web_search: {},
            x_search: {
                from_date: fromDate,
                ...(xSeedHandles.length > 0 ? { allowed_x_handles: xSeedHandles } : {}),
            },
        },
        previous_response_id: snapshot.previousResponseId || undefined,
        enable_search: true,
    };
}

function extractXHandles(value: unknown): string[] {
    const seen = new Set<string>();
    const found: string[] = [];

    const visit = (node: unknown) => {
        if (!node) return;
        if (typeof node === 'string') {
            const text = node.trim();
            if (!text) return;
            const lower = text.toLowerCase();
            if (lower.includes('x.com/') || lower.includes('twitter.com/')) {
                const parts = text.split('/').filter(Boolean);
                const candidate = String(parts[parts.length - 1] || '').split('?')[0].replace('@', '').trim();
                if (candidate && !['status', 'i'].includes(candidate.toLowerCase())) {
                    const normalized = candidate.toLowerCase();
                    if (!seen.has(normalized)) {
                        seen.add(normalized);
                        found.push(normalized);
                    }
                }
                return;
            }
            if (text.startsWith('@') && text.length > 1) {
                const candidate = text.slice(1).trim();
                if (candidate && /^[A-Za-z0-9_]+$/.test(candidate)) {
                    const normalized = candidate.toLowerCase();
                    if (!seen.has(normalized)) {
                        seen.add(normalized);
                        found.push(normalized);
                    }
                }
            }
            return;
        }
        if (Array.isArray(node)) {
            node.forEach(visit);
            return;
        }
        if (typeof node === 'object') {
            for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
                const lowerKey = key.toLowerCase();
                if (['twitter', 'twitterusername', 'twitter_username', 'xhandle', 'x_handle', 'handle'].includes(lowerKey) && typeof item === 'string') {
                    visit(`@${item.replace(/^@/, '')}`);
                    continue;
                }
                visit(item);
            }
        }
    };

    visit(value);
    return found.slice(0, 5);
}
