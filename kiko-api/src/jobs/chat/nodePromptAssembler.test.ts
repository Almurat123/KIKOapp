import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleGenerationMessages,
  sanitizeProviderHistory,
} from "./nodePromptAssembler.js";
import type { CanonicalIntent } from "./canonicalIntent.js";
import type {
  ChatContextSnapshot,
  PlanCard,
  ProviderNativeEvidenceSnapshot,
} from "./contracts.js";
import type { ProviderInfo } from "./providerPolicyBuilder.js";
import { skillRegistryExec } from "../../skills/registry.js";

function restoreEnv(name: string, previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = previous;
  }
}

test("assembleGenerationMessages exposes context tools instead of pre-injecting runtime plan and evidence blocks", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-1",
    taskId: "task-1",
    model: "grok-4-1-fast-non-reasoning",
    history: [],
    lastUserMessage: "what's trending on X?",
    runtime: {
      contextBlocks: {},
      userSettings: {
        quickSwapMode: true,
        mevProtection: true,
      },
      walletAddress: "0xabc",
      chainId: 8453,
      chainName: "Base",
      currentPage: "chat",
      pageContext: "X trends dashboard",
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    recentToolTrace: {
      messageId: "assistant-1",
      toolCalls: [
        {
          tool: "get_trending_tokens",
          status: "success",
          args: { chain: "bsc", chain_id: 56, limit: 10 },
          result: [
            {
              rank: 1,
              name: "TOKEN1",
              symbol: "TK1",
              address: "0x111",
              price: "1.23",
              volume24h: "$1.2M",
            },
            {
              rank: 2,
              name: "TOKEN2",
              symbol: "TK2",
              address: "0x222",
              price: "0.42",
              volume24h: "$800K",
            },
          ],
        },
      ],
    },
    conversationActionState: {
      pendingAction: "none",
      canExecute: false,
      needsClarification: false,
      clarificationQuestion: null,
    },
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "grok",
    model: snapshot.model,
    supportsNativeSearch: true,
    supportsPreviousResponse: true,
  };

  const executionPlan: PlanCard = {
    planId: "plan-1",
    title: "Trending Topics on X",
    summary: "Identify current trends on X.",
    status: "in_progress",
    steps: [
      {
        id: "step-1",
        title: "Understand Query",
        description: "Interpret the request for trending topics on X.",
        status: "pending",
        preferredTools: ["x_search"],
      },
    ],
  };

  const providerNativeEvidence: ProviderNativeEvidenceSnapshot[] = [
    {
      sourceTypes: ["x_search"],
      querySummary: "trending topics on X today",
      retrievedAt: "2026-03-16T10:00:00.000Z",
      round: 1,
      results: [
        {
          sourceType: "x_search",
          title: "Trending Topics",
          url: "https://x.com/explore",
          snippet: "Top current trends.",
          retrievedAt: "2026-03-16T10:00:00.000Z",
          round: 1,
        },
      ],
    },
  ];

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    executionPlan,
    providerNativeEvidence,
    toolPhase: "local_analysis",
    searchMode: "required",
    searchReason: "realtime_social_context",
    intentEnvelope: {
      primary_intent: "search_discovery",
      task_mode: "discover",
      search_mode: "required",
      search_target: "x",
      domain: "x",
      execution_risk: "read_only",
      required_evidence: ["native_search_results"],
    },
  });

  const userMessage = messages.find((message) => message.role === "user");
  const systemMessage = messages.find((message) => message.role === "system");
  assert.ok(userMessage?.content);

  const content = String(userMessage?.content || "");
  const systemContent = String(systemMessage?.content || "");
  assert.match(systemContent, /\[MODEL_LED_TOOL_ORCHESTRATION\]/);
  assert.match(systemContent, /You are the decision-maker for the current turn/);
  assert.match(systemContent, /provisional intent\/tool package/);
  assert.doesNotMatch(systemContent, /\[WORKER_STATE_MACHINE\]/);
  assert.doesNotMatch(systemContent, /\[CONTEXT_TRIGGER_POLICY\]/);
  assert.match(systemContent, /\[ANSWER_QUALITY_CONTRACT\]/);
  assert.match(systemContent, /Never end with a generic capability pitch/);
  assert.doesNotMatch(content, /\[TASK_MENU\]/);
  assert.match(content, /\[CONTEXT_CATALOG\]/);
  assert.match(content, /\[CONTEXT_CONTRACT\]/);
  assert.match(content, /\[WORKING_MEMORY\]/);
  assert.match(
    content,
    /carry_forward_rule: Reuse confirmed state from this object/,
  );
  assert.match(content, /task_state\.scope:/);
  assert.match(content, /task_state\.scope_source:/);
  assert.match(content, /mode_progress_state\.mode:/);
  assert.match(content, /mode_progress_state\.internal_state:/);
  assert.match(content, /next_action_state\.kind:/);
  assert.match(content, /\[USER_CONTEXT\]/);
  assert.match(content, /\[WORKFLOW_STATE\]/);
  assert.match(
    content,
    /execution_plan: worker plan: internal orchestration state; read via read_execution_plan/,
  );
  assert.match(
    content,
    /provider_native_evidence: worker evidence: provider search results\/citations; read via read_provider_native_evidence/,
  );
  assert.match(
    content,
    /user_context: worker session state: wallet identity, current surface, requested\/effective chain; read via read_user_context/,
  );
  assert.match(
    content,
    /workflow_state: worker carry-forward task state: pending action, confirmation, confirmed entities, recent tools; read via read_workflow_state/,
  );
  assert.equal(content.includes("Trending Topics on X"), false);
  assert.equal(content.includes("Identify current trends on X."), false);
  assert.equal(content.includes("Understand Query"), false);
  assert.equal(
    content.includes("Interpret the request for trending topics on X."),
    false,
  );
  assert.match(content, /\[CONTEXT_CONTRACT\]/);
  assert.match(content, /mode: social/);
  assert.match(content, /source: fallback_prompt_contract/);
  assert.match(content, /required_contexts: .*workflow_state/);
  assert.match(content, /required_contexts: .*skill_prompts/);
  assert.match(content, /required_contexts: .*execution_plan/);
  assert.match(content, /required_contexts: .*user_context/);
  assert.match(content, /\[CONTEXT_READ_POLICY\]/);
  assert.match(
    content,
    /required_context_tools: read_workflow_state, read_skill_prompts, read_execution_plan, read_user_context/,
  );
  assert.equal(content.includes('"steps"'), false);
  assert.equal(content.includes('"sourceTypes"'), false);
  assert.equal(content.includes('"quick_swap"'), false);
});

