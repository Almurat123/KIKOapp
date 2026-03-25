import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { resolveProviderInfo, buildProviderOptions } from './providerPolicyBuilder.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { toolRegistry } from '../../tooling/registry.js';

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

test('routes betting trend queries to Polymarket first', () => {
    const resolution = resolveNodeSkills(makeSnapshot("what's trending bet?"), null);
    assert.equal(resolution.selectedSkills[0], 'polymarket_prediction');
    assert.ok(resolution.allowedTools.includes('get_polymarket_market_overview'));
    assert.ok(resolution.preferredTools.includes('get_polymarket_market_overview'));
    assert.ok(resolution.allowedTools.includes('get_polymarket_trending'));
    assert.equal(resolution.searchMode, 'fallback');
});

test('routes 5-minute coin up/down queries to the exact short-window Polymarket tool', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Give me a 5-minute Solana up or down bet'), null);
    assert.equal(resolution.selectedSkills[0], 'polymarket_prediction');
    assert.ok(resolution.allowedTools.includes('get_polymarket_coin_updown_markets'));
    assert.ok(resolution.preferredTools.includes('get_polymarket_coin_updown_markets'));
});

test('tool registry self-initializes even when imported directly', () => {
    const definitions = toolRegistry.getAllDefinitions();
    assert.ok(definitions.length > 0);
    assert.ok(definitions.some((item) => item.name === 'get_token_info'));
});

test('routes Zora trend queries to Zora skill first', () => {
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on Zora right now?"), null);
    assert.equal(resolution.selectedSkills[0], 'zora_nfts');
    assert.ok(resolution.allowedTools.includes('get_zora_trending'));
});

test('routes capabilities questions to welcome skill without search', () => {
    const resolution = resolveNodeSkills(makeSnapshot('What can KiKo do?'), null);
    assert.deepEqual(resolution.selectedSkills, ['welcome_onboarding']);
    assert.equal(resolution.allowAllTools, true);
    assert.equal(resolution.searchMode, 'forbidden');
});

test('routes wallet pnl queries to wallet skill and keeps pnl tools', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Check my 30d wallet PnL'), null);
    assert.equal(resolution.selectedSkills[0], 'wallet_portfolio');
    assert.ok(resolution.allowedTools.includes('analyze_wallet_pnl_batch'));
});

test('explicit X search keeps native search required while preserving local token skill', () => {
    const snapshot = makeSnapshot('Search X for what people say about BTC today', {
        requestedTokenSymbols: ['BTC'],
    });
    const resolution = resolveNodeSkills(snapshot, null);
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
    assert.equal(providerOptions.tool_policy?.native_tools.required, false);
    assert.equal(providerOptions.tool_policy?.native_tools.preferred_required_tool, 'x_search');
});

test('X trending queries keep X-first intent but no longer lock tool exposure', () => {
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?"), null);
    assert.equal(resolution.intentEnvelope.domain, 'x');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, 'local_analysis');
    assert.ok(resolution.intentEnvelope.required_evidence.includes('connected_chain_evidence'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('X/Twitter')));
    assert.equal(resolution.allowAllTools, true);
});

test('DeepSeek X trending queries stay out of native-search-only while keeping full tool access', () => {
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?", {
        model: 'deepseek-reasoner',
    }), null);
    assert.equal(resolution.intentEnvelope.domain, 'x');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.ok(resolution.allowAllTools);
    assert.ok(resolution.searchMode === 'required');
    assert.ok(resolution.strategyNotes.some((note) => note.includes('native X search')));
});

test('DeepSeek X plus contract-and-time queries require external search plus chain tools', () => {
    const contract = '0x1111111111111111111111111111111111111111';
    const resolution = resolveNodeSkills(makeSnapshot(`Search X for ${contract} around yesterday's announcement`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [contract],
    }), null);

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
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?", {
        model: 'deepseek-reasoner',
        runtime: {
            walletAddress: '0xabc',
        },
    }), null);

    assert.equal(resolution.searchMode, 'required');
    assert.ok(resolution.allowAllTools);
    assert.ok(resolution.preferredTools.includes('get_wallet_info'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('chain-side evidence')));
});

