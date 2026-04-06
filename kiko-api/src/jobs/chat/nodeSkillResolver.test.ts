import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { resolveProviderInfo, buildProviderOptions } from './providerPolicyBuilder.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { toolRegistry } from '../../tooling/registry.js';
import type { CanonicalIntent } from './canonicalIntent.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    const runtime = {
        userSettings: {},
        toolContext: {},
        prefetchedToolResults: {},
        contextBlocks: {},
        ...(runtimeOverrides || {}),
    };
    return {
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'grok-4.1-fast',
        history: [{ role: 'user', content: message }],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: toolRegistry.getAllDefinitions(),
        policySnapshot: null,
        ...restOverrides,
        runtime,
    } as ChatContextSnapshot;
}

function makeCanonicalIntent(overrides: Partial<CanonicalIntent>): CanonicalIntent {
    return {
        domain: 'general',
        intent: 'social_discovery',
        taskMode: 'discover',
        outputMode: 'narrative',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.9,
        explanation: 'test canonical intent',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: null,
        timeContext: null,
        evidenceRequirements: [],
        requiresRealtime: false,
        requiresOnchainEvidence: false,
        executionCandidate: false,
        rowCount: null,
        locale: 'en',
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
        ...overrides,
    };
}

test('routes betting trend queries to Polymarket first', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'polymarket',
        intent: 'polymarket_discovery',
        searchMode: 'fallback',
        requiresRealtime: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot("what's trending bet?", {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'polymarket_prediction');
    assert.ok(resolution.allowedTools.includes('get_polymarket_market_overview'));
    assert.ok(resolution.preferredTools.includes('get_polymarket_market_overview'));
    assert.ok(resolution.allowedTools.includes('get_polymarket_trending'));
    assert.equal(resolution.searchMode, 'fallback');
});

test('routes 5-minute coin up/down queries to the exact short-window Polymarket tool', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'polymarket',
        intent: 'polymarket_short_window',
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['SOL'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requiresRealtime: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot('Give me a 5-minute Solana up or down bet', {
        normalizedIntent: canonicalIntent,
        requestedTokenSymbols: ['SOL'],
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'polymarket_prediction');
    assert.ok(resolution.allowedTools.includes('get_polymarket_coin_updown_markets'));
    assert.ok(resolution.preferredTools.includes('get_polymarket_coin_updown_markets'));
});

test('routes generic short-window Polymarket queries to broad short-window discovery first', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'polymarket',
        intent: 'polymarket_short_window',
        requiresRealtime: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot('Give me a short window market', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'polymarket_prediction');
    assert.ok(resolution.preferredTools.includes('get_polymarket_market_overview'));
    assert.ok(resolution.preferredTools.includes('get_new_markets'));
    assert.ok(!resolution.preferredTools.includes('get_polymarket_coin_updown_markets'));
});

test('tool registry self-initializes even when imported directly', () => {
    const definitions = toolRegistry.getAllDefinitions();
    assert.ok(definitions.length > 0);
    assert.ok(definitions.some((item) => item.name === 'get_token_info'));
});

test('routes Zora trend queries to Zora skill first', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'zora',
        intent: 'zora_discovery',
        requiresRealtime: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on Zora right now?", {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'zora_nfts');
    assert.ok(resolution.allowedTools.includes('get_zora_trending'));
});

test('routes capabilities questions to welcome skill without search', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'assistant_meta',
    });
    const resolution = resolveNodeSkills(makeSnapshot('What can KiKo do?', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.deepEqual(resolution.selectedSkills, ['welcome_onboarding']);
    assert.equal(resolution.allowAllTools, true);
    assert.equal(resolution.searchMode, 'forbidden');
});

test('routes malformed Kiko capability questions to welcome skill even without canonical intent', () => {
    const resolution = resolveNodeSkills(makeSnapshot('What can you doing Kiko?'), null);
    assert.deepEqual(resolution.selectedSkills, ['welcome_onboarding']);
    assert.equal(resolution.searchMode, 'forbidden');
    assert.ok(resolution.strategyNotes.some((note) => note.includes('real onboarding answer')));
});

