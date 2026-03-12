type NativeToolName = 'web_search' | 'x_search';

type BuildGrokToolPolicyArgs = {
    forceChainContextAnswer: boolean;
    isLikelyCaAnalysis: boolean;
    requiresRealtimeSocialSearch: boolean;
    isNonReasoningModel: boolean;
};

export type GrokToolPolicy = {
    control_plane: 'node';
    native_tools: {
        enable_search: boolean;
        enabled_tools: NativeToolName[];
        required: boolean;
        preferred_required_tool?: NativeToolName;
        include_options: string[];
        allow_extra_sdk_tools: boolean;
        reason: string;
    };
    execution: {
        per_tool_timeout_ms: number;
        total_tool_budget_ms: number;
    };
};

function isTruthy(value: string | undefined, defaultValue: boolean): boolean {
    if (value == null) return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export function buildGrokToolPolicy(args: BuildGrokToolPolicyArgs): GrokToolPolicy {
    const enableSearch = !args.forceChainContextAnswer;
    const enabledTools: NativeToolName[] = enableSearch
        ? ['web_search', ...(args.isNonReasoningModel ? [] : ['x_search' as const])]
        : [];
    const required = enableSearch && (args.requiresRealtimeSocialSearch || args.isLikelyCaAnalysis);
    const preferredRequiredTool = required
        ? (enabledTools.includes('x_search') ? 'x_search' : enabledTools[0])
        : undefined;
    const includeOptions = enabledTools.length > 0
        ? [
            'inline_citations',
            ...(required
                ? enabledTools.map((toolName) => `${toolName}_call_output`)
                : []),
        ]
        : [];

    let reason = 'disabled';
    if (required && args.requiresRealtimeSocialSearch) {
        reason = 'required_realtime_social_search';
    } else if (required && args.isLikelyCaAnalysis) {
        reason = 'required_contract_analysis';
    } else if (enableSearch) {
        reason = 'native_search_available';
    }

    return {
        control_plane: 'node',
        native_tools: {
            enable_search: enableSearch,
            enabled_tools: enabledTools,
            required,
            ...(preferredRequiredTool ? { preferred_required_tool: preferredRequiredTool } : {}),
            include_options: includeOptions,
            allow_extra_sdk_tools: isTruthy(process.env.GROK_EXPOSE_ALL_XAI_SDK_TOOLS, true),
            reason,
        },
        execution: {
            per_tool_timeout_ms: Math.max(0, parseInt(process.env.GROK_TOOL_EXEC_TIMEOUT_MS || '20000', 10) || 20000),
            total_tool_budget_ms: Math.max(0, parseInt(process.env.GROK_TOOL_TOTAL_BUDGET_MS || '45000', 10) || 45000),
        },
    };
}
