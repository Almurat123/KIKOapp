import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { resolveProviderInfo, buildProviderOptions } from './providerPolicyBuilder.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { toolRegistry } from '../../tooling/registry.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import { skillRegistryExec } from '../../skills/registry.js';

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

test('routes Clanker deploy queries to the dedicated Clanker skill first', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'clanker_deploy',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        executionCandidate: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot('Deploy a token via Clanker', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'clanker_deploy_token');
    assert.ok(resolution.allowedTools.includes('deploy_clanker_token'));
    assert.ok(resolution.preferredTools.includes('deploy_clanker_token'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Clanker launch')));
    assert.equal(resolution.intentEnvelope.primary_intent, 'token_deploy');
    assert.equal(resolution.intentEnvelope.execution_risk, 'mutation');
});

test('canonical Clanker deploy intent routes to token deploy mutation envelope', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'clanker_deploy',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        requestedChain: {
            chainId: 8453,
            chainName: 'Base',
            source: 'llm',
        },
        executionCandidate: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot('Deploy a token on Base named testbymybot symbol TBB', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);

    assert.equal(resolution.selectedSkills[0], 'clanker_deploy_token');
    assert.ok(resolution.allowedTools.includes('deploy_clanker_token'));
    assert.equal(resolution.intentEnvelope.primary_intent, 'token_deploy');
    assert.equal(resolution.intentEnvelope.task_mode, 'execute');
    assert.equal(resolution.intentEnvelope.domain, 'token');
    assert.equal(resolution.intentEnvelope.execution_risk, 'mutation');
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
    assert.equal(resolution.allowAllTools, false);
    assert.equal(resolution.searchMode, 'forbidden');
});

test('routes image-generation requests to the generated-image skill and tool', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'image_generation',
        taskMode: 'discover',
    });
    const resolution = resolveNodeSkills(makeSnapshot('帮我做一张赛博朋克风的产品海报', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'image_generation');
    assert.ok(resolution.selectedSkills.includes('image_prompting'));
    assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('generate_image_from_intent')));
});

test('routes concrete English picture requests to the generated-image skill and tool', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'image_generation',
        taskMode: 'discover',
    });
    const resolution = resolveNodeSkills(makeSnapshot('How to generate a picture of the beautiful view of the moon?', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'image_generation');
    assert.ok(resolution.selectedSkills.includes('image_prompting'));
    assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
});

test('routes multiline visual briefs with uppercase subject names to the generated-image skill and tool', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'image_generation',
        taskMode: 'discover',
        entities: {
            tokenAddresses: [],
            tokenSymbols: ['ICELAND'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
    });
    const resolution = resolveNodeSkills(makeSnapshot('Generate something for ICELAND\ncampaign poster with cinematic aurora lighting and premium product framing', {
        requestedTokenSymbols: ['ICELAND'],
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.selectedSkills[0], 'image_generation');
    assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
});

test('routes reference-image edit phrasing to the generated-image skill when current-turn image context exists', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'image_generation',
        taskMode: 'discover',
    });
    const resolution = resolveNodeSkills(makeSnapshot('Put KIKO on the horse and restyle it to feel cinematic and premium.', {
        normalizedIntent: canonicalIntent,
        runtime: {
            socialInput: {
                text: 'Current @almurat cast',
                images: [{ url: 'https://example.com/horse.png', sourceLabel: 'horse' }],
            },
            currentPage: 'farcaster',
            pageContext: 'farcaster_agent',
            toolContext: {
                generatedImagePreference: {
                    model: 'gpt-image-1-mini',
                },
            },
        },
    }), null, canonicalIntent);
    assert.ok(resolution.selectedSkills.includes('image_generation'));
    assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Reference-image, edit, restyle')));
});

test('model-selected image turns expose only the matched image tool package', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'image_generation',
        taskMode: 'discover',
    });
    const snapshot = makeSnapshot('帮我做一张赛博朋克风的产品海报', {
        normalizedIntent: canonicalIntent,
    });
    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);

    assert.equal(resolution.allowAllTools, false);
    assert.ok(resolution.selectedSkills.includes('image_generation'));
    assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
    assert.ok(resolution.allowedTools.includes('read_skill_prompts'));
    assert.ok(!resolution.allowedTools.includes('prepare_swap_transaction'));
    assert.ok(!resolution.allowedTools.includes('place_polymarket_order'));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('matched business tools plus explicit context-read tools')));
});

