import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleGenerationMessages } from './nodePromptAssembler.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import type { ChatContextSnapshot, PlanCard, ProviderNativeEvidenceSnapshot } from './contracts.js';
import type { ProviderInfo } from './providerPolicyBuilder.js';

test('assembleGenerationMessages renders runtime plan state structurally without user-facing plan prose', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'grok-4-1-fast-non-reasoning',
        history: [],
        lastUserMessage: "what's trending on X?",
        runtime: {
            contextBlocks: {},
            userSettings: {
                quickSwapMode: true,
                mevProtection: true,
            },
            walletAddress: '0xabc',
            chainId: 8453,
            chainName: 'Base',
            currentPage: 'chat',
            pageContext: 'X trends dashboard',
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                {
                    tool: 'get_trending_tokens',
                    status: 'success',
                    args: { chain: 'bsc', chain_id: 56, limit: 10 },
                    result: [
                        {
                            rank: 1,
                            name: 'TOKEN1',
                            symbol: 'TK1',
                            address: '0x111',
                            price: '1.23',
                            volume24h: '$1.2M',
                        },
                        {
                            rank: 2,
                            name: 'TOKEN2',
                            symbol: 'TK2',
                            address: '0x222',
                            price: '0.42',
                            volume24h: '$800K',
                        },
                    ],
                },
            ],
        },
        conversationActionState: {
            pendingAction: 'none',
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        },
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'grok',
        model: snapshot.model,
        supportsNativeSearch: true,
        supportsPreviousResponse: true,
    };

    const executionPlan: PlanCard = {
        planId: 'plan-1',
        title: 'Trending Topics on X',
        summary: 'Identify current trends on X.',
        status: 'in_progress',
        steps: [
            {
                id: 'step-1',
                title: 'Understand Query',
                description: 'Interpret the request for trending topics on X.',
                status: 'pending',
                preferredTools: ['x_search'],
            },
        ],
    };

    const providerNativeEvidence: ProviderNativeEvidenceSnapshot[] = [
        {
            sourceTypes: ['x_search'],
            querySummary: 'trending topics on X today',
            retrievedAt: '2026-03-16T10:00:00.000Z',
            round: 1,
            results: [
                {
                    sourceType: 'x_search',
                    title: 'Trending Topics',
                    url: 'https://x.com/explore',
                    snippet: 'Top current trends.',
                    retrievedAt: '2026-03-16T10:00:00.000Z',
                    round: 1,
                },
            ],
        },
    ];

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        executionPlan,
        providerNativeEvidence,
        toolPhase: 'local_analysis',
        searchMode: 'required',
        searchReason: 'realtime_social_context',
        intentEnvelope: {
            primary_intent: 'search_discovery',
            task_mode: 'discover',
            search_mode: 'required',
            search_target: 'x',
            domain: 'x',
            execution_risk: 'read_only',
            required_evidence: ['native_search_results'],
        },
    });

    const userMessage = messages.find((message) => message.role === 'user');
    assert.ok(userMessage?.content);

    const content = String(userMessage?.content || '');
    assert.match(content, /\[INTERNAL_RUNTIME_PLAN_STATE\]/);
    assert.match(content, /step_id=step-1; status=pending; preferred_tools=x_search/);
    assert.equal(content.includes('Trending Topics on X'), false);
    assert.equal(content.includes('Identify current trends on X.'), false);
    assert.equal(content.includes('Understand Query'), false);
    assert.equal(content.includes('Interpret the request for trending topics on X.'), false);
    assert.match(content, /\[PROVIDER_NATIVE_EVIDENCE\]/);
    assert.match(content, /\[WORKFLOW_STATE\]/);
    assert.match(content, /recent_tool_result: get_trending_tokens\[success\]/);
    assert.match(content, /result=\[rank=1, name=TOKEN1, symbol=TK1, address=0x111, price=1.23, volume24h=\$1.2M/);
    assert.match(content, /\[USER_SETTINGS\]/);
    assert.match(content, /quick_swap: true/);
    assert.match(content, /\[USER_CONTEXT\]/);
    assert.match(content, /wallet: 0xabc/);
    assert.match(content, /connected_chain.id: 8453/);
    assert.match(content, /Evidence: Trending Topics \| url=https:\/\/x\.com\/explore \| snippet=Top current trends\./);
    assert.equal(content.includes('"steps"'), false);
    assert.equal(content.includes('"sourceTypes"'), false);
    assert.equal(content.includes('"wallet"'), false);
    assert.equal(content.includes('"quick_swap"'), false);
});