test('routes assistant meta debugging turns to meta_debug without pulling stale token context back into skill selection', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'assistant_meta',
        intent: 'assistant_meta',
        taskMode: 'analyze',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        inheritEntitiesFromContext: false,
    });
    const resolution = resolveNodeSkills(makeSnapshot('Why did you fall back to that clarification message?', {
        normalizedIntent: canonicalIntent,
        requestedTokenSymbols: ['WHAT', 'KIKO'],
    }), null, canonicalIntent);
    assert.deepEqual(resolution.selectedSkills, ['meta_debug']);
    assert.equal(resolution.searchMode, 'forbidden');
    assert.ok(!resolution.selectedSkills.includes('token_analysis'));
    assert.equal(resolution.intentEnvelope.primary_intent, 'meta_debug');
    assert.equal(resolution.intentEnvelope.domain, 'assistant_meta');
    assert.ok(resolution.strategyNotes.some((note) => note.includes('assistant or system behavior itself')));
});

test('routes wallet pnl queries to wallet skill and keeps pnl tools', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'wallet',
        intent: 'wallet_pnl',
    });
    const resolution = resolveNodeSkills(makeSnapshot('Check my 30d wallet PnL', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'wallet_portfolio');
    assert.ok(resolution.allowedTools.includes('analyze_wallet_pnl_batch'));
    assert.ok(!resolution.allowedTools.includes('get_trending_casts'));
    assert.ok(!resolution.allowedTools.includes('search_farcaster_casts'));
    assert.ok(!resolution.allowedTools.includes('get_farcaster_user'));
});

test('explicit X search keeps native search required while preserving local token skill', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
        requiresOnchainEvidence: true,
    });
    const snapshot = makeSnapshot('Search X for what people say about BTC today', {
        requestedTokenSymbols: ['BTC'],
        normalizedIntent: canonicalIntent,
    });
    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);
    assert.equal(resolution.searchMode, 'required');
    assert.ok(resolution.selectedSkills.includes('token_analysis'));
    assert.equal(resolution.intentEnvelope.domain, 'x');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, 'local_analysis');
    assert.ok(resolution.intentEnvelope.required_evidence.includes('native_search_results'));
    assert.ok(resolution.intentEnvelope.required_evidence.includes('onchain_token_evidence'));

    const providerOptions = buildProviderOptions(
        snapshot,
        resolveProviderInfo(snapshot.model),
        snapshot.lastUserMessage,
        resolution,
    );
    assert.equal(providerOptions.enable_search, true);
    assert.equal(providerOptions.tool_policy?.native_tools.required, true);
    assert.equal(providerOptions.tool_policy?.native_tools.preferred_required_tool, 'x_search');
});

test('Grok mixed X, web, and Polymarket discovery queries still start native-first before local Polymarket tools', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'polymarket',
        intent: 'polymarket_discovery',
        searchMode: 'required',
        searchTarget: 'x_and_web',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results', 'connected_chain_evidence'],
    });
    const snapshot = makeSnapshot('Use X search, web search, and Polymarket detection to find imminent TGE and airdrop opportunities', {
        normalizedIntent: canonicalIntent,
    });
    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);

    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, 'local_analysis');
    assert.equal(resolution.searchMode, 'required');
    assert.equal(resolution.intentEnvelope.search_target, 'x_and_web');
    assert.ok(resolution.allowedTools.includes('search_polymarket'));
    assert.ok(resolution.allowedTools.includes('get_polymarket_market_overview'));

    const providerOptions = buildProviderOptions(
        snapshot,
        resolveProviderInfo(snapshot.model),
        snapshot.lastUserMessage,
        resolution,
    );
    assert.equal(providerOptions.enable_search, true);
    assert.deepEqual(providerOptions.tool_policy?.native_tools.enabled_tools, ['x_search', 'web_search']);
    assert.equal(providerOptions.tool_policy?.native_tools.preferred_required_tool, 'x_search');
});