test('model-selected image turns keep the image tool visible if the skill prompt package is unavailable', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'image_generation',
        taskMode: 'discover',
    });
    const originalGetSkill = skillRegistryExec.getSkill;
    (skillRegistryExec as any).getSkill = (id: string) => {
        if (id === 'image_generation' || id === 'image_prompting') {
            return undefined;
        }
        return originalGetSkill.call(skillRegistryExec, id);
    };

    try {
        const resolution = resolveNodeSkills(makeSnapshot('Generate a square poster for Kiko', {
            normalizedIntent: canonicalIntent,
        }), null, canonicalIntent);

        assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
        assert.ok(resolution.preferredTools.includes('generate_image_from_intent'));
        assert.ok(resolution.strategyNotes.some((note) => note.includes('same model selected image_generation')));
    } finally {
        (skillRegistryExec as any).getSkill = originalGetSkill;
    }
});

test('does not select the image-generation skill for prompt-writing advice', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'general',
        intent: 'image_prompting',
        taskMode: 'discover',
    });
    const resolution = resolveNodeSkills(makeSnapshot('告诉我怎么写一个图片提示词', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    assert.equal(resolution.allowAllTools, false);
    assert.ok(resolution.selectedSkills.includes('image_prompting'));
    assert.ok(!resolution.selectedSkills.includes('image_generation'));
    assert.ok(!resolution.allowedTools.includes('prepare_swap_transaction'));
});