test("sanitizeProviderHistory drops empty placeholder assistant rows before provider replay", () => {
  const sanitized = sanitizeProviderHistory(
    [
      { role: "user", content: "Earlier question" },
      { role: "assistant", content: "Earlier answer" },
      { role: "user", content: "" },
      { role: "assistant", content: "" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call-1", type: "function", function: { name: "get_token_info", arguments: "{}" } }],
      },
      {
        role: "tool",
        content: "{\"symbol\":\"KIKO\"}",
        tool_call_id: "call-1",
      },
    ] as any,
    "gpt-5.4-mini",
  );

  assert.deepEqual(
    sanitized.map((message) => ({
      role: message.role,
      content: message.content,
      toolCallId: message.tool_call_id,
      hasToolCalls:
        Array.isArray(message.tool_calls) && message.tool_calls.length > 0,
    })),
    [
      {
        role: "user",
        content: "Earlier question",
        toolCallId: undefined,
        hasToolCalls: false,
      },
      {
        role: "assistant",
        content: "Earlier answer",
        toolCallId: undefined,
        hasToolCalls: false,
      },
      {
        role: "assistant",
        content: null,
        toolCallId: undefined,
        hasToolCalls: true,
      },
      {
        role: "tool",
        content: "{\"symbol\":\"KIKO\"}",
        toolCallId: "call-1",
        hasToolCalls: false,
      },
    ],
  );
});

test("sanitizeProviderHistory drops orphan tool rows before provider replay", () => {
  const sanitized = sanitizeProviderHistory(
    [
      { role: "user", content: "Generate an image" },
      {
        role: "tool",
        content: "{\"ok\":true}",
        tool_call_id: "prefetch-read_user_context",
      },
      { role: "system", content: "Continue safely" },
    ] as any,
    "gpt-5.4-mini",
  );

  assert.deepEqual(
    sanitized.map((message) => message.role),
    ["user", "system"],
  );
});

test("assembleGenerationMessages surfaces Clanker deploy confirmation payloads in worker memory", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-clanker-confirm",
    taskId: "task-clanker-confirm",
    model: "gpt-5.4",
    history: [],
    lastUserMessage: "confirm",
    normalizedIntent: {
      domain: "token",
      intent: "clanker_deploy",
      taskMode: "confirm",
      outputMode: "confirmation_required",
      searchMode: "forbidden",
      searchTarget: "none",
      confidence: 0.99,
      explanation: "test",
      entities: {
        tokenAddresses: [],
        tokenSymbols: [],
        walletAddresses: [],
        marketIdentifiers: [],
      },
      requestedChain: {
        chainId: 8453,
        chainName: "Base",
        source: "entity",
      },
      timeContext: null,
      evidenceRequirements: [],
      requiresRealtime: false,
      requiresOnchainEvidence: false,
      executionCandidate: true,
      rowCount: null,
      locale: "en",
      needsClarification: false,
      clarificationQuestion: null,
      source: "llm",
    } as any,
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "chat",
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    confirmationState: {
      kind: "order_confirmation",
      sourceTool: "deploy_clanker_token",
      order: {
        toolName: "deploy_clanker_token",
        args: {
          name: "Kiko Receipt Test",
          symbol: "KRT",
          chainId: 8453,
          description: "Runtime receipt hook test token",
          confirmDeploy: true,
        },
        actionClass: "TOKEN_DEPLOY_MUTATION",
      },
    } as any,
    conversationActionState: {
      pendingAction: "order",
      canExecute: false,
      needsClarification: false,
      clarificationQuestion: null,
    } as any,
    recentToolTrace: {
      messageId: "assistant-clanker-confirm",
      toolCalls: [],
    },
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    intentEnvelope: {
      primary_intent: "token_deploy",
      task_mode: "confirm",
      search_mode: "forbidden",
      search_target: "none",
      domain: "token",
      execution_risk: "mutation",
      required_evidence: [],
    },
  });

  const content = messages.map((message) => String(message.content || "")).join("\n");
  assert.match(content, /pending_confirmation\.kind: order_confirmation/);
  assert.match(content, /pending_confirmation\.tool_name: deploy_clanker_token/);
  assert.match(content, /pending_confirmation\.args\.name: Kiko Receipt Test/);
  assert.match(content, /pending_confirmation\.args\.symbol: KRT/);
  assert.match(content, /mode_progress_state\.mode: token_deploy/);
  assert.match(content, /execution_state\.confirmation_binding\.tool_name: deploy_clanker_token/);
});