test('assembleGenerationMessages marks requested chain separately from connected chain', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-3',
        taskId: 'task-3',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Buy CAKE on BNB chain',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            walletAddress: '0xabc',
            chainId: 8453,
            chainName: 'Base',
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['CAKE', 'BNB'],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const systemMessage = messages.find((message) => message.role === 'system');
    const userMessage = messages.find((message) => message.role === 'user');

    assert.match(String(systemMessage?.content || ''), /requested chain overrides the connected chain/i);
    assert.match(String(userMessage?.content || ''), /connected_chain.id: 8453/);
    assert.match(String(userMessage?.content || ''), /requested_chain.id: 56/);
    assert.match(String(userMessage?.content || ''), /requested_chain.name: BNB Chain/);
});

test('assembleGenerationMessages injects Farcaster agent mode prompt for public social replies', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-farcaster',
        taskId: 'task-farcaster',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'what is this token',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            currentPage: 'farcaster',
            pageContext: 'farcaster_agent',
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const systemMessage = messages.find((message) => message.role === 'system');

    assert.match(String(systemMessage?.content || ''), /FARCASTER_AGENT_MODE:/);
    assert.match(String(systemMessage?.content || ''), /short, direct, conversational answer/i);
    assert.match(String(systemMessage?.content || ''), /Unless the user explicitly asks for detail, keep the answer brief/i);
});

test('assembleGenerationMessages emits multimodal current-turn content for OpenAI social-agent inputs', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-social-openai',
        taskId: 'task-social-openai',
        model: 'gpt-5.4-mini-2026-03-17',
        history: [],
        lastUserMessage: 'what is happening in this post',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            currentPage: 'x',
            pageContext: 'x_agent',
            socialInput: {
                platform: 'x',
                currentText: 'what is happening in this post',
                threadContextText: 'Parent @alice: look at this chart',
                images: [
                    {
                        url: 'https://example.com/post-image.png',
                        sourceLabel: 'current X post by @alice',
                    },
                ],
            },
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');
    const content = userMessage?.content as any[];

    assert.ok(Array.isArray(content));
    assert.equal(content[0]?.type, 'text');
    assert.match(String(content[0]?.text || ''), /\[SOCIAL_THREAD_CONTEXT\]/);
    assert.match(String(content[0]?.text || ''), /\[SOCIAL_IMAGES\]/);
    assert.equal(content[1]?.type, 'image_url');
    assert.equal(content[1]?.image_url?.url, 'https://example.com/post-image.png');
});

test('assembleGenerationMessages emits multimodal current-turn content for NVIDIA Kimi social-agent inputs', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-social-nvidia',
        taskId: 'task-social-nvidia',
        model: 'kimi-k2-5-instant',
        history: [],
        lastUserMessage: 'what is happening in this cast',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            currentPage: 'farcaster',
            pageContext: 'farcaster_agent',
            socialInput: {
                platform: 'farcaster',
                currentText: 'what is happening in this cast',
                threadContextText: 'Parent @alice: is this image bullish?',
                images: [
                    {
                        url: 'https://example.com/cast-image.png',
                        sourceLabel: 'current Farcaster cast by @alice',
                    },
                ],
            },
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'nvidia',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');
    const content = userMessage?.content as any[];

    assert.ok(Array.isArray(content));
    assert.equal(content[0]?.type, 'text');
    assert.match(String(content[0]?.text || ''), /\[SOCIAL_THREAD_CONTEXT\]/);
    assert.equal(content[1]?.type, 'image_url');
    assert.equal(content[1]?.image_url?.url, 'https://example.com/cast-image.png');
});