test('Grok web-first discovery intents execute the declared web search target before local tools', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'market',
        intent: 'market_macro',
        searchMode: 'fallback',
        searchTarget: 'web',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results'],
    });
    const resolution = resolveNodeSkills(makeSnapshot('Use web search first, then summarize the market setup', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, null);

    const providerOptions = buildProviderOptions(
        makeSnapshot('Use web search first, then summarize the market setup', {
            normalizedIntent: canonicalIntent,
        }),
        resolveProviderInfo('grok-4.1-fast'),
        'Use web search first, then summarize the market setup',
        resolution,
    );
    assert.equal(providerOptions.enable_search, true);
    assert.deepEqual(providerOptions.tool_policy?.native_tools.enabled_tools, ['web_search']);
    assert.equal(providerOptions.tool_policy?.native_tools.preferred_required_tool, 'web_search');
});

test('X trending queries keep X-first intent but no longer lock tool exposure', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results', 'connected_chain_evidence'],
    });
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?", {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.intentEnvelope.domain, 'x');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, 'local_analysis');
    assert.ok(resolution.intentEnvelope.required_evidence.includes('connected_chain_evidence'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('X/Twitter')));
    assert.equal(resolution.allowAllTools, true);
});

test('DeepSeek X trending queries stay out of native-search-only while keeping full tool access', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results', 'connected_chain_evidence'],
    });
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?", {
        model: 'deepseek-reasoner',
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.intentEnvelope.domain, 'x');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.ok(resolution.allowAllTools);
    assert.ok(resolution.searchMode === 'required');
    assert.ok(resolution.strategyNotes.some((note) => note.includes('native X search')));
});

test('Grok prefers local trending-token evidence even when canonical intent over-specifies social search', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'web',
        requiresRealtime: true,
    });
    const snapshot = makeSnapshot("What's the trending token on BSC?", {
        normalizedIntent: canonicalIntent,
    });
    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);

    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.equal(resolution.searchMode, 'forbidden');
    assert.equal(resolution.searchReason, 'local_token_leaderboard_preferred');
    assert.equal(resolution.intentEnvelope.search_mode, 'forbidden');
    assert.equal(resolution.intentEnvelope.search_target, 'none');
    assert.ok(resolution.allowedTools.includes('get_trending_tokens'));
    assert.ok(!resolution.allowedTools.includes('external_web_search'));

    const providerOptions = buildProviderOptions(
        snapshot,
        resolveProviderInfo(snapshot.model),
        snapshot.lastUserMessage,
        resolution,
    );
    assert.equal(providerOptions.enable_search, false);
    assert.equal(providerOptions.tool_policy?.native_tools.required, false);
});

test('Grok no-canonical leaderboard-like queries may stay local without overriding any canonical intent', () => {
    const snapshot = makeSnapshot("What's the trending token on BSC?");
    const resolution = resolveNodeSkills(snapshot, null);

    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.equal(resolution.searchMode, 'forbidden');
    assert.ok(resolution.allowedTools.includes('get_trending_tokens'));
});

test('DeepSeek X plus contract-and-time queries require external search plus chain tools', () => {
    const contract = '0x1111111111111111111111111111111111111111';
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        requiresOnchainEvidence: true,
        timeContext: {
            isTimeBound: true,
            description: 'around yesterday announcement',
        },
        evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
    });
    const resolution = resolveNodeSkills(makeSnapshot(`Search X for ${contract} around yesterday's announcement`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(resolution.searchMode, 'required');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.ok(resolution.allowedTools.includes('external_web_search'));
    assert.ok(resolution.allowedTools.includes('get_token_info'));
    assert.ok(resolution.preferredTools.includes('external_web_search'));
    assert.ok(resolution.preferredTools.includes('get_token_info'));
    assert.ok(resolution.intentEnvelope.required_evidence.includes('onchain_token_evidence'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('external_web_search')));
});

test('generic X queries still require search plus chain-side follow-up', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results', 'connected_chain_evidence'],
    });
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?", {
        model: 'deepseek-reasoner',
        runtime: {
            walletAddress: '0xabc',
        },
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(resolution.searchMode, 'required');
    assert.ok(resolution.allowAllTools);
    assert.ok(resolution.preferredTools.includes('get_wallet_info'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('chain-side evidence')));
});