test("assembleGenerationMessages uses model-led tool orchestration prompt by default", () => {
    const snapshot: ChatContextSnapshot = {
      sessionId: "session-model-led",
      taskId: "task-model-led",
      model: "gpt-5.4-mini",
      history: [],
      lastUserMessage: "Generate a screenshot of the instagram with a beautiful views",
      runtime: {
        contextBlocks: {},
        userSettings: {},
        currentPage: "chat",
      },
      requestedTokenAddresses: [],
      requestedTokenSymbols: [],
      recentToolTrace: {
        messageId: "assistant-model-led",
        toolCalls: [],
      },
      conversationActionState: {
        pendingAction: "none",
        canExecute: false,
        needsClarification: false,
        clarificationQuestion: null,
      },
      toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
      provider: "openai",
      model: snapshot.model,
      supportsNativeSearch: false,
      supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
      allowAllTools: true,
      preferredTools: ["generate_image_from_intent"],
      strategyNotes: ["Model-led tool orchestration is enabled."],
      intentEnvelope: {
        primary_intent: "general_answer",
        task_mode: "discover",
        search_mode: "forbidden",
        search_target: "none",
        domain: "general",
        execution_risk: "read_only",
        required_evidence: [],
      },
    });

    const systemContent = String(messages.find((message) => message.role === "system")?.content || "");
    const userContent = String(messages.find((message) => message.role === "user")?.content || "");

    assert.match(systemContent, /\[MODEL_LED_TOOL_ORCHESTRATION\]/);
    assert.match(systemContent, /You are the decision-maker for the current turn/);
    assert.match(systemContent, /provisional intent\/tool package/);
    assert.match(systemContent, /call generate_image_from_intent directly/);
    assert.match(systemContent, /do not reply with a standalone optimized prompt draft/i);
    assert.doesNotMatch(systemContent, /\[WORKER_STATE_MACHINE\]/);
    assert.doesNotMatch(systemContent, /\[CONTEXT_TRIGGER_POLICY\]/);
    assert.doesNotMatch(userContent, /\[TASK_MENU\]/);
    assert.match(userContent, /\[CONTEXT_CATALOG\]/);
    assert.match(userContent, /\[CONTEXT_CONTRACT\]/);
    assert.match(userContent, /\[TOOL_CONTEXT\]/);
    assert.match(userContent, /Registered tools are available/);
});

test("assembleGenerationMessages keeps general answers lean without business context blocks", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-lean",
    taskId: "task-lean",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "Explain quantum entanglement.",
    runtime: {
      contextBlocks: {
        walletState: "[USER_BALANCE_CONTEXT]\n- balance: 999",
        tokenContext: "[TOKEN_CONTEXT]\n- symbol: KIKO",
        launchpadContext: "[LAUNCHPAD_CONTEXT]\n- provider: clanker",
      },
      userSettings: {
        quickSwapMode: true,
        showQuoteBeforeSwap: true,
      },
      walletAddress: "0xabc",
      chainId: 8453,
      chainName: "Base",
      currentPage: "chat",
      pageContext: "ordinary chat",
    },
    requestedTokenAddresses: ["0x1111111111111111111111111111111111111111"],
    requestedTokenSymbols: ["KIKO"],
    recentToolTrace: {
      messageId: "assistant-lean",
      toolCalls: [
        {
          tool: "get_wallet_info",
          status: "success",
          result: { address: "0xabc", balance: "1.23" },
        },
      ],
    },
    conversationActionState: {
      pendingAction: "none",
      canExecute: false,
      needsClarification: false,
      clarificationQuestion: null,
    },
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    intentEnvelope: {
      primary_intent: "general_answer",
      task_mode: "discover",
      search_mode: "forbidden",
      search_target: "none",
      domain: "general",
      execution_risk: "read_only",
      required_evidence: [],
    },
  });

  const userMessage = messages.find((message) => message.role === "user");
  const content = String(userMessage?.content || "");
  assert.match(content, /\[USER_QUERY\]/);
  assert.doesNotMatch(content, /\[TASK_MENU\]/);
  assert.match(content, /\[CONTEXT_CATALOG\]/);
  assert.match(content, /\[CONTEXT_CONTRACT\]/);
  assert.match(content, /mode: lean/);
  assert.match(content, /source: fallback_prompt_contract/);
  assert.match(content, /required_contexts: none/);
  assert.match(content, /task_state\.scope: fresh_request/);
  assert.match(content, /task_state\.scope_source: fresh_turn_no_carry_forward/);
  assert.match(content, /mode_progress_state\.mode: lean_chat/);
  assert.match(content, /mode_progress_state\.internal_state: fresh_answer/);
  assert.doesNotMatch(content, /\[USER_CONTEXT\]/);
  assert.doesNotMatch(content, /\[WORKFLOW_STATE\]/);
  assert.doesNotMatch(content, /\[SKILLS\]/);
  assert.doesNotMatch(content, /\[TOOL_CONTEXT\]/);
  assert.doesNotMatch(content, /\[USER_BALANCE_CONTEXT\]/);
  assert.doesNotMatch(content, /\[TOKEN_CONTEXT\]/);
  assert.doesNotMatch(content, /\[LAUNCHPAD_CONTEXT\]/);
  assert.doesNotMatch(content, /quick_swap: true/);
  assert.doesNotMatch(content, /balance: 999/);
  assert.doesNotMatch(content, /get_wallet_info/);
});