test('assembleGenerationMessages emits multimodal current-turn content for Grok social-agent inputs', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-social-grok',
        taskId: 'task-social-grok',
        model: 'grok-4-1-fast-non-reasoning',
        history: [],
        lastUserMessage: 'what is happening in this post',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            currentPage: 'x',
            pageContext: 'x_agent',
            socialInput: {
                platform: 'x',
                currentText: 'what is happening in this post',
                threadContextText: 'Parent @alice: look at this screenshot',
                images: [
                    {
                        url: 'https://example.com/x-image.png',
                        sourceLabel: 'current X post by @alice',
                    },
                ],
            },
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'grok',
        model: snapshot.model,
        supportsNativeSearch: true,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');
    const content = userMessage?.content as any[];

    assert.ok(Array.isArray(content));
    assert.equal(content[0]?.type, 'text');
    assert.match(String(content[0]?.text || ''), /\[SOCIAL_IMAGES\]/);
    assert.equal(content[1]?.type, 'image_url');
    assert.equal(content[1]?.image_url?.url, 'https://example.com/x-image.png');
});

test('assembleGenerationMessages falls back to image URLs on NVIDIA GLM social-agent inputs', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-social-glm',
        taskId: 'task-social-glm',
        model: 'glm-5',
        history: [],
        lastUserMessage: 'what is happening in this cast',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            currentPage: 'farcaster',
            pageContext: 'farcaster_agent',
            socialInput: {
                platform: 'farcaster',
                currentText: 'what is happening in this cast',
                threadContextText: 'Parent @alice: is this image bullish?',
                images: [
                    {
                        url: 'https://example.com/cast-image.png',
                        sourceLabel: 'current Farcaster cast by @alice',
                    },
                ],
            },
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'nvidia',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');

    assert.equal(typeof userMessage?.content, 'string');
    assert.match(String(userMessage?.content || ''), /\[SOCIAL_IMAGE_URLS\]/);
    assert.match(String(userMessage?.content || ''), /https:\/\/example\.com\/cast-image\.png/);
});

test('assembleGenerationMessages exposes requested address classifications in user context', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-address',
        taskId: 'task-address',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'analyze 0x4972e029f2e1831d205b20d05833cc771feb2ba3',
        runtime: {
            contextBlocks: {},
            userSettings: {},
            currentPage: 'farcaster',
            pageContext: 'farcaster_agent',
        },
        requestedTokenAddresses: ['0x4972e029f2e1831d205b20d05833cc771feb2ba3'],
        requestedTokenSymbols: [],
        requestedAddressClassifications: [
            {
                address: '0x4972e029f2e1831d205b20d05833cc771feb2ba3',
                kind: 'token_contract',
                chainId: 8453,
                chainName: 'Base',
                source: 'rpc',
            },
        ],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');

    assert.match(String(userMessage?.content || ''), /requested_address_classifications: 0x4972e029f2e1831d205b20d05833cc771feb2ba3 \| kind=token_contract \| chain=Base \| source=rpc/);
});