test('routes malformed Kiko capability questions to welcome skill when canonical assistant_meta is selected', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'assistant_meta',
        intent: 'assistant_meta',
        taskMode: 'discover',
        inheritEntitiesFromContext: false,
    });
    const resolution = resolveNodeSkills(makeSnapshot('What can you doing Kiko?', {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
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
    assert.equal(resolution.allowAllTools, false);
    assert.ok(resolution.allowedTools.includes('read_workflow_state'));
    assert.ok(resolution.allowedTools.includes('read_user_context'));
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
    assert.equal(resolution.allowAllTools, false);
    assert.ok(!resolution.allowedTools.includes('deploy_clanker_token'));
});

type ProfessionalToolRoutingCase = {
    name: string;
    message: string;
    canonicalIntent: CanonicalIntent;
    expectedSkills: string[];
    expectedAllowedTools: string[];
    expectedPreferredTools?: string[];
    forbiddenAllowedTools?: string[];
    tradingIntent?: any;
    snapshotOverrides?: Partial<ChatContextSnapshot>;
};

const OPENAI_MODEL_IDS = [
    'gpt-5.4-mini-2026-03-17',
];

const PROFESSIONAL_TOOL_ROUTING_CASES: ProfessionalToolRoutingCase[] = [
    {
        name: 'image generation',
        message: 'Generate a square launch poster for KIKO.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'general',
            intent: 'image_generation',
        }),
        expectedSkills: ['image_generation', 'image_prompting'],
        expectedAllowedTools: ['generate_image_from_intent', 'read_skill_prompts'],
        expectedPreferredTools: ['generate_image_from_intent', 'read_skill_prompts'],
    },
    {
        name: 'image prompt coaching',
        message: 'Improve this product-image prompt before generation.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'general',
            intent: 'image_prompting',
        }),
        expectedSkills: ['image_prompting'],
        expectedAllowedTools: ['read_skill_prompts'],
        expectedPreferredTools: ['read_skill_prompts'],
        forbiddenAllowedTools: ['generate_image_from_intent'],
    },
    {
        name: 'token analysis',
        message: 'Analyze PEPE token fundamentals and current market data.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'token_analysis',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['PEPE'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
        }),
        expectedSkills: ['token_analysis'],
        expectedAllowedTools: ['get_token_info', 'get_trending_tokens', 'read_skill_prompts'],
        expectedPreferredTools: ['get_token_info'],
        snapshotOverrides: {
            requestedTokenSymbols: ['PEPE'],
        },
    },
    {
        name: 'early buyers',
        message: 'Show the first 30 early buyers for this token.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'early_buyers',
            outputMode: 'full_table',
            entities: {
                tokenAddresses: ['0xeccbb861c0dda7efd964010085488b69317e4444'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['onchain_token_evidence'],
            requiresOnchainEvidence: true,
            rowCount: 30,
        }),
        expectedSkills: ['token_analysis'],
        expectedAllowedTools: ['get_early_buyers', 'get_token_info', 'read_skill_prompts'],
        expectedPreferredTools: ['get_early_buyers', 'get_token_info'],
        forbiddenAllowedTools: ['analyze_wallet_pnl_batch'],
        snapshotOverrides: {
            requestedTokenAddresses: ['0xeccbb861c0dda7efd964010085488b69317e4444'],
        },
    },
    {
        name: 'creator analysis',
        message: 'Analyze whether this token creator has a clean history.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'creator_analysis',
            entities: {
                tokenAddresses: ['0x1111111111111111111111111111111111111111'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
        }),
        expectedSkills: ['token_analysis'],
        expectedAllowedTools: ['analyze_creator', 'get_token_info', 'read_skill_prompts'],
        expectedPreferredTools: ['analyze_creator', 'get_token_info'],
        snapshotOverrides: {
            requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        },
    },
    {
        name: 'token risk',
        message: 'Check whether this token contract is risky or a honeypot.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'token_risk',
            entities: {
                tokenAddresses: ['0x2222222222222222222222222222222222222222'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['onchain_token_evidence'],
            requiresOnchainEvidence: true,
        }),
        expectedSkills: ['risk_security', 'token_analysis'],
        expectedAllowedTools: ['check_token_risk', 'get_token_info', 'read_skill_prompts'],
        expectedPreferredTools: ['get_token_info'],
        snapshotOverrides: {
            requestedTokenAddresses: ['0x2222222222222222222222222222222222222222'],
        },
    },
    {
        name: 'wallet analysis',
        message: 'Show my wallet balances and portfolio state.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'wallet',
            intent: 'wallet_analysis',
            evidenceRequirements: ['onchain_wallet_evidence'],
            requiresOnchainEvidence: true,
        }),
        expectedSkills: ['wallet_portfolio'],
        expectedAllowedTools: ['get_wallet_info', 'analyze_wallet_pnl', 'read_skill_prompts'],
        expectedPreferredTools: ['read_wallet_state'],
        snapshotOverrides: {
            runtime: {
                walletAddress: '0x3333333333333333333333333333333333333333',
            },
        },
    },
    {
        name: 'wallet pnl',
        message: 'Compare 30d PnL for these wallets.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'wallet',
            intent: 'wallet_pnl',
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: ['0x4444444444444444444444444444444444444444'],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['onchain_wallet_evidence'],
            requiresOnchainEvidence: true,
        }),
        expectedSkills: ['wallet_portfolio'],
        expectedAllowedTools: ['analyze_wallet_pnl_batch', 'analyze_wallet_pnl', 'read_skill_prompts'],
        expectedPreferredTools: ['analyze_wallet_pnl_batch', 'read_wallet_state'],
    },
    {
        name: 'swap execution',
        message: 'Swap 0.1 ETH to USDC on Base.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'swap',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['ETH', 'USDC'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            executionCandidate: true,
        }),
        expectedSkills: ['swap', 'wallet_portfolio'],
        expectedAllowedTools: ['prepare_swap_transaction', 'simulate_swap', 'get_wallet_info', 'read_user_settings'],
        expectedPreferredTools: ['get_wallet_info', 'simulate_swap', 'prepare_swap_transaction'],
        tradingIntent: {
            kind: 'trading',
            type: 'swap',
        },
        snapshotOverrides: {
            runtime: {
                walletAddress: '0x5555555555555555555555555555555555555555',
                chainId: 8453,
                chainName: 'Base',
            },
        },
    },
    {
        name: 'cross-chain swap',
        message: 'Bridge 100 USDC from Base to Solana.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'cross_chain_swap',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            executionCandidate: true,
        }),
        expectedSkills: ['cross_chain_swap', 'wallet_portfolio'],
        expectedAllowedTools: ['get_cross_chain_quote', 'prepare_cross_chain_tx', 'get_wallet_info', 'read_user_settings'],
        expectedPreferredTools: ['get_cross_chain_quote', 'prepare_cross_chain_tx'],
        tradingIntent: {
            kind: 'trading',
            type: 'cross_chain_trade',
        },
    },
    {
        name: 'copy trade',
        message: 'Copy trade this wallet after checking its PnL.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'wallet',
            intent: 'copy_trade',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: ['0x6666666666666666666666666666666666666666'],
                marketIdentifiers: [],
            },
            executionCandidate: true,
        }),
        expectedSkills: ['copy_trade', 'wallet_portfolio'],
        expectedAllowedTools: ['create_copy_trade_config', 'list_copy_trade_configs', 'analyze_wallet_pnl', 'read_user_settings'],
        expectedPreferredTools: ['create_copy_trade_config'],
        tradingIntent: {
            kind: 'trading',
            type: 'copy_trade',
        },
    },
    {
        name: 'Clanker deploy',
        message: 'Deploy a Clanker token on Base named Kiko Test.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'clanker_deploy',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
            executionCandidate: true,
        }),
        expectedSkills: ['clanker_deploy_token'],
        expectedAllowedTools: ['deploy_clanker_token', 'get_clanker_tokens_by_admin', 'read_user_settings'],
        expectedPreferredTools: ['deploy_clanker_token'],
    },
    {
        name: 'Polymarket discovery',
        message: 'What are the best active Polymarket opportunities right now?',
        canonicalIntent: makeCanonicalIntent({
            domain: 'polymarket',
            intent: 'polymarket_discovery',
            requiresRealtime: true,
        }),
        expectedSkills: ['polymarket_prediction'],
        expectedAllowedTools: ['get_polymarket_market_overview', 'get_polymarket_trending', 'search_polymarket', 'read_skill_prompts'],
        expectedPreferredTools: ['get_polymarket_market_overview'],
    },
    {
        name: 'Polymarket short-window',
        message: 'Give me the 5-minute SOL Up or Down market.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'polymarket',
            intent: 'polymarket_short_window',
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['SOL'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requiresRealtime: true,
        }),
        expectedSkills: ['polymarket_prediction'],
        expectedAllowedTools: ['get_polymarket_coin_updown_markets', 'get_polymarket_market_overview', 'read_skill_prompts'],
        expectedPreferredTools: ['get_polymarket_coin_updown_markets'],
        snapshotOverrides: {
            requestedTokenSymbols: ['SOL'],
        },
    },
    {
        name: 'Polymarket order',
        message: 'Place $1 on Down for this Polymarket BTC short-window market.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'polymarket',
            intent: 'polymarket_order',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            evidenceRequirements: ['verified_polymarket_token_id'],
            executionCandidate: true,
        }),
        expectedSkills: ['polymarket_prediction'],
        expectedAllowedTools: ['prepare_polymarket_bet', 'check_polymarket_readiness', 'place_polymarket_order', 'read_user_settings'],
        expectedPreferredTools: ['prepare_polymarket_bet'],
    },
    {
        name: 'Zora discovery',
        message: 'Show trending Zora mints right now.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'zora',
            intent: 'zora_discovery',
            requiresRealtime: true,
        }),
        expectedSkills: ['zora_nfts'],
        expectedAllowedTools: ['get_zora_trending', 'get_zora_profile', 'read_skill_prompts'],
        expectedPreferredTools: ['get_zora_trending'],
    },
    {
        name: 'token alerts',
        message: 'Notify me when KIKO reaches a 1M market cap.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'token_alerts',
            taskMode: 'execute',
            outputMode: 'execution_ready',
            executionCandidate: true,
        }),
        expectedSkills: ['token_alert'],
        expectedAllowedTools: ['set_token_alert', 'list_token_alerts', 'remove_token_alert', 'read_user_settings'],
        expectedPreferredTools: ['set_token_alert'],
    },
    {
        name: 'market macro',
        message: 'Give me the current crypto market overview and gas setup.',
        canonicalIntent: makeCanonicalIntent({
            domain: 'market',
            intent: 'market_macro',
            searchMode: 'fallback',
            searchTarget: 'web',
            requiresRealtime: true,
        }),
        expectedSkills: ['market_macro'],
        expectedAllowedTools: ['get_market_overview', 'get_gas_price', 'get_economic_calendar', 'read_skill_prompts'],
        expectedPreferredTools: ['get_market_overview'],
    },
    {
        name: 'Farcaster social discovery',
        message: 'What is trending on Farcaster today?',
        canonicalIntent: makeCanonicalIntent({
            domain: 'farcaster',
            intent: 'social_discovery',
            searchMode: 'required',
            searchTarget: 'none',
            requiresRealtime: true,
        }),
        expectedSkills: ['social_farcaster'],
        expectedAllowedTools: ['get_trending_casts', 'search_farcaster_casts', 'get_farcaster_user', 'read_workflow_state'],
        expectedPreferredTools: ['read_workflow_state'],
    },
];