test("assembleGenerationMessages keeps unresolved model-led turns lean without coercing general_answer", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-unresolved",
    taskId: "task-unresolved",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "Explain quantum entanglement.",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "chat",
      pageContext: "ordinary chat",
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    recentToolTrace: {
      messageId: "assistant-unresolved",
      toolCalls: [],
    },
    conversationActionState: {
      pendingAction: "none",
      canExecute: false,
      needsClarification: false,
      clarificationQuestion: null,
    },
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    intentEnvelope: {
      primary_intent: "general_answer",
      task_mode: "discover",
      search_mode: "forbidden",
      search_target: "none",
      domain: "general",
      execution_risk: "read_only",
      required_evidence: [],
    },
  });

  const userMessage = messages.find((message) => message.role === "user");
  const content = String(userMessage?.content || "");
  assert.match(content, /\[CONTEXT_CONTRACT\]/);
  assert.match(content, /mode: lean/);
  assert.match(content, /source: fallback_prompt_contract/);
  assert.match(content, /required_contexts: none/);
});

test("assembleGenerationMessages exposes execution context contract for swap turns", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-exec",
    taskId: "task-exec",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "Swap ETH for USDC",
    runtime: {
      contextBlocks: {
        walletState: "[USER_BALANCE_CONTEXT]\n- balance: 1.0 ETH",
        tokenContext: "[TOKEN_CONTEXT]\n- symbol: USDC",
      },
      userSettings: {
        showQuoteBeforeSwap: true,
      },
      walletAddress: "0xabc",
      chainId: 8453,
      chainName: "Base",
      currentPage: "chat",
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: ["ETH", "USDC"],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    intentEnvelope: {
      primary_intent: "swap_execution",
      task_mode: "execute",
      search_mode: "forbidden",
      search_target: "none",
      domain: "token",
      execution_risk: "mutation",
      required_evidence: [],
    },
  });

  const userMessage = messages.find((message) => message.role === "user");
  const content = String(userMessage?.content || "");
  assert.doesNotMatch(content, /\[TASK_MENU\]/);
  assert.match(content, /\[CONTEXT_CONTRACT\]/);
  assert.match(content, /mode: execution/);
  assert.match(content, /required_contexts: .*wallet_state/);
  assert.match(content, /required_contexts: .*token_context/);
  assert.match(content, /required_contexts: .*user_settings/);
  assert.match(
    content,
    /wallet_state: worker wallet: active-chain and all-chain balances; read via read_wallet_state/,
  );
  assert.match(
    content,
    /token_context: worker token facts: snapshot, requested symbols\/addresses; read via read_token_context/,
  );
  assert.match(
    content,
    /user_settings: worker constraints and defaults: quote rules, swap defaults, safety flags; read via read_user_settings/,
  );
  assert.match(
    content,
    /required_context_tools: read_workflow_state, read_skill_prompts, read_execution_plan, read_user_context, read_user_settings, read_wallet_state, read_token_context/,
  );
  assert.doesNotMatch(content, /\[USER_BALANCE_CONTEXT\]/);
  assert.doesNotMatch(content, /\[TOKEN_CONTEXT\]/);
  assert.doesNotMatch(content, /\[SKILLS\]/);
  assert.doesNotMatch(
    String(
      messages.find((message) => message.role === "system")?.content || "",
    ),
    /EXECUTION_MODE:/,
  );
});

test("assembleGenerationMessages routes chain-sensitive turns through read_user_context instead of pre-injecting chain state", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-3",
    taskId: "task-3",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "Buy CAKE on BNB chain",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      walletAddress: "0xabc",
      chainId: 8453,
      chainName: "Base",
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: ["CAKE", "BNB"],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const systemMessage = messages.find((message) => message.role === "system");
  const userMessage = messages.find((message) => message.role === "user");

  assert.match(
    String(systemMessage?.content || ""),
    /requested chain overrides the connected chain/i,
  );
  assert.match(
    String(userMessage?.content || ""),
    /user_context: worker session state: wallet identity, current surface, requested\/effective chain; read via read_user_context/,
  );
  assert.match(
    String(userMessage?.content || ""),
    /required_contexts: .*user_context/,
  );
  assert.match(String(userMessage?.content || ""), /\[WORKING_MEMORY\]/);
  assert.match(String(userMessage?.content || ""), /\[USER_CONTEXT\]/);
  assert.match(String(userMessage?.content || ""), /connected_chain.id: 8453/);
  assert.match(String(userMessage?.content || ""), /requested_chain.id: 56/);
});

test("assembleGenerationMessages injects Farcaster agent mode prompt for public social replies", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-farcaster",
    taskId: "task-farcaster",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "what is this token",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "farcaster",
      pageContext: "farcaster_agent",
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const systemMessage = messages.find((message) => message.role === "system");

  assert.match(String(systemMessage?.content || ""), /FARCASTER_AGENT_MODE:/);
  assert.match(
    String(systemMessage?.content || ""),
    /Farcaster @mention is only a transport trigger/i,
  );
  assert.match(
    String(systemMessage?.content || ""),
    /Infer the user's actual intent/i,
  );
  assert.match(
    String(systemMessage?.content || ""),
    /short, direct, conversational answer/i,
  );
  assert.match(
    String(systemMessage?.content || ""),
    /Unless the user explicitly asks for detail, keep the answer brief/i,
  );
});