test('official announcement date lookups are treated as required search even without explicit X keyword', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        requiresOnchainEvidence: true,
        timeContext: {
            isTimeBound: true,
            description: 'official listing announcement date',
        },
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
    });
    const resolution = resolveNodeSkills(makeSnapshot(`你可以寻找这个代币的${contract}在binance官方账户发布关于这个代币发布上架Alpha的帖子日期当时，购买的早期购买者吗？`, {
        model: 'grok-4-1-fast-non-reasoning',
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(resolution.searchMode, 'required');
    assert.equal(resolution.searchReason, 'canonical_social_discovery');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, 'local_analysis');
    assert.ok(resolution.allowedTools.includes('get_token_info'));
    assert.ok(resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(resolution.intentEnvelope.required_evidence.includes('onchain_token_evidence'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('start_time/end_time')));
});

test('pure early-buyer token queries require on-chain evidence before concluding', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'early_buyers',
        outputMode: 'full_table',
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        evidenceRequirements: ['onchain_token_evidence'],
        requiresOnchainEvidence: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot(`Check ${contract} early buyer`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(resolution.intentEnvelope.primary_intent, 'token_analysis');
    assert.ok(resolution.intentEnvelope.required_evidence.includes('onchain_token_evidence'));
    assert.ok(resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('default to full-list output')
        )
    );
});

test('full early-buyer export queries prefer full-table output wording', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'early_buyers',
        outputMode: 'full_table',
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        evidenceRequirements: ['onchain_token_evidence'],
        requiresOnchainEvidence: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot(`Export the full early buyers table for ${contract}`, {
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.ok(resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('default to full-list output')
        )
    );
});

test('time-bound early-buyer queries preserve the literal requested window semantics', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'early_buyers',
        outputMode: 'full_table',
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        timeContext: {
            isTimeBound: true,
            description: 'today 11:48 in user timezone',
            startTime: '2026-04-03T11:48:00+08:00',
            endTime: '2026-04-03T11:48:59+08:00',
        },
        evidenceRequirements: ['onchain_token_evidence'],
        requiresOnchainEvidence: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot(`帮我获取${contract}今天11:48的早期购买者`, {
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.ok(resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('treat the requested time window as literal query scope')
        )
    );
});


test('explicit early-buyer row count queries are treated as full exports', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'early_buyers',
        outputMode: 'full_table',
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        evidenceRequirements: ['onchain_token_evidence'],
        requiresOnchainEvidence: true,
        rowCount: 30,
    });
    const resolution = resolveNodeSkills(makeSnapshot(`Check ${contract} early buyer for 30`, {
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.ok(resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('default to full-list output') && note.includes('30 rows')
        )
    );
});

test('swap intents prefer wallet info and preflight before prepare swap execution', () => {
    const contract = '0x950e88438098bc08879243984a3cf7c63eb95ba3';
    const resolution = resolveNodeSkills(makeSnapshot(`Sell all ${contract} to ETH`, {
        model: 'gpt-5-mini',
        requestedTokenAddresses: [contract],
        runtime: {
            chainId: 8453,
            chainName: 'Base',
            walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
        },
    }), {
        kind: 'trading',
        type: 'swap',
    } as any);

    assert.ok(resolution.preferredTools.includes('get_wallet_info'));
    assert.ok(resolution.preferredTools.includes('simulate_swap'));
    assert.ok(resolution.preferredTools.includes('prepare_swap_transaction'));
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('preflight evidence first') || note.includes('Quote-before-swap mode is enabled')
        )
    );
    assert.ok(!resolution.allowedTools.includes('get_token_price'));
});