test('assembleGenerationMessages nudges shortlist research tasks toward multi-source evidence and official links', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-research',
        taskId: 'task-research',
        model: 'grok-4-1-fast-non-reasoning',
        history: [],
        lastUserMessage: '结合 X 搜索、网络搜索和 Polymarket，给我找马上要 TGE 和空投的项目，并附上教程链接',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'grok',
        model: snapshot.model,
        supportsNativeSearch: true,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        searchMode: 'required',
        searchReason: 'realtime_social_context',
        allowAllTools: true,
        toolPhase: 'native_search_only',
        intentEnvelope: {
            primary_intent: 'search_discovery',
            task_mode: 'discover',
            search_mode: 'required',
            search_target: 'x_and_web',
            domain: 'market',
            execution_risk: 'read_only',
            required_evidence: ['native_search_results'],
        },
    });

    const systemMessage = messages.find((message) => message.role === 'system');
    assert.match(String(systemMessage?.content || ''), /do not stop after one partial lead/i);
    assert.match(String(systemMessage?.content || ''), /usable shortlist with concrete links/i);

    const userMessage = messages.find((message) => message.role === 'user');
    assert.match(String(userMessage?.content || ''), /research\/discovery\/list-building tasks/i);
    assert.match(String(userMessage?.content || ''), /usable shortlist or guide/i);
    assert.match(String(userMessage?.content || ''), /smallest search set that can satisfy the required evidence/i);
    assert.match(String(userMessage?.content || ''), /about 6 provider-native search\/open actions/i);
});

test('assembleGenerationMessages includes strategy notes for early-buyer token profit follow-ups', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-wallet-followup',
        taskId: 'task-wallet-followup',
        model: 'gpt-5.4',
        history: [],
        lastUserMessage: '这些钱包在这个代币上的利润是怎么样的？',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        requestedTokenSymbols: [],
        recentToolTrace: {
            messageId: 'assistant-early-buyers',
            toolCalls: [
                {
                    tool: 'get_early_buyers',
                    status: 'success',
                    result: {
                        earlyBuyers: [
                            { address: '0xabc' },
                            { address: '0xdef' },
                        ],
                    },
                },
            ],
        },
        conversationActionState: {
            pendingAction: 'none',
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        },
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        preferredTools: ['analyze_wallet_pnl_batch'],
        strategyNotes: [
            'If recent early-buyer rows already exist and the user now asks for profit/PnL or per-wallet buy/sell summaries, reuse those wallet addresses as the candidate set for batch wallet PnL analysis.',
            'Pass the same token_address into analyze_wallet_pnl_batch so the result reports each wallet\'s buy USD, sell USD, realized PnL, and profit percent for that token over a supported recent window (1d / 7d / 30d, default 30d).',
        ],
        toolPhase: 'local_analysis',
        searchMode: 'forbidden',
        searchReason: 'no_search_required',
    });

    const userMessage = messages.find((message) => message.role === 'user');
    const content = String(userMessage?.content || '');

    assert.match(content, /\[TOOL_CONTEXT\]/);
    assert.match(content, /reuse those wallet addresses as the candidate set for batch wallet PnL analysis/);
    assert.match(content, /Pass the same token_address into analyze_wallet_pnl_batch/);
});

test('assembleGenerationMessages exposes persisted polymarket selection state to the model', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-poly',
        taskId: 'task-poly',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'bet down for 1$',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['BTC'],
        polymarketSelection: {
            sourceTool: 'get_polymarket_coin_updown_markets',
            capturedAt: '2026-03-26T05:58:03.000Z',
            candidates: [
                {
                    title: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                    question: 'Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET',
                    marketId: '305787',
                    marketSlug: 'btc-updown-5m-1774504500',
                    conditionId: 'condition-1',
                    outcomes: [
                        { name: 'Up', tokenId: 'token-up' },
                        { name: 'Down', tokenId: 'token-down' },
                    ],
                },
            ],
        },
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');
    const content = String(userMessage?.content || '');
    assert.match(content, /polymarket_selection: market=Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET/i);
    assert.match(content, /outcomes=\[Up:token-up, Down:token-down\]/i);
});