test("assembleGenerationMessages emits multimodal current-turn content for OpenAI social-agent inputs", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-social-openai",
    taskId: "task-social-openai",
    model: "gpt-5.4-mini-2026-03-17",
    history: [],
    lastUserMessage: "what is happening in this post",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "x",
      pageContext: "x_agent",
      socialInput: {
        platform: "x",
        currentText: "what is happening in this post",
        threadContextText: "Parent @alice: look at this chart",
        images: [
          {
            url: "https://example.com/post-image.png",
            sourceLabel: "current X post by @alice",
          },
        ],
      },
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");
  const content = userMessage?.content as any[];

  assert.ok(Array.isArray(content));
  assert.equal(content[0]?.type, "text");
  assert.match(String(content[0]?.text || ""), /\[SOCIAL_THREAD_CONTEXT\]/);
  assert.match(String(content[0]?.text || ""), /\[SOCIAL_IMAGES\]/);
  assert.equal(content[1]?.type, "image_url");
  assert.equal(
    content[1]?.image_url?.url,
    "https://example.com/post-image.png",
  );
});

test("assembleGenerationMessages emits multimodal current-turn content for NVIDIA Kimi social-agent inputs", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-social-nvidia",
    taskId: "task-social-nvidia",
    model: "kimi-k2-5-instant",
    history: [],
    lastUserMessage: "what is happening in this cast",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "farcaster",
      pageContext: "farcaster_agent",
      socialInput: {
        platform: "farcaster",
        currentText: "what is happening in this cast",
        threadContextText: "Parent @alice: is this image bullish?",
        images: [
          {
            url: "https://example.com/cast-image.png",
            sourceLabel: "current Farcaster cast by @alice",
          },
        ],
      },
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "nvidia",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");
  const content = userMessage?.content as any[];

  assert.ok(Array.isArray(content));
  assert.equal(content[0]?.type, "text");
  assert.match(String(content[0]?.text || ""), /\[SOCIAL_THREAD_CONTEXT\]/);
  assert.equal(content[1]?.type, "image_url");
  assert.equal(
    content[1]?.image_url?.url,
    "https://example.com/cast-image.png",
  );
});

test("assembleGenerationMessages emits multimodal current-turn content for Grok social-agent inputs", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-social-grok",
    taskId: "task-social-grok",
    model: "grok-4-1-fast-non-reasoning",
    history: [],
    lastUserMessage: "what is happening in this post",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "x",
      pageContext: "x_agent",
      socialInput: {
        platform: "x",
        currentText: "what is happening in this post",
        threadContextText: "Parent @alice: look at this screenshot",
        images: [
          {
            url: "https://example.com/x-image.png",
            sourceLabel: "current X post by @alice",
          },
        ],
      },
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "grok",
    model: snapshot.model,
    supportsNativeSearch: true,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");
  const content = userMessage?.content as any[];

  assert.ok(Array.isArray(content));
  assert.equal(content[0]?.type, "text");
  assert.match(String(content[0]?.text || ""), /\[SOCIAL_IMAGES\]/);
  assert.equal(content[1]?.type, "image_url");
  assert.equal(content[1]?.image_url?.url, "https://example.com/x-image.png");
});

test("assembleGenerationMessages emits multimodal current-turn content for NVIDIA reasoning social-agent inputs", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-social-glm",
    taskId: "task-social-glm",
    model: "kimi-k2-5-reasoning",
    history: [],
    lastUserMessage: "what is happening in this cast",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "farcaster",
      pageContext: "farcaster_agent",
      socialInput: {
        platform: "farcaster",
        currentText: "what is happening in this cast",
        threadContextText: "Parent @alice: is this image bullish?",
        images: [
          {
            url: "https://example.com/cast-image.png",
            sourceLabel: "current Farcaster cast by @alice",
          },
        ],
      },
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "nvidia",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");

  const content = userMessage?.content as any[];
  assert.ok(Array.isArray(content));
  assert.equal(content[0]?.type, "text");
  assert.equal(content[1]?.type, "image_url");
  assert.equal(content[1]?.image_url?.url, "https://example.com/cast-image.png");
});

test("assembleGenerationMessages exposes requested address classifications through read_user_context instead of inline prompt text", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-address",
    taskId: "task-address",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "analyze 0x4972e029f2e1831d205b20d05833cc771feb2ba3",
    runtime: {
      contextBlocks: {},
      userSettings: {},
      currentPage: "farcaster",
      pageContext: "farcaster_agent",
    },
    requestedTokenAddresses: ["0x4972e029f2e1831d205b20d05833cc771feb2ba3"],
    requestedTokenSymbols: [],
    requestedAddressClassifications: [
      {
        address: "0x4972e029f2e1831d205b20d05833cc771feb2ba3",
        kind: "token_contract",
        chainId: 8453,
        chainName: "Base",
        source: "rpc",
      },
    ],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");

  assert.match(
    String(userMessage?.content || ""),
    /user_context: worker session state: wallet identity, current surface, requested\/effective chain; read via read_user_context/,
  );
  assert.match(
    String(userMessage?.content || ""),
    /required_contexts: .*user_context/,
  );
  assert.match(String(userMessage?.content || ""), /\[USER_CONTEXT\]/);
  assert.match(
    String(userMessage?.content || ""),
    /requested_address_classifications:/,
  );
});