test('official source lookup handles split Chinese intent words and English synonyms', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        requiresOnchainEvidence: true,
        timeContext: {
            isTimeBound: true,
            description: 'official listing announcement date',
        },
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
    });
    const zhResolution = resolveNodeSkills(makeSnapshot(`帮我找一下 Binance 官方 账户 关于 ${contract} 上架 Alpha 的 帖子 日期`, {
        model: 'grok-4-1-fast-non-reasoning',
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    const enResolution = resolveNodeSkills(makeSnapshot(`Find the date when Binance official handle posted the Alpha listing update for ${contract}`, {
        model: 'grok-4-1-fast-non-reasoning',
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(zhResolution.searchMode, 'required');
    assert.equal(enResolution.searchMode, 'required');
    assert.equal(zhResolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(enResolution.toolPhasePolicy.initialPhase, 'native_search_only');
});

test('resolver records that explicit query chain overrides connected chain', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'swap',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        requestedChain: {
            chainId: 56,
            chainName: 'BNB Chain',
            source: 'llm',
        },
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['CAKE'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        executionCandidate: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot('Buy CAKE on BNB chain', {
        requestedTokenSymbols: ['CAKE', 'BNB'],
        runtime: {
            chainId: 8453,
            chainName: 'Base',
        },
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.ok(resolution.strategyNotes.some((note) => note.includes('requested BNB Chain')));
});

test('non-Grok Farcaster discovery stays in local analysis phase', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'farcaster',
        intent: 'social_discovery',
        requiresRealtime: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on Farcaster today?", {
        model: 'deepseek-reasoner',
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.intentEnvelope.domain, 'farcaster');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.ok(resolution.allowedTools.includes('get_trending_casts'));
});

test('Grok social discovery on Farcaster uses native search only and blocks local Farcaster cache tools', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'farcaster',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
    });
    const snapshot = makeSnapshot("What's trending on Farcaster today?", {
        model: 'grok-4-1-fast-non-reasoning',
        normalizedIntent: canonicalIntent,
    });
    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);

    assert.equal(resolution.intentEnvelope.domain, 'farcaster');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.ok(!resolution.allowedTools.includes('get_trending_casts'));
    assert.ok(!resolution.allowedTools.includes('search_farcaster_casts'));
    assert.ok(!resolution.allowedTools.includes('get_farcaster_user'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('does not expose local Farcaster cache/search tools')));

    const nativeOptions = buildProviderOptions(
        snapshot,
        resolveProviderInfo(snapshot.model),
        snapshot.lastUserMessage,
        resolution,
    );
    assert.equal(nativeOptions.enable_search, true);

    const localOptions = buildProviderOptions(
        snapshot,
        resolveProviderInfo(snapshot.model),
        snapshot.lastUserMessage,
        resolution,
        { currentPhase: 'local_analysis' },
    );
    assert.equal(localOptions.enable_search, false);
});

test('Polymarket order intent requires verified token evidence before execution phase', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'polymarket',
        intent: 'polymarket_order',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['BTC'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        evidenceRequirements: ['verified_polymarket_token_id'],
        executionCandidate: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot('Place a YES order on Polymarket for BTC 100k', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.intentEnvelope.primary_intent, 'polymarket_order');
    assert.equal(resolution.intentEnvelope.execution_risk, 'mutation');
    assert.ok(resolution.intentEnvelope.required_evidence.includes('verified_polymarket_token_id'));
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.ok(resolution.preferredTools.includes('prepare_polymarket_bet'));
});

test('Polymarket order intent with recent short-window evidence reuses session evidence and prefers bet prep', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'polymarket',
        intent: 'polymarket_order',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['BTC'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        evidenceRequirements: ['verified_polymarket_token_id'],
        executionCandidate: true,
    });
    const snapshot = makeSnapshot('Bitcoin Up or Down - March 26, 1:55AM-2:00AM ET for down $1', {
        normalizedIntent: canonicalIntent,
        recentToolTrace: {
            messageId: 'assistant-poly-1',
            toolCalls: [
                { tool: 'get_polymarket_coin_updown_markets', status: 'success' },
            ],
        },
    });
    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);
    assert.ok(resolution.preferredTools.includes('prepare_polymarket_bet'));
    assert.ok(resolution.preferredTools.includes('get_polymarket_coin_updown_markets'));
    assert.ok(
        resolution.strategyNotes.some((note) => note.includes('move directly into bet preparation')),
    );
});