test('assembleGenerationMessages tells non-native-search providers to use local search tools when search is required', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-4',
        taskId: 'task-4',
        model: 'glm-5',
        history: [],
        lastUserMessage: "Search X for 0x1111111111111111111111111111111111111111 around yesterday's announcement",
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'nvidia',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        searchMode: 'required',
        searchReason: 'social_plus_chain_evidence_required',
        toolPhase: 'local_analysis',
        intentEnvelope: {
            primary_intent: 'social_discovery',
            task_mode: 'discover',
            search_mode: 'required',
            search_target: 'x',
            domain: 'x',
            execution_risk: 'read_only',
            required_evidence: ['native_search_results', 'onchain_token_evidence'],
        },
    });

    const systemMessage = messages.find((message) => message.role === 'system');
    assert.match(String(systemMessage?.content || ''), /use local search tools such as external_web_search/i);
    assert.match(String(systemMessage?.content || ''), /do not say you found, confirmed, verified, or retrieved anything unless a real tool/i);
    assert.match(String(systemMessage?.content || ''), /never narrate planned tool usage in plain text/i);
    assert.match(String(systemMessage?.content || ''), /final answers must stay grounded in the actual tool\/source fields you have/i);
    assert.equal(String(systemMessage?.content || '').includes('[TOOL_CALL_EXAMPLES]'), false);
});

test('assembleGenerationMessages carries early-buyer evidence requirements through structured guidance', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-5',
        taskId: 'task-5',
        model: 'glm-5',
        history: [],
        lastUserMessage: 'Find early buyers around 2026-03-10 12:00 UTC for 0xeCCBb861c0dda7eFd964010085488B69317e4444',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0xeCCBb861c0dda7eFd964010085488B69317e4444'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'nvidia',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        searchMode: 'required',
        searchReason: 'social_plus_chain_evidence_required',
        toolPhase: 'local_analysis',
        intentEnvelope: {
            primary_intent: 'social_discovery',
            task_mode: 'discover',
            search_mode: 'required',
            search_target: 'x',
            domain: 'x',
            execution_risk: 'read_only',
            required_evidence: ['native_search_results', 'onchain_token_evidence'],
        },
    });

    const userMessage = messages.find((message) => message.role === 'user');
    assert.match(String(userMessage?.content || ''), /\[TOOL_CONTEXT\]/);
    assert.match(String(userMessage?.content || ''), /required evidence before final answer\/conclusion: native_search_results, onchain_token_evidence/i);
});

test('assembleGenerationMessages includes exact canonical time anchor bounds when present', () => {
    const normalizedIntent: CanonicalIntent = {
        domain: 'token',
        intent: 'early_buyers',
        taskMode: 'analyze',
        outputMode: 'full_table',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.98,
        explanation: 'literal time window',
        entities: {
            tokenAddresses: ['0xabc'],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: null,
        timeContext: {
            isTimeBound: true,
            description: 'today 11:48 in user timezone',
            startTime: '2026-04-03T11:48:00+08:00',
            endTime: '2026-04-03T11:48:59+08:00',
        },
        evidenceRequirements: ['onchain_token_evidence'],
        requiresRealtime: true,
        requiresOnchainEvidence: true,
        executionCandidate: false,
        rowCount: null,
        locale: 'zh',
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
    };
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-time-anchor',
        taskId: 'task-time-anchor',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: '帮我获取0xabc今天11:48的早期购买者',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0xabc'],
        requestedTokenSymbols: [],
        normalizedIntent,
        toolDefinitions: [],
    } as ChatContextSnapshot;

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');
    const content = String(userMessage?.content || '');
    assert.match(content, /time_anchor_start: 2026-04-03T11:48:00\+08:00/);
    assert.match(content, /time_anchor_end: 2026-04-03T11:48:59\+08:00/);
});