test("assembleGenerationMessages nudges shortlist research tasks toward multi-source evidence and official links", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-research",
    taskId: "task-research",
    model: "grok-4-1-fast-non-reasoning",
    history: [],
    lastUserMessage:
      "结合 X 搜索、网络搜索和 Polymarket，给我找马上要 TGE 和空投的项目，并附上教程链接",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "grok",
    model: snapshot.model,
    supportsNativeSearch: true,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    searchMode: "required",
    searchReason: "realtime_social_context",
    allowAllTools: true,
    toolPhase: "native_search_only",
    intentEnvelope: {
      primary_intent: "search_discovery",
      task_mode: "discover",
      search_mode: "required",
      search_target: "x_and_web",
      domain: "market",
      execution_risk: "read_only",
      required_evidence: ["native_search_results"],
    },
  });

  const systemMessage = messages.find((message) => message.role === "system");
  assert.match(
    String(systemMessage?.content || ""),
    /do not stop after one partial lead/i,
  );
  assert.match(
    String(systemMessage?.content || ""),
    /usable shortlist with concrete links/i,
  );

  const userMessage = messages.find((message) => message.role === "user");
  assert.match(
    String(userMessage?.content || ""),
    /smallest search set that can satisfy the required evidence/i,
  );
  assert.match(
    String(userMessage?.content || ""),
    /use the minimum tool sequence that finishes the task/i,
  );
  assert.match(
    String(userMessage?.content || ""),
    /about 6 provider-native search\/open actions/i,
  );
});

test("assembleGenerationMessages includes strategy notes for early-buyer token profit follow-ups", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-wallet-followup",
    taskId: "task-wallet-followup",
    model: "gpt-5.4",
    history: [],
    lastUserMessage: "这些钱包在这个代币上的利润是怎么样的？",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: ["0x1111111111111111111111111111111111111111"],
    requestedTokenSymbols: [],
    recentToolTrace: {
      messageId: "assistant-early-buyers",
      toolCalls: [
        {
          tool: "get_early_buyers",
          status: "success",
          result: {
            earlyBuyers: [{ address: "0xabc" }, { address: "0xdef" }],
          },
        },
      ],
    },
    conversationActionState: {
      pendingAction: "none",
      canExecute: false,
      needsClarification: false,
      clarificationQuestion: null,
    },
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    preferredTools: ["analyze_wallet_pnl_batch"],
    strategyNotes: [
      "If recent early-buyer rows already exist and the user now asks for profit/PnL or per-wallet buy/sell summaries, reuse those wallet addresses as the candidate set for batch wallet PnL analysis.",
      "Pass the same token_address into analyze_wallet_pnl_batch so the result reports each wallet's buy USD, sell USD, realized PnL, and profit percent for that token over a supported recent window (1d / 7d / 30d, default 30d).",
    ],
    toolPhase: "local_analysis",
    searchMode: "forbidden",
    searchReason: "no_search_required",
  });

  const userMessage = messages.find((message) => message.role === "user");
  const content = String(userMessage?.content || "");

  assert.match(content, /\[TOOL_CONTEXT\]/);
  assert.match(
    content,
    /reuse those wallet addresses as the candidate set for batch wallet PnL analysis/,
  );
  assert.match(
    content,
    /Pass the same token_address into analyze_wallet_pnl_batch/,
  );
});

test("assembleGenerationMessages routes persisted polymarket selection through read_workflow_state instead of inline prompt text", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-poly",
    taskId: "task-poly",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "bet down for 1$",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: ["BTC"],
    polymarketSelection: {
      sourceTool: "get_polymarket_coin_updown_markets",
      capturedAt: "2026-03-26T05:58:03.000Z",
      candidates: [
        {
          title: "Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET",
          question: "Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET",
          marketId: "305787",
          marketSlug: "btc-updown-5m-1774504500",
          conditionId: "condition-1",
          outcomes: [
            { name: "Up", tokenId: "token-up" },
            { name: "Down", tokenId: "token-down" },
          ],
        },
      ],
    },
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");
  const content = String(userMessage?.content || "");
  assert.match(
    content,
    /workflow_state: worker carry-forward task state: pending action, confirmation, confirmed entities, recent tools; read via read_workflow_state/,
  );
  assert.match(content, /required_contexts: .*workflow_state/);
  assert.match(content, /\[WORKFLOW_STATE\]/);
  assert.match(content, /polymarket_selection:/i);
});

test("assembleGenerationMessages tells non-native-search providers to use local search tools when search is required", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-4",
    taskId: "task-4",
    model: "kimi-k2-5-reasoning",
    history: [],
    lastUserMessage:
      "Search X for 0x1111111111111111111111111111111111111111 around yesterday's announcement",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: ["0x1111111111111111111111111111111111111111"],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "nvidia",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: false,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    searchMode: "required",
    searchReason: "social_plus_chain_evidence_required",
    toolPhase: "local_analysis",
    intentEnvelope: {
      primary_intent: "social_discovery",
      task_mode: "discover",
      search_mode: "required",
      search_target: "x",
      domain: "x",
      execution_risk: "read_only",
      required_evidence: ["native_search_results", "onchain_token_evidence"],
    },
  });

  const systemMessage = messages.find((message) => message.role === "system");
  assert.match(
    String(systemMessage?.content || ""),
    /use local search tools such as external_web_search/i,
  );
  assert.match(
    String(systemMessage?.content || ""),
    /do not say you found, confirmed, verified, or retrieved anything unless a real tool/i,
  );
  assert.match(
    String(systemMessage?.content || ""),
    /never narrate planned tool usage in plain text/i,
  );
  assert.match(
    String(systemMessage?.content || ""),
    /final answers must stay grounded in the actual tool\/source fields you have/i,
  );
  assert.equal(
    String(systemMessage?.content || "").includes("[TOOL_CALL_EXAMPLES]"),
    false,
  );
});