test('resolver only exposes tools that exist in the runtime toolDefinitions snapshot', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results', 'onchain_token_evidence'],
        requiresOnchainEvidence: true,
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['BTC'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
    });
    const snapshot = makeSnapshot('Search X for BTC sentiment, then analyze holders', {
        requestedTokenSymbols: ['BTC'],
        normalizedIntent: canonicalIntent,
        toolDefinitions: [
            {
                name: 'get_token_info',
                description: 'Token info',
                parameters: { type: 'object', properties: {} },
            },
        ] as any,
    });
    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);
    assert.deepEqual(resolution.allowedTools, ['get_token_info']);
    assert.deepEqual(resolution.preferredTools, ['get_token_info']);
});

test('resolver carries forward session-used tools into orchestration context', () => {
    const snapshot = makeSnapshot('继续', {
        recentToolTrace: {
            messageId: 'assistant-1',
            toolCalls: [
                { tool: 'external_web_search', status: 'success' },
                { tool: 'get_token_info', status: 'success' },
            ],
        },
    });

    const resolution = resolveNodeSkills(snapshot, null);
    assert.ok(resolution.allowedTools.includes('external_web_search'));
    assert.ok(resolution.allowedTools.includes('get_token_info'));
    assert.ok(resolution.preferredTools.includes('external_web_search'));
    assert.ok(resolution.preferredTools.includes('get_token_info'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Recent tool evidence is available from this session')));
});

test('resolver keeps the full available registry exposed on non-hard-policy turns', () => {
    const snapshot = makeSnapshot('What can you do?', {
        toolDefinitions: [
            {
                name: 'get_token_info',
                description: 'Token info',
                parameters: { type: 'object', properties: {} },
            },
            {
                name: 'external_web_search',
                description: 'Search the web',
                parameters: { type: 'object', properties: {} },
            },
        ] as any,
    });

    const resolution = resolveNodeSkills(snapshot, null);
    assert.ok(resolution.allowAllTools);
    assert.deepEqual(resolution.allowedTools.sort(), ['external_web_search', 'get_token_info']);
});

test('canonical multilingual early-buyer intents route identically across languages', () => {
    const canonicalIntent: CanonicalIntent = {
        domain: 'token',
        intent: 'early_buyers',
        taskMode: 'analyze',
        outputMode: 'full_table',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.92,
        explanation: 'Early buyer table request.',
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
    };

    const messages = [
        'Check early buyers for 30',
        '查这个代币前30个早期买家',
        'Dame los primeros 30 compradores tempranos',
        '最初の30人の早期購入者を見せて',
        'اعرض أول 30 من المشترين الأوائل',
    ];

    for (const message of messages) {
        const resolution = resolveNodeSkills(makeSnapshot(message, {
            requestedTokenAddresses: canonicalIntent.entities.tokenAddresses,
            normalizedIntent: canonicalIntent,
        }), null, canonicalIntent);
        assert.equal(resolution.selectedSkills[0], 'token_analysis');
        assert.ok(resolution.preferredTools.includes('get_early_buyers'));
        assert.equal(resolution.intentEnvelope.primary_intent, 'token_analysis');
    }
});

test('canonical polymarket short-window intent routes without raw keyword dependence', () => {
    const canonicalIntent: CanonicalIntent = {
        domain: 'polymarket',
        intent: 'polymarket_short_window',
        taskMode: 'discover',
        outputMode: 'narrative',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.88,
        explanation: 'Short-window Polymarket request.',
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['SOL'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: null,
        timeContext: {
            isTimeBound: true,
            description: 'next five minutes',
        },
        evidenceRequirements: [],
        requiresRealtime: true,
        requiresOnchainEvidence: false,
        executionCandidate: false,
        rowCount: null,
        locale: 'en',
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
    };

    const resolution = resolveNodeSkills(makeSnapshot('non keyword phrasing', {
        normalizedIntent: canonicalIntent,
        requestedTokenSymbols: ['SOL'],
    }), null, canonicalIntent);

    assert.equal(resolution.selectedSkills[0], 'polymarket_prediction');
    assert.ok(resolution.preferredTools.includes('get_polymarket_coin_updown_markets'));
});

test('canonical generic polymarket short-window intent does not over-narrow to coin-only 5m', () => {
    const canonicalIntent: CanonicalIntent = {
        domain: 'polymarket',
        intent: 'polymarket_short_window',
        taskMode: 'discover',
        outputMode: 'narrative',
        searchMode: 'forbidden',
        searchTarget: 'none',
        confidence: 0.89,
        explanation: 'Generic short-window Polymarket request.',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        requestedChain: null,
        timeContext: {
            isTimeBound: true,
            description: 'short window',
        },
        evidenceRequirements: [],
        requiresRealtime: true,
        requiresOnchainEvidence: false,
        executionCandidate: false,
        rowCount: null,
        locale: 'en',
        needsClarification: false,
        clarificationQuestion: null,
        source: 'llm',
    };

    const resolution = resolveNodeSkills(makeSnapshot('non keyword generic short-window phrasing', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(resolution.selectedSkills[0], 'polymarket_prediction');
    assert.ok(resolution.preferredTools.includes('get_polymarket_market_overview'));
    assert.ok(resolution.preferredTools.includes('get_new_markets'));
    assert.ok(!resolution.preferredTools.includes('get_polymarket_coin_updown_markets'));
});

test('wallet PnL follow-ups reuse recent early-buyer evidence as batch candidates', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Show wallet PnL for those early buyers and rank them by profit', {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        recentToolTrace: {
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
    }), null, null);

    assert.ok(resolution.preferredTools.includes('analyze_wallet_pnl_batch'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('reuse those wallet addresses as the candidate set for batch wallet PnL analysis')));
});

test('early-buyer follow-ups asking for per-wallet buy and sell summaries force token batch PnL analysis', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Show each early buyer buy and sell summary for this token', {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        recentToolTrace: {
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
    }), null, null);

    assert.ok(resolution.selectedSkills.includes('wallet_portfolio'));
    assert.ok(resolution.preferredTools.includes('analyze_wallet_pnl_batch'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('buy USD, sell USD, realized PnL, and profit percent')));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Do not answer profit ranking or per-wallet token trade summaries from the early-buyer rows alone')));
});