test('OpenAI models expose matching tools after model-selected professional intents', () => {
    for (const model of OPENAI_MODEL_IDS) {
        assert.equal(resolveProviderInfo(model).provider, 'openai');

        for (const item of PROFESSIONAL_TOOL_ROUTING_CASES) {
            const resolution = resolveNodeSkills(makeSnapshot(item.message, {
                model,
                normalizedIntent: item.canonicalIntent,
                ...item.snapshotOverrides,
            }), item.tradingIntent || null, item.canonicalIntent);

            for (const skillId of item.expectedSkills) {
                assert.ok(
                    resolution.selectedSkills.includes(skillId),
                    `${model} / ${item.name}: missing selected skill ${skillId}; got ${resolution.selectedSkills.join(', ')}`,
                );
            }
            for (const toolName of item.expectedAllowedTools) {
                assert.ok(
                    resolution.allowedTools.includes(toolName),
                    `${model} / ${item.name}: missing allowed tool ${toolName}; got ${resolution.allowedTools.join(', ')}`,
                );
            }
            for (const toolName of item.expectedPreferredTools || []) {
                assert.ok(
                    resolution.preferredTools.includes(toolName),
                    `${model} / ${item.name}: missing preferred tool ${toolName}; got ${resolution.preferredTools.join(', ')}`,
                );
            }
            for (const toolName of item.forbiddenAllowedTools || []) {
                assert.ok(
                    !resolution.allowedTools.includes(toolName),
                    `${model} / ${item.name}: forbidden tool ${toolName} was exposed; got ${resolution.allowedTools.join(', ')}`,
                );
            }
            assert.equal(
                resolution.allowAllTools,
                false,
                `${model} / ${item.name}: should stay package-scoped instead of exposing all tools`,
            );
            assert.equal(
                resolution.toolPackageSource,
                'canonical_intent',
                `${model} / ${item.name}: expected model-selected canonical intent as tool package source`,
            );
        }
    }
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

test('X trending queries keep X-first intent while exposing only social-analysis tools', () => {
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
    assert.equal(resolution.allowAllTools, false);
    assert.ok(resolution.allowedTools.includes('read_workflow_state'));
    assert.ok(resolution.allowedTools.includes('read_user_context'));
    assert.ok(!resolution.allowedTools.includes('deploy_clanker_token'));
});

test('DeepSeek X trending queries stay out of native-search-only while exposing only social-analysis tools', () => {
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
    assert.equal(resolution.allowAllTools, false);
    assert.ok(resolution.allowedTools.includes('read_workflow_state'));
    assert.ok(resolution.allowedTools.includes('read_user_context'));
    assert.ok(resolution.searchMode === 'required');
    assert.ok(resolution.strategyNotes.some((note) => note.includes('native X search')));
    assert.ok(!resolution.allowedTools.includes('deploy_clanker_token'));
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
    assert.equal(resolution.allowAllTools, false);

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

test('provider policy prefers task route over stale canonical onchain evidence', () => {
    const providerOptions = buildProviderOptions(
        makeSnapshot('Summarize the current social thread', {
            taskRoute: {
                owner: 'social',
                phase: 'analyze',
                facets: ['social_thread'],
                entities: {
                    tokenAddresses: [],
                    tokenSymbols: [],
                    walletAddresses: [],
                    marketIdentifiers: [],
                    imageRefs: [],
                },
                requestedChain: null,
                timeContext: null,
                rowCount: null,
                inheritEntitiesFromContext: false,
                locale: 'en',
                needsClarification: false,
                clarificationQuestion: null,
                explanation: 'Review the current social conversation.',
                confidence: 0.9,
                source: 'llm',
            } as any,
            normalizedIntent: makeCanonicalIntent({
                domain: 'token',
                intent: 'token_analysis',
                evidenceRequirements: ['onchain_token_evidence'],
                requiresOnchainEvidence: true,
            }),
            policySnapshot: {
                actionClass: 'READ_ONLY',
                mutationAllowed: false,
                enforcementLevel: 'hard',
            } as any,
        }),
        resolveProviderInfo('grok-4.1-fast'),
        'Summarize the current social thread',
        {
            searchMode: 'forbidden',
            intentEnvelope: {
                primary_intent: 'social_discovery',
                task_mode: 'analyze',
                search_mode: 'forbidden',
                search_target: 'none',
                domain: 'x',
                execution_risk: 'read_only',
                required_evidence: [],
            },
        } as any,
    );

    assert.equal(providerOptions.enable_search, false);
    assert.equal(providerOptions.tool_policy?.native_tools.reason, 'search_disabled');
});

test('task route beats stale canonical intent for long image-execution prompts', () => {
    const resolution = resolveNodeSkills(makeSnapshot(`Use the attached Farcaster reference image as the composition base.
Keep the face and product silhouette, replace the background with a clean cinematic sunrise gradient,
add a subtle Base ecosystem visual language, and output a finished launch poster instead of just rewriting the prompt.`, {
        taskRoute: {
            owner: 'image',
            phase: 'execute',
            facets: ['reference_image', 'social_images'],
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: ['https://example.com/ref.png'],
            },
            requestedChain: {
                chainId: 8453,
                chainName: 'Base',
                source: 'llm',
            },
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: true,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Long reference-image execution brief.',
            confidence: 0.98,
            source: 'llm',
        } as any,
        normalizedIntent: makeCanonicalIntent({
            domain: 'x',
            intent: 'social_discovery',
            searchMode: 'required',
            searchTarget: 'x',
            requiresRealtime: true,
        }),
        runtime: {
            socialInput: {
                platform: 'farcaster',
                images: [{ url: 'https://example.com/ref.png' }],
            },
        },
    }), null);

    assert.equal(resolution.selectedSkills[0], 'image_generation');
    assert.ok(resolution.selectedSkills.includes('image_prompting'));
    assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
    assert.equal(resolution.searchMode, 'forbidden');
    assert.equal(resolution.intentEnvelope.primary_intent, 'image_generation');
    assert.equal(resolution.intentEnvelope.search_mode, 'forbidden');
    assert.equal(resolution.intentEnvelope.domain, 'general');
    assert.equal(resolution.intentEnvelope.execution_risk, 'read_only');
    assert.equal(resolution.contextContract.mode, 'image');
    assert.ok(resolution.contextContract.requiredContexts.includes('workflow_state'));
    assert.ok(resolution.contextContract.requiredContexts.includes('skill_prompts'));
    assert.ok(resolution.contextContract.requiredContexts.includes('user_context'));
    assert.ok(!resolution.contextContract.requiredContexts.includes('execution_plan'));
    assert.ok(!resolution.contextContract.requiredContexts.includes('user_settings'));
    assert.equal(resolution.toolPackageSource, 'task_route');
});

test('task route image owner suppresses stale canonical early-buyer tool bias', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Use the attached reference image to generate a launch poster right now.', {
        taskRoute: {
            owner: 'image',
            phase: 'execute',
            facets: ['reference_image', 'social_images'],
            entities: {
                tokenAddresses: [],
                tokenSymbols: ['KIKO'],
                walletAddresses: [],
                marketIdentifiers: [],
                imageRefs: ['https://example.com/reference.png'],
            },
            requestedChain: null,
            timeContext: null,
            rowCount: null,
            inheritEntitiesFromContext: true,
            locale: 'en',
            needsClarification: false,
            clarificationQuestion: null,
            explanation: 'Generate the image now.',
            confidence: 0.97,
            source: 'llm',
        } as any,
        normalizedIntent: makeCanonicalIntent({
            domain: 'token',
            intent: 'early_buyers',
            outputMode: 'full_table',
            entities: {
                tokenAddresses: ['0x1111111111111111111111111111111111111111'],
                tokenSymbols: ['KIKO'],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            evidenceRequirements: ['onchain_token_evidence'],
            requiresOnchainEvidence: true,
        }),
        runtime: {
            socialInput: {
                platform: 'farcaster',
                images: [{ url: 'https://example.com/reference.png' }],
            },
        },
    }), null);

    assert.equal(resolution.selectedSkills[0], 'image_generation');
    assert.ok(!resolution.preferredTools.includes('get_early_buyers'));
    assert.ok(!resolution.preferredTools.includes('analyze_creator'));
    assert.ok(!resolution.strategyNotes.some((note) => note.includes('Early-buyer queries default to full-list output')));
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
    assert.equal(resolution.allowAllTools, false);
    assert.ok(resolution.preferredTools.includes('get_wallet_info'));
    assert.ok(resolution.allowedTools.includes('read_workflow_state'));
    assert.ok(resolution.allowedTools.includes('read_user_context'));
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
    assert.equal(resolution.searchReason, 'canonical_intent');
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
    const canonicalIntent = makeCanonicalIntent({
        domain: 'token',
        intent: 'swap',
        taskMode: 'execute',
        outputMode: 'execution_ready',
        entities: {
            tokenAddresses: [contract],
            tokenSymbols: ['ETH'],
            walletAddresses: [],
            marketIdentifiers: [],
        },
        executionCandidate: true,
    });
    const resolution = resolveNodeSkills(makeSnapshot(`Sell all ${contract} to ETH`, {
        model: 'gpt-5-mini',
        requestedTokenAddresses: [contract],
        normalizedIntent: canonicalIntent,
        runtime: {
            chainId: 8453,
            chainName: 'Base',
            walletAddress: '0xA386bc9D8F26AB170A847D73226e3e0BCEb0fe8E',
        },
    }), {
        kind: 'trading',
        type: 'swap',
    } as any, canonicalIntent);

    assert.ok(resolution.preferredTools.includes('get_wallet_info'));
    assert.ok(resolution.preferredTools.includes('simulate_swap'));
    assert.ok(resolution.preferredTools.includes('prepare_swap_transaction'));
    assert.equal(resolution.contextContract.mode, 'execution');
    assert.ok(resolution.contextContract.requiredContexts.includes('user_settings'));
    assert.ok(resolution.contextContract.requiredContexts.includes('wallet_state'));
    assert.ok(resolution.contextContract.requiredContexts.includes('token_context'));
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('preflight evidence first') || note.includes('Quote-before-swap mode is enabled')
        )
    );
    assert.ok(
        resolution.strategyNotes.some((note) =>
            note.includes('fixed business template') && note.includes('one quote or one execution path')
        )
    );
    assert.equal(resolution.allowAllTools, false);
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
    assert.equal(resolution.allowAllTools, false);
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

