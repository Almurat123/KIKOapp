import type { ChatContextSnapshot } from './contracts.js';
import type { ActionClass } from './controlPolicy.js';
import type { IntentEnvelope, SkillResolution, ToolPhase } from './nodeSkillResolver.js';

export interface ProviderInfo {
    provider: 'openai' | 'deepseek' | 'grok';
    model: string;
    supportsNativeSearch: boolean;
    supportsPreviousResponse: boolean;
}

export interface ProviderOptions {
    metadata: {
        session_id: string;
        task_id: string;
    };
    tool_context: Record<string, any>;
    enable_search: boolean;
    tool_policy?: {
        control_plane: string;
        action_class?: ActionClass;
        mutation_allowed?: boolean;
        enforcement_level?: 'hard' | 'soft';
        native_tools: {
            enable_search: boolean;
            enabled_tools: string[];
            required: boolean;
            preferred_required_tool: string | null;
            include_options: string[];
            allow_extra_sdk_tools: boolean;
            reason: string;
        };
        execution: {
            per_tool_timeout_ms: number;
            total_tool_budget_ms: number;
        };
    };
    tool_config?: {
        web_search?: Record<string, any>;
        x_search?: Record<string, any>;
    };
    previous_response_id?: string;
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

export function buildProviderOptions(
    snapshot: ChatContextSnapshot,
    providerInfo: ProviderInfo,
    query: string,
    skillResolution?: Pick<SkillResolution, 'searchMode' | 'searchReason' | 'intentEnvelope' | 'currentPhase'>,
    phaseContext?: {
        currentPhase?: ToolPhase;
        searchAttempt?: number;
        previousResponseId?: string | null;
    },
): ProviderOptions {
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

    const searchMode = skillResolution?.searchMode || 'forbidden';
    const intentEnvelope = skillResolution?.intentEnvelope;
    const canonicalIntent = snapshot.normalizedIntent || null;
    const currentPhase = phaseContext?.currentPhase || skillResolution?.currentPhase || 'local_analysis';
    const requiresRealtimeSocialSearch = searchMode !== 'forbidden';
    const requestsOnchainEvidence =
        canonicalIntent
            ? canonicalIntent.evidenceRequirements.includes('onchain_token_evidence')
                || canonicalIntent.evidenceRequirements.includes('onchain_wallet_evidence')
                || canonicalIntent.requiresOnchainEvidence
            : Boolean(intentEnvelope?.required_evidence.some((item) =>
                ['onchain_token_evidence', 'onchain_wallet_evidence', 'connected_chain_evidence'].includes(item),
            ));
    const searchAttempt = Math.max(1, phaseContext?.searchAttempt || 1);

    const xSeedHandles = extractXHandles([
        snapshot.runtime.farcaster,
        snapshot.runtime.launchpad,
        snapshot.runtime.tokenSnapshot,
        snapshot.runtime.pageContext,
    ]);
    const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const previousResponseId = sanitizePreviousResponseId(phaseContext?.previousResponseId ?? snapshot.previousResponseId);
    const actionClass = snapshot.policySnapshot?.actionClass || 'READ_ONLY';
    const hardMutationPolicy = snapshot.policySnapshot?.enforcementLevel === 'hard' && actionClass !== 'READ_ONLY';
    const nativeSearchEnabled = !hardMutationPolicy
        && requiresRealtimeSocialSearch
        && currentPhase !== 'execution';
    const enabledNativeTools = nativeSearchEnabled
        ? resolveEnabledNativeTools(intentEnvelope)
        : [];
    const nativeToolReason = resolveNativeToolReason({
        hardMutationPolicy,
        nativeSearchEnabled,
        requestsOnchainEvidence,
        searchReason: skillResolution?.searchReason,
        requiresRealtimeSocialSearch,
    });

    const options = {
        metadata: {
            session_id: String(snapshot.sessionId || ''),
            task_id: String(snapshot.taskId || ''),
        },
        tool_context: snapshot.runtime.toolContext || {},
        tool_policy: {
            control_plane: 'node',
            action_class: actionClass,
            mutation_allowed: Boolean(snapshot.policySnapshot?.mutationAllowed),
            enforcement_level: snapshot.policySnapshot?.enforcementLevel || 'hard',
            native_tools: {
                enable_search: nativeSearchEnabled,
                enabled_tools: enabledNativeTools,
                required: false,
                preferred_required_tool: null,
                include_options: nativeSearchEnabled
                    ? ['inline_citations', ...(requiresRealtimeSocialSearch ? ['web_search_call_output', 'x_search_call_output'] : [])]
                    : [],
                allow_extra_sdk_tools: false,
                reason: nativeToolReason,
            },
            execution: {
                per_tool_timeout_ms: 20000,
                total_tool_budget_ms: 45000,
            },
        },
        tool_config: {
            ...(enabledNativeTools.includes('web_search') ? { web_search: {} } : {}),
            ...(enabledNativeTools.includes('x_search')
                ? {
                    x_search: {
                        from_date: fromDate,
                        ...(xSeedHandles.length > 0 ? { allowed_x_handles: xSeedHandles } : {}),
                    },
                }
                : {}),
        },
        previous_response_id: previousResponseId || undefined,
        enable_search: nativeSearchEnabled,
    };
    assertNodeControlledGrokPolicy(options);
    return options;
}

function resolveNativeToolReason(params: {
    hardMutationPolicy: boolean;
    nativeSearchEnabled: boolean;
    requestsOnchainEvidence: boolean;
    searchReason?: string;
    requiresRealtimeSocialSearch: boolean;
}): string {
    if (params.hardMutationPolicy) return 'mutation_blocked';
    if (params.nativeSearchEnabled) return 'search_required';
    if (params.requestsOnchainEvidence) return 'local_chain_evidence';
    if (params.searchReason) return params.searchReason;
    return params.requiresRealtimeSocialSearch ? 'search_optional' : 'search_disabled';
}

function resolveEnabledNativeTools(intentEnvelope?: IntentEnvelope): string[] {
    const target = intentEnvelope?.search_target || 'web';
    if (target === 'x') return ['x_search', 'web_search'];
    if (target === 'x_and_web') return ['x_search', 'web_search'];
    if (target === 'web') return ['web_search'];
    return ['web_search', 'x_search'];
}

function assertNodeControlledGrokPolicy(options: Record<string, any>) {
    const toolPolicy = (options?.tool_policy && typeof options.tool_policy === 'object')
        ? options.tool_policy as Record<string, any>
        : {};
    const controlPlane = String(toolPolicy.control_plane || '').trim().toLowerCase();
    const actionClass = String(toolPolicy.action_class || 'READ_ONLY').trim().toUpperCase();
    const mutationAllowed = Boolean(toolPolicy.mutation_allowed);
    const enforcementLevel = String(toolPolicy.enforcement_level || 'hard').trim().toLowerCase();
    const nativeTools = (toolPolicy.native_tools && typeof toolPolicy.native_tools === 'object')
        ? toolPolicy.native_tools as Record<string, any>
        : {};
    const allowExtraSdkTools = Boolean(nativeTools.allow_extra_sdk_tools);
    if (controlPlane === 'node' && allowExtraSdkTools) {
        throw new Error('Invalid Grok tool policy: control_plane=node requires native_tools.allow_extra_sdk_tools=false');
    }
    if (enforcementLevel === 'hard' && mutationAllowed && actionClass !== 'TRADE_MUTATION' && actionClass !== 'ORDER_MUTATION' && actionClass !== 'READ_ONLY') {
        throw new Error(`Invalid Grok tool policy: unsupported action_class=${actionClass}`);
    }
    if (enforcementLevel === 'hard' && (actionClass === 'TRADE_MUTATION' || actionClass === 'ORDER_MUTATION')) {
        if (controlPlane !== 'node') {
            throw new Error('Invalid Grok tool policy: mutation action class requires control_plane=node');
        }
        if (allowExtraSdkTools) {
            throw new Error('Invalid Grok tool policy: mutation action class requires native_tools.allow_extra_sdk_tools=false');
        }
    }
}

function sanitizePreviousResponseId(value: string | null | undefined): string | null {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    // Guard against synthetic ids generated from hash(message) in error chunks.
    if (/^chatcmpl-?-?\d+$/.test(normalized)) return null;
    return normalized;
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