test("assembleGenerationMessages carries early-buyer evidence requirements through structured guidance", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-5",
    taskId: "task-5",
    model: "kimi-k2-5-reasoning",
    history: [],
    lastUserMessage:
      "Find early buyers around 2026-03-10 12:00 UTC for 0xeCCBb861c0dda7eFd964010085488B69317e4444",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: ["0xeCCBb861c0dda7eFd964010085488B69317e4444"],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "nvidia",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: false,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    searchMode: "required",
    searchReason: "social_plus_chain_evidence_required",
    toolPhase: "local_analysis",
    intentEnvelope: {
      primary_intent: "social_discovery",
      task_mode: "discover",
      search_mode: "required",
      search_target: "x",
      domain: "x",
      execution_risk: "read_only",
      required_evidence: ["native_search_results", "onchain_token_evidence"],
    },
  });

  const userMessage = messages.find((message) => message.role === "user");
  assert.match(String(userMessage?.content || ""), /\[TOOL_CONTEXT\]/);
  assert.match(
    String(userMessage?.content || ""),
    /evidence guardrail before final answer\/conclusion: native_search_results, onchain_token_evidence/i,
  );
});

test("assembleGenerationMessages includes exact canonical time anchor bounds when present", () => {
  const normalizedIntent: CanonicalIntent = {
    domain: "token",
    intent: "early_buyers",
    taskMode: "analyze",
    outputMode: "full_table",
    searchMode: "forbidden",
    searchTarget: "none",
    confidence: 0.98,
    explanation: "literal time window",
    entities: {
      tokenAddresses: ["0xabc"],
      tokenSymbols: [],
      walletAddresses: [],
      marketIdentifiers: [],
    },
    requestedChain: null,
    timeContext: {
      isTimeBound: true,
      description: "today 11:48 in user timezone",
      startTime: "2026-04-03T11:48:00+08:00",
      endTime: "2026-04-03T11:48:59+08:00",
    },
    evidenceRequirements: ["onchain_token_evidence"],
    requiresRealtime: true,
    requiresOnchainEvidence: true,
    executionCandidate: false,
    rowCount: null,
    locale: "zh",
    needsClarification: false,
    clarificationQuestion: null,
    source: "llm",
  };
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-time-anchor",
    taskId: "task-time-anchor",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "帮我获取0xabc今天11:48的早期购买者",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: ["0xabc"],
    requestedTokenSymbols: [],
    normalizedIntent,
    toolDefinitions: [],
  } as ChatContextSnapshot;

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");
  const content = String(userMessage?.content || "");
  assert.match(
    content,
    /workflow_state: worker carry-forward task state: pending action, confirmation, confirmed entities, recent tools; read via read_workflow_state/,
  );
  assert.match(
    content,
    /required_context_tools: read_workflow_state, read_skill_prompts, read_execution_plan, read_user_context/,
  );
  assert.match(content, /time_context\.startTime:/);
  assert.match(content, /time_context\.endTime:/);
});

test("assembleGenerationMessages uses compact execution mode guidance for swap execution flows", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-6",
    taskId: "task-6",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage:
      "Sell all 0x950e88438098bc08879243984a3cf7c63eb95ba3 to ETH",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: ["0x950e88438098bc08879243984a3cf7c63eb95ba3"],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    intentEnvelope: {
      primary_intent: "swap_execution",
      task_mode: "execute",
      search_mode: "forbidden",
      search_target: "none",
      domain: "token",
      execution_risk: "mutation",
      required_evidence: [],
    },
  });

  const systemMessage = messages.find((message) => message.role === "system");
  const userMessage = messages.find((message) => message.role === "user");
  assert.doesNotMatch(String(systemMessage?.content || ""), /EXECUTION_MODE:/);
  assert.match(
    String(systemMessage?.content || ""),
    /For specialist execution tasks, collapse into a fixed template: gather required context once, bind the missing slots once/,
  );
  assert.match(
    String(userMessage?.content || ""),
    /user_settings: worker constraints and defaults: quote rules, swap defaults, safety flags; read via read_user_settings/,
  );
});

test("swap skill prompt exposes the fixed fast path template", () => {
  const swapSkill = skillRegistryExec.getSkill("swap");

  assert.ok(swapSkill?.prompt);
  assert.match(String(swapSkill?.prompt || ""), /Fast path template:/);
  assert.match(
    String(swapSkill?.prompt || ""),
    /Do not restart discovery, compare alternate routes, or re-run price lookups/,
  );
});