test('resolver keeps session-used tools as evidence hints without reopening tool exposure on plain turns', () => {
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
    assert.deepEqual(resolution.allowedTools, []);
    assert.deepEqual(resolution.preferredTools, []);
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Recent tool evidence is available from this session')));
});

test('plain capability questions route to onboarding without exposing unrelated tools once canonical assistant_meta is selected', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'assistant_meta',
        intent: 'assistant_meta',
        taskMode: 'discover',
        inheritEntitiesFromContext: false,
    });
    const snapshot = makeSnapshot('What can you do?', {
        normalizedIntent: canonicalIntent,
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

    const resolution = resolveNodeSkills(snapshot, null, canonicalIntent);
    assert.deepEqual(resolution.selectedSkills, ['welcome_onboarding']);
    assert.equal(resolution.allowAllTools, false);
    assert.deepEqual(resolution.allowedTools, []);
});

test('generic direct answers do not fall back to a market skill', () => {
    const resolution = resolveNodeSkills(makeSnapshot('Explain quantum entanglement.'), null);
    assert.deepEqual(resolution.selectedSkills, []);
    assert.equal(resolution.allowAllTools, false);
    assert.deepEqual(resolution.allowedTools, []);
    assert.equal(resolution.intentEnvelope.primary_intent, 'general_answer');
    assert.equal(resolution.contextContract.mode, 'lean');
    assert.deepEqual(resolution.contextContract.requiredContexts, []);
});