test('official announcement date lookups are treated as required search even without explicit X keyword', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const resolution = resolveNodeSkills(makeSnapshot(`你可以寻找这个代币的${contract}在binance官方账户发布关于这个代币发布上架Alpha的帖子日期当时，购买的早期购买者吗？`, {
        model: 'grok-4-1-fast-non-reasoning',
        requestedTokenAddresses: [contract],
    }), null);

    assert.equal(resolution.searchMode, 'required');
    assert.equal(resolution.searchReason, 'social_plus_chain_evidence_required');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, 'local_analysis');
    assert.ok(resolution.allowedTools.includes('get_token_info'));
    assert.ok(resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(resolution.intentEnvelope.required_evidence.includes('onchain_token_evidence'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('start_time/end_time')));
});

test('pure early-buyer token queries require on-chain evidence before concluding', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const resolution = resolveNodeSkills(makeSnapshot(`Check ${contract} early buyer`, {
        model: 'deepseek-reasoner',
        requestedTokenAddresses: [contract],
    }), null);

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
    const resolution = resolveNodeSkills(makeSnapshot(`Export the full early buyers table for ${contract}`, {
        requestedTokenAddresses: [contract],
    }), null);

    assert.ok(resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('default to full-list output')
        )
    );
});

test('explicit early-buyer row count queries are treated as full exports', () => {
    const contract = '0xeCCBb861c0dda7eFd964010085488B69317e4444';
    const resolution = resolveNodeSkills(makeSnapshot(`Check ${contract} early buyer for 30`, {
        requestedTokenAddresses: [contract],
    }), null);

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
    const zhResolution = resolveNodeSkills(makeSnapshot(`帮我找一下 Binance 官方 账户 关于 ${contract} 上架 Alpha 的 帖子 日期`, {
        model: 'grok-4-1-fast-non-reasoning',
        requestedTokenAddresses: [contract],
    }), null);
    const enResolution = resolveNodeSkills(makeSnapshot(`Find the date when Binance official handle posted the Alpha listing update for ${contract}`, {
        model: 'grok-4-1-fast-non-reasoning',
        requestedTokenAddresses: [contract],
    }), null);

    assert.equal(zhResolution.searchMode, 'required');
    assert.equal(enResolution.searchMode, 'required');
    assert.equal(zhResolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(enResolution.toolPhasePolicy.initialPhase, 'native_search_only');
});

test('resolver records that explicit query chain overrides connected chain', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Buy CAKE on BNB chain', {
        requestedTokenSymbols: ['CAKE', 'BNB'],
        runtime: {
            chainId: 8453,
            chainName: 'Base',
        },
    }), null);

    assert.ok(resolution.strategyNotes.some((note) => note.includes('requested BNB Chain')));
});

test('Farcaster discovery stays in local analysis phase', () => {
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on Farcaster today?"), null);
    assert.equal(resolution.intentEnvelope.domain, 'farcaster');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
    assert.ok(resolution.allowedTools.includes('get_trending_casts'));
});

test('Polymarket order intent requires verified token evidence before execution phase', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Place a YES order on Polymarket for BTC 100k'), null);
    assert.equal(resolution.intentEnvelope.primary_intent, 'polymarket_order');
    assert.equal(resolution.intentEnvelope.execution_risk, 'mutation');
    assert.ok(resolution.intentEnvelope.required_evidence.includes('verified_polymarket_token_id'));
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'local_analysis');
});

test('resolver only exposes tools that exist in the runtime toolDefinitions snapshot', () => {
    const snapshot = makeSnapshot('Search X for BTC sentiment, then analyze holders', {
        requestedTokenSymbols: ['BTC'],
        toolDefinitions: [
            {
                name: 'get_token_info',
                description: 'Token info',
                parameters: { type: 'object', properties: {} },
            },
        ] as any,
    });
    const resolution = resolveNodeSkills(snapshot, null);
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
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Session tool context is available')));
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
