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
    assert.ok(resolution.allowedTools.includes('get_polymarket_trending'));
    assert.equal(resolution.searchMode, 'fallback');
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
    assert.equal(resolution.allowAllTools, false);
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
    assert.equal(providerOptions.tool_policy?.native_tools.required, true);
    assert.equal(providerOptions.tool_policy?.native_tools.preferred_required_tool, 'x_search');
});

test('X trending queries do not expose Farcaster trending tools unless Farcaster is explicit', () => {
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?"), null);
    assert.equal(resolution.allowedTools.includes('get_trending_casts'), false);
    assert.equal(resolution.allowedTools.includes('search_farcaster_casts'), false);
    assert.equal(resolution.intentEnvelope.domain, 'x');
    assert.equal(resolution.toolPhasePolicy.initialPhase, 'native_search_only');
    assert.equal(resolution.toolPhasePolicy.nextPhaseAfterNativeSearch, null);
    assert.ok(resolution.strategyNotes.some((note) => note.includes('X/Twitter')));
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