test('Chinese early-buyer follow-up about token profit stays on token batch PnL path', () => {
    const resolution = resolveNodeSkills(makeSnapshot('这些钱包在这个代币上的利润是怎么样的？', {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        recentToolTrace: {
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
    }), null, null);

    assert.ok(resolution.selectedSkills.includes('wallet_portfolio'));
    assert.ok(resolution.preferredTools.includes('analyze_wallet_pnl_batch'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('reuse those wallet addresses as the candidate set for batch wallet PnL analysis')));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Pass the same token_address into analyze_wallet_pnl_batch')));
});

test('Chinese early-buyer follow-up using 利益 stays on token batch PnL path', () => {
    const resolution = resolveNodeSkills(makeSnapshot('它们在这个代币上的利益是多少？', {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        recentToolTrace: {
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
    }), null, null);

    assert.ok(resolution.selectedSkills.includes('wallet_portfolio'));
    assert.ok(resolution.preferredTools.includes('analyze_wallet_pnl_batch'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('reuse those wallet addresses as the candidate set for batch wallet PnL analysis')));
});

test('misnormalized early-buyer follow-up still routes 利益 question to token batch PnL', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'early_buyers',
        taskMode: 'analyze',
        outputMode: 'full_table',
        searchMode: 'fallback',
        entities: {
            tokenAddresses: ['0x1111111111111111111111111111111111111111'],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        inheritEntitiesFromContext: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot('它们在这个代币上的利益是多少？', {
        normalizedIntent: canonicalIntent,
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        recentToolTrace: {
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
    }), null, canonicalIntent);

    assert.ok(resolution.selectedSkills.includes('wallet_portfolio'));
    assert.ok(resolution.preferredTools.includes('analyze_wallet_pnl_batch'));
    assert.ok(!resolution.strategyNotes.some((note) => note.includes('Early-buyer queries default to full-list output')));
});