test('assembleGenerationMessages uses compact execution mode guidance for swap execution flows', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-6',
        taskId: 'task-6',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Sell all 0x950e88438098bc08879243984a3cf7c63eb95ba3 to ETH',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: ['0x950e88438098bc08879243984a3cf7c63eb95ba3'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        intentEnvelope: {
            primary_intent: 'swap_execution',
            task_mode: 'execute',
            search_mode: 'forbidden',
            search_target: 'none',
            domain: 'token',
            execution_risk: 'mutation',
            required_evidence: [],
        },
    });

    const systemMessage = messages.find((message) => message.role === 'system');
    assert.match(String(systemMessage?.content || ''), /EXECUTION_MODE: quote_before_swap/);
    assert.match(String(systemMessage?.content || ''), /Quote once, wait for explicit confirmation/i);
});

test('assembleGenerationMessages includes canonical intent normalization summary when available', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-intent',
        taskId: 'task-intent',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Check early buyers for 30',
        requestedTokenAddresses: ['0xeCCBb861c0dda7eFd964010085488B69317e4444'],
        requestedTokenSymbols: [],
        toolDefinitions: [],
        normalizedIntent: {
            domain: 'token',
            intent: 'early_buyers',
            taskMode: 'analyze',
            outputMode: 'full_table',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.9,
            explanation: 'Early buyer export',
            entities: {
                tokenAddresses: ['0xeCCBb861c0dda7eFd964010085488B69317e4444'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: {
                chainId: 56,
                chainName: 'BNB Chain',
                source: 'llm',
            },
            timeContext: null,
            evidenceRequirements: ['onchain_token_evidence'],
            requiresRealtime: false,
            requiresOnchainEvidence: true,
            executionCandidate: false,
            rowCount: 30,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        },
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const userMessage = messages.find((message) => message.role === 'user');
    const content = String(userMessage?.content || '');
    assert.match(content, /\[INTENT_NORMALIZATION\]/);
    assert.match(content, /intent: early_buyers/);
    assert.match(content, /output_mode: full_table/);
    assert.match(content, /row_count: 30/);
});

test('assembleGenerationMessages adds fast swap contract guidance when fast swap mode is enabled', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-fast',
        taskId: 'task-fast',
        model: 'gpt-5-mini',
        history: [],
        lastUserMessage: 'Buy VIRTUAL now',
        runtime: {
            contextBlocks: {},
            userSettings: {
                fastSwapMode: true,
                showQuoteBeforeSwap: false,
            },
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['VIRTUAL'],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'openai',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo, {
        intentEnvelope: {
            primary_intent: 'swap_execution',
            task_mode: 'execute',
            search_mode: 'forbidden',
            search_target: 'none',
            domain: 'token',
            execution_risk: 'mutation',
            required_evidence: [],
        },
    });

    const systemMessage = messages.find((message) => message.role === 'system');
    assert.match(String(systemMessage?.content || ''), /EXECUTION_MODE: fast_swap/);
    assert.match(String(systemMessage?.content || ''), /Quote is optional, not a blocking prerequisite/i);
});

test('assembleGenerationMessages does not send stored reasoning_content back to NVIDIA reasoning-model history', () => {
    const snapshot: ChatContextSnapshot = {
        sessionId: 'session-2',
        taskId: 'task-2',
        model: 'glm-5',
        history: [
            {
                role: 'assistant',
                content: 'Previous answer',
                reasoningContent: 'Internal reasoning that should stay local.',
            },
            {
                role: 'user',
                content: 'next question',
            },
        ],
        lastUserMessage: 'What is next?',
        runtime: {
            contextBlocks: {},
            userSettings: {},
        },
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: [],
    };

    const providerInfo: ProviderInfo = {
        provider: 'nvidia',
        model: snapshot.model,
        supportsNativeSearch: false,
        supportsPreviousResponse: false,
    };

    const messages = assembleGenerationMessages(snapshot, [], providerInfo);
    const assistantHistory = messages.find((message) => message.role === 'assistant');
    assert.ok(assistantHistory);
    assert.equal('reasoning_content' in (assistantHistory || {}), false);
});