test("assembleGenerationMessages includes canonical intent normalization summary when available", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-intent",
    taskId: "task-intent",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "Check early buyers for 30",
    requestedTokenAddresses: ["0xeCCBb861c0dda7eFd964010085488B69317e4444"],
    requestedTokenSymbols: [],
    toolDefinitions: [],
    normalizedIntent: {
      domain: "token",
      intent: "early_buyers",
      taskMode: "analyze",
      outputMode: "full_table",
      searchMode: "forbidden",
      searchTarget: "none",
      confidence: 0.9,
      explanation: "Early buyer export",
      entities: {
        tokenAddresses: ["0xeCCBb861c0dda7eFd964010085488B69317e4444"],
        tokenSymbols: [],
        walletAddresses: [],
        marketIdentifiers: [],
      },
      requestedChain: {
        chainId: 56,
        chainName: "BNB Chain",
        source: "llm",
      },
      timeContext: null,
      evidenceRequirements: ["onchain_token_evidence"],
      requiresRealtime: false,
      requiresOnchainEvidence: true,
      executionCandidate: false,
      rowCount: 30,
      locale: "en",
      needsClarification: false,
      clarificationQuestion: null,
      source: "llm",
    },
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: false,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const userMessage = messages.find((message) => message.role === "user");
  const content = String(userMessage?.content || "");
  assert.match(
    content,
    /required_context_tools: read_workflow_state, read_skill_prompts, read_execution_plan, read_user_context/,
  );
  assert.match(
    content,
    /user_context: worker session state: wallet identity, current surface, requested\/effective chain; read via read_user_context/,
  );
  assert.match(content, /\[USER_CONTEXT\]/);
  assert.doesNotMatch(content, /\[INTENT_NORMALIZATION\]/);
  assert.doesNotMatch(content, /intent: early_buyers/);
  assert.doesNotMatch(content, /output_mode: full_table/);
  assert.doesNotMatch(content, /row_count: 30/);
});

test("assembleGenerationMessages keeps fast swap preference in read_user_settings instead of inline system prose", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-fast",
    taskId: "task-fast",
    model: "gpt-5-mini",
    history: [],
    lastUserMessage: "Buy VIRTUAL now",
    runtime: {
      contextBlocks: {},
      userSettings: {
        fastSwapMode: true,
        showQuoteBeforeSwap: false,
      },
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: ["VIRTUAL"],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "openai",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: true,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    intentEnvelope: {
      primary_intent: "swap_execution",
      task_mode: "execute",
      search_mode: "forbidden",
      search_target: "none",
      domain: "token",
      execution_risk: "mutation",
      required_evidence: [],
    },
  });

  const systemMessage = messages.find((message) => message.role === "system");
  const userMessage = messages.find((message) => message.role === "user");

  assert.doesNotMatch(String(systemMessage?.content || ""), /EXECUTION_MODE:/);
  assert.match(
    String(userMessage?.content || ""),
    /user_settings: worker constraints and defaults: quote rules, swap defaults, safety flags; read via read_user_settings/,
  );
});

test("assembleGenerationMessages replays stored reasoning_content back to NVIDIA thinking-model history", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-2",
    taskId: "task-2",
    model: "kimi-k2-5-reasoning",
    history: [
      {
        role: "assistant",
        content: "Previous answer",
        reasoningContent: "Internal reasoning that should stay local.",
      },
      {
        role: "user",
        content: "next question",
      },
    ],
    lastUserMessage: "What is next?",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "nvidia",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: false,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const assistantHistory = messages.find(
    (message) => message.role === "assistant",
  );
  assert.ok(assistantHistory);
  assert.equal(
    (assistantHistory as any).reasoning_content,
    "Internal reasoning that should stay local.",
  );
});

test("assembleGenerationMessages marks strategy notes and required context labels as internal-only", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-internal-only",
    taskId: "task-internal-only",
    model: "kimi-k2-5-reasoning",
    history: [],
    lastUserMessage: "Deploy a Clanker token named TG with symbol TG",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: ["TG"],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "nvidia",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: false,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
    allowAllTools: true,
    strategyNotes: [
      "This is a Clanker launch or Clanker history request. Follow the Clanker launch safety template.",
    ],
    contextContract: {
      mode: "execution",
      requiredContexts: ["workflow_state", "skill_prompts", "user_context"],
      optionalContexts: [],
      reason: "mutation workflow",
    },
  });

  const userMessage = messages.find((message) => message.role === "user");
  const userContent = String(userMessage?.content || "");

  assert.match(userContent, /internal_only: strategy notes are backend policy hints/i);
  assert.match(userContent, /internal_only: required_context_tools are backend labels/i);
  assert.match(
    userContent,
    /required_context_tools: read_workflow_state, read_skill_prompts, read_user_context/,
  );
});

test("assembleGenerationMessages strips stored reasoning_content for NVIDIA Kimi instant history", () => {
  const snapshot: ChatContextSnapshot = {
    sessionId: "session-3",
    taskId: "task-3",
    model: "kimi-k2-5-instant",
    history: [
      {
        role: "assistant",
        content: "Previous answer",
        reasoningContent: "Internal reasoning that should stay local.",
      },
      {
        role: "user",
        content: "next question",
      },
    ],
    lastUserMessage: "What is next?",
    runtime: {
      contextBlocks: {},
      userSettings: {},
    },
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    toolDefinitions: [],
  };

  const providerInfo: ProviderInfo = {
    provider: "nvidia",
    model: snapshot.model,
    supportsNativeSearch: false,
    supportsPreviousResponse: false,
  };

  const messages = assembleGenerationMessages(snapshot, [], providerInfo);
  const assistantHistory = messages.find(
    (message) => message.role === "assistant",
  );
  assert.ok(assistantHistory);
  assert.equal("reasoning_content" in (assistantHistory || {}), false);
});