test('model-led unresolved social turns keep social context instead of lean fallback', () => {
    const resolution = resolveNodeSkills(makeSnapshot('What is happening in these images?', {
        runtime: {
            socialInput: {
                text: 'Current @almurat cast',
                images: [
                    { url: 'https://example.com/1.png', sourceLabel: 'image 1' },
                    { url: 'https://example.com/2.png', sourceLabel: 'image 2' },
                ],
            },
            currentPage: 'farcaster',
            pageContext: 'farcaster_agent',
        },
    }), null);

    assert.equal(resolution.intentEnvelope.primary_intent, 'general_answer');
    assert.equal(resolution.contextContract.mode, 'social');
    assert.ok(resolution.contextContract.requiredContexts.includes('workflow_state'));
    assert.ok(resolution.contextContract.optionalContexts.includes('social_thread_context'));
    assert.ok(resolution.contextContract.optionalContexts.includes('social_images'));
});

test('phase strategy notes frame resolver output as backend safety, not selected intent', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'x',
        intent: 'social_discovery',
        searchMode: 'required',
        searchTarget: 'x',
        requiresRealtime: true,
        evidenceRequirements: ['native_search_results'],
    });
    const resolution = resolveNodeSkills(makeSnapshot("What's trending on X today?", {
        normalizedIntent: canonicalIntent,
    }), null, canonicalIntent);
    const strategyText = resolution.strategyNotes.join('\n');
    assert.match(strategyText, /Current tool package starts in provider-native search only/);
    assert.doesNotMatch(strategyText, /Structured intent:/);
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
    const canonicalIntent = makeCanonicalIntent({
        domain: 'wallet',
        intent: 'wallet_pnl',
        taskMode: 'analyze',
        inheritEntitiesFromContext: true,
        entities: {
            tokenAddresses: ['0x1111111111111111111111111111111111111111'],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
    });
    const resolution = resolveNodeSkills(makeSnapshot('Show each early buyer buy and sell summary for this token', {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        normalizedIntent: canonicalIntent,
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
    assert.ok(resolution.strategyNotes.some((note) => note.includes('buy USD, sell USD, realized PnL, and profit percent')));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Do not answer profit ranking or per-wallet token trade summaries from the early-buyer rows alone')));
});

test('Chinese early-buyer follow-up about token profit stays on token batch PnL path', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'wallet',
        intent: 'wallet_pnl',
        taskMode: 'analyze',
        inheritEntitiesFromContext: true,
        entities: {
            tokenAddresses: ['0x1111111111111111111111111111111111111111'],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
    });
    const resolution = resolveNodeSkills(makeSnapshot('这些钱包在这个代币上的利润是怎么样的？', {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        normalizedIntent: canonicalIntent,
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
    assert.ok(resolution.strategyNotes.some((note) => note.includes('reuse those wallet addresses as the candidate set for batch wallet PnL analysis')));
    assert.ok(resolution.strategyNotes.some((note) => note.includes('Pass the same token_address into analyze_wallet_pnl_batch')));
});

test('Chinese early-buyer follow-up using 利益 stays on token batch PnL path', () => {
    const canonicalIntent = makeCanonicalIntent({
        domain: 'wallet',
        intent: 'wallet_pnl',
        taskMode: 'analyze',
        inheritEntitiesFromContext: true,
        entities: {
            tokenAddresses: ['0x1111111111111111111111111111111111111111'],
            tokenSymbols: [],
            walletAddresses: [],
            marketIdentifiers: [],
        },
    });
    const resolution = resolveNodeSkills(makeSnapshot('它们在这个代币上的利益是多少？', {
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        normalizedIntent: canonicalIntent,
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
    assert.ok(resolution.strategyNotes.some((note) => note.includes('reuse those wallet addresses as the candidate set for batch wallet PnL analysis')));
});

test('misnormalized early-buyer follow-up does not override the model-selected early_buyer intent', () => {
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

    assert.ok(!resolution.selectedSkills.includes('wallet_portfolio'));
    assert.ok(!resolution.allowedTools.includes('analyze_wallet_pnl_batch'));
    assert.ok(resolution.selectedSkills.includes('token_analysis'));
});
