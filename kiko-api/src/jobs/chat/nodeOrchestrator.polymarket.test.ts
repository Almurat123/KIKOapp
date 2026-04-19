import assert from 'node:assert/strict';
import test from 'node:test';
import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
import type { CanonicalIntent } from './canonicalIntent.js';
import {
  collectVerifiedPolymarketTokenIds,
  resolvePolymarketOrderGuardResult,
  runNodeOrchestration,
} from './nodeOrchestrator.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
  const { runtime: runtimeOverrides, ...restOverrides } = overrides;
  const runtime = {
    userSettings: {},
    toolContext: {},
    prefetchedToolResults: {},
    contextBlocks: {},
    systemDirectives: [],
    ...(runtimeOverrides || {}),
  };
  return {
    sessionId: 'session-poly',
    taskId: 'task-poly',
    assistantMessageId: 'msg-poly',
    model: 'grok-4-1-fast-non-reasoning',
    history: [],
    lastUserMessage: message,
    requestedTokenAddresses: [],
    requestedTokenSymbols: [],
    normalizedIntent: null,
    normalizationState: {
      status: 'invalid',
      source: 'llm',
      reasonCode: 'normalization_invalid_json',
    },
    toolDefinitions: toolRegistry.getAllDefinitions(),
    policySnapshot: null,
    runtime,
    ...restOverrides,
  } as ChatContextSnapshot;
}

function makeCanonicalIntent(overrides: Partial<CanonicalIntent>): CanonicalIntent {
  return {
    domain: 'polymarket',
    intent: 'polymarket_order',
    taskMode: 'execute',
    outputMode: 'execution_ready',
    searchMode: 'forbidden',
    searchTarget: 'none',
    confidence: 0.92,
    explanation: 'test canonical intent',
    entities: {
      tokenAddresses: [],
      tokenSymbols: ['BTC'],
      walletAddresses: [],
      marketIdentifiers: [],
    },
    requestedChain: null,
    timeContext: null,
    evidenceRequirements: ['verified_polymarket_token_id'],
    requiresRealtime: false,
    requiresOnchainEvidence: false,
    executionCandidate: true,
    rowCount: null,
    locale: 'en',
    needsClarification: false,
    clarificationQuestion: null,
    source: 'llm',
    ...overrides,
  };
}

test('collectVerifiedPolymarketTokenIds reads token ids from valid resolution tools', () => {
  const executedToolResults = new Map([
    ['get_polymarket_event:{"event_id":"1"}', {
      name: 'get_polymarket_event',
      arguments: { event_id: '1' },
      ok: true,
      result: {
        markets: [
          {
            id: 'market-1',
            outcomes: [{ name: 'Yes', token_id: 'token-yes' }],
          },
        ],
      },
      metadata: { source: 'tool_runtime' },
    }],
  ]);

  const tokenIds = collectVerifiedPolymarketTokenIds(executedToolResults as any, makeSnapshot('buy yes'));
  assert.deepEqual(Array.from(tokenIds), ['token-yes']);
});

test('collectVerifiedPolymarketTokenIds accepts token ids from 5-minute coin market tool', () => {
  const executedToolResults = new Map([
    ['get_polymarket_coin_updown_markets:{"coin":"Bitcoin"}', {
      name: 'get_polymarket_coin_updown_markets',
      arguments: { coin: 'Bitcoin' },
      ok: true,
      result: {
        primary_candidate: {
          market: {
            outcomes: [{ name: 'Up', token_id: 'btc-up-token' }],
          },
        },
        markets: [
          {
            market: {
              outcomes: [{ name: 'Up', token_id: 'btc-up-token' }, { name: 'Down', token_id: 'btc-down-token' }],
            },
          },
        ],
      },
      metadata: { source: 'tool_runtime' },
    }],
  ]);

  const tokenIds = collectVerifiedPolymarketTokenIds(executedToolResults as any, makeSnapshot('buy BTC up'));
  assert.deepEqual(Array.from(tokenIds).sort(), ['btc-down-token', 'btc-up-token']);
});

test('collectVerifiedPolymarketTokenIds accepts token ids from persisted polymarket selection state', () => {
  const tokenIds = collectVerifiedPolymarketTokenIds(
    new Map(),
    makeSnapshot('buy BTC up', {
      polymarketSelection: {
        sourceTool: 'get_polymarket_coin_updown_markets',
        capturedAt: '2026-03-26T05:00:00.000Z',
        candidates: [
          {
            title: 'Bitcoin Up or Down - March 27, 3:20AM-3:25AM ET',
            question: 'Bitcoin Up or Down - March 27, 3:20AM-3:25AM ET',
            marketId: '305999',
            marketSlug: 'btc-updown-5m-2',
            conditionId: 'condition-2',
            outcomes: [
              { name: 'Up', tokenId: 'real-up-token' },
              { name: 'Down', tokenId: 'real-down-token' },
            ],
          },
        ],
      } as any,
    }),
  );

  assert.deepEqual(Array.from(tokenIds).sort(), ['real-down-token', 'real-up-token']);
});

test('resolvePolymarketOrderGuardResult blocks unverified token ids', () => {
  const result = resolvePolymarketOrderGuardResult(
    {
      id: 'call-1',
      name: 'place_polymarket_order',
      arguments: {
        token_id: 'fake-token',
        price: 0.62,
        question: 'Will BTC hit 100k?',
        outcome: 'Yes',
      },
    },
    new Map(),
    makeSnapshot('buy yes on polymarket'),
  );

  assert.ok(result);
  assert.equal(result?.reasonCode, 'PRECHECK_REQUIRED');
  assert.match(String(result?.error || ''), /not verified/i);
});

test('runNodeOrchestration blocks place_polymarket_order until token_id is verified', async () => {
  const recordedResults: any[] = [];
  const pushedTexts: string[] = [];
  let content = '';
  let generationCalls = 0;
  let executeCalls = 0;

  const generationClient = {
    async generate(params: any) {
      if (String(params?.taskId || '').endsWith(':plan')) {
        return {
          text: '',
          reasoning: '',
          toolCalls: [],
        };
      }
      generationCalls += 1;
      if (generationCalls === 1) {
        return {
          text: '',
          reasoning: '',
          toolCalls: [
            {
              id: 'call-order',
              name: 'place_polymarket_order',
              arguments: {
                token_id: 'unverified-token',
                price: 0.62,
                amount_usd: 20,
                question: 'Will BTC hit 100k?',
                outcome: 'Yes',
              },
            },
          ],
        };
      }
      return {
        text: 'Need exact outcome token id before placing the order.',
        reasoning: '',
        toolCalls: [],
      };
    },
  };

  const broker = {
    beginRound() {},
    async bootstrapRuntime() {},
    async applyModelPlan() {},
    hasVisibleArtifact() { return false; },
    async markPlanPhase() {},
    async ensurePlanStep() {},
    async focusPlanStep() {},
    async noteToolSelected() {},
    async noteRuntimeUpdate() {},
    async markPlanStepStarted() {},
    async recordToolResult(result: any) { recordedResults.push(result); },
    async markAnswerStarted() {},
    async pushCommentary() {},
    pushUsage() {},
    pushCitation() {},
    recordProviderNativeResult() {},
    recordProviderNativeToolCall() {},
    completeProviderNativeToolCall() {},
    mergeAssistantData() {},
    createContentCheckpoint() { return content.length; },
    getContent() { return content; },
    async pushText(text: string) {
      pushedTexts.push(text);
      content += text;
    },
    async pushReasoning() {},
    async rewindContent() {},
    getCitations() { return []; },
    getProviderNativeResults() { return []; },
  };

  const toolExecutionEngine = {
    async execute() {
      executeCalls += 1;
      throw new Error('place_polymarket_order should have been blocked before execution');
    },
  };

  await runNodeOrchestration({
    snapshot: makeSnapshot('Place a yes order on Polymarket', {
      normalizedIntent: makeCanonicalIntent({}),
    }),
    generationClient: generationClient as any,
    toolExecutionEngine: toolExecutionEngine as any,
    broker: broker as any,
    toolContext: {},
  });

  assert.equal(executeCalls, 0);
  assert.equal(recordedResults.length, 1);
  assert.equal(recordedResults[0]?.reasonCode, 'PRECHECK_REQUIRED');
  assert.equal(recordedResults[0]?.metadata?.source, 'polymarket_token_guard');
  assert.deepEqual(pushedTexts, ['Need exact outcome token id before placing the order.']);
});

test('runNodeOrchestration emits execution receipt answer directly after side-effecting tool result', async () => {
  const recordedResults: any[] = [];
  const pushedTexts: string[] = [];
  let content = '';
  let generationCalls = 0;

  const generationClient = {
    async generate(params: any) {
      if (String(params?.taskId || '').endsWith(':plan')) {
        return {
          text: '',
          reasoning: '',
          toolCalls: [],
        };
      }
      generationCalls += 1;
      return {
        text: '',
        reasoning: '',
        toolCalls: [
          {
            id: 'call-swap',
            name: 'prepare_swap_transaction',
            arguments: {
              token_in: 'ETH',
              token_out: 'USDC',
              amount_in: '0.01',
              chain_id: 8453,
              execute: true,
            },
          },
        ],
      };
    },
  };

  const broker = {
    beginRound() {},
    async bootstrapRuntime() {},
    async applyModelPlan() {},
    hasVisibleArtifact() { return false; },
    async markPlanPhase() {},
    async ensurePlanStep() {},
    async focusPlanStep() {},
    async noteToolSelected() {},
    async noteRuntimeUpdate() {},
    async markPlanStepStarted() {},
    async recordToolResult(result: any) { recordedResults.push(result); },
    async markAnswerStarted() {},
    async setRuntimeState() {},
    async pushCommentary() {},
    pushUsage() {},
    pushCitation() {},
    recordProviderNativeResult() {},
    recordProviderNativeToolCall() {},
    completeProviderNativeToolCall() {},
    mergeAssistantData() {},
    createContentCheckpoint() { return content.length; },
    getContent() { return content; },
    async pushText(text: string) {
      pushedTexts.push(text);
      content += text;
    },
    async pushReasoning() {},
    async rewindContent() {},
    getCitations() { return []; },
    getProviderNativeResults() { return []; },
  };

  const toolExecutionEngine = {
    async execute(call: any) {
      return {
        id: call.id,
        name: call.name,
        arguments: call.arguments,
        ok: true,
        result: {
          txHash: '0xswap',
          explorerUrl: 'https://basescan.org/tx/0xswap',
        },
        metadata: { source: 'test' },
      };
    },
  };

  await runNodeOrchestration({
    snapshot: makeSnapshot('Swap 0.01 ETH to USDC', {
      normalizedIntent: makeCanonicalIntent({
        domain: 'swap',
        intent: 'swap',
        taskMode: 'execute',
        locale: 'en',
      } as any),
    }),
    generationClient: generationClient as any,
    toolExecutionEngine: toolExecutionEngine as any,
    broker: broker as any,
    toolContext: {},
  });

  assert.equal(generationCalls, 1);
  assert.equal(recordedResults.length, 1);
  assert.deepEqual(pushedTexts, [
    'Swap submitted.\nTransaction hash: 0xswap\nExplorer: https://basescan.org/tx/0xswap',
  ]);
});

test('runNodeOrchestration emits failed deploy receipt directly after side-effecting tool failure', async () => {
  const recordedResults: any[] = [];
  const pushedTexts: string[] = [];
  let content = '';
  let generationCalls = 0;

  const generationClient = {
    async generate(params: any) {
      if (String(params?.taskId || '').endsWith(':plan')) {
        return {
          text: '',
          reasoning: '',
          toolCalls: [],
        };
      }
      generationCalls += 1;
      return {
        text: '',
        reasoning: '',
        toolCalls: [
          {
            id: 'call-deploy',
            name: 'deploy_clanker_token',
            arguments: {
              name: 'LoopStop',
              symbol: 'LSP',
              confirmDeploy: true,
            },
          },
        ],
      };
    },
  };

  const broker = {
    beginRound() {},
    async bootstrapRuntime() {},
    async applyModelPlan() {},
    hasVisibleArtifact() { return false; },
    async markPlanPhase() {},
    async ensurePlanStep() {},
    async focusPlanStep() {},
    async noteToolSelected() {},
    async noteRuntimeUpdate() {},
    async markPlanStepStarted() {},
    async recordToolResult(result: any) { recordedResults.push(result); },
    async markAnswerStarted() {},
    async setRuntimeState() {},
    async pushCommentary() {},
    pushUsage() {},
    pushCitation() {},
    recordProviderNativeResult() {},
    recordProviderNativeToolCall() {},
    completeProviderNativeToolCall() {},
    mergeAssistantData() {},
    createContentCheckpoint() { return content.length; },
    getContent() { return content; },
    async pushText(text: string) {
      pushedTexts.push(text);
      content += text;
    },
    async pushReasoning() {},
    async rewindContent() {},
    getCitations() { return []; },
    getProviderNativeResults() { return []; },
  };

  const toolExecutionEngine = {
    async execute(call: any) {
      return {
        id: call.id,
        name: call.name,
        arguments: call.arguments,
        ok: false,
        error: 'wallet signature rejected',
        reasonCode: 'USER_REJECTED',
        result: {
          tokenAddress: '0xabc',
          tokenUrl: 'https://clanker.world/clanker/0xabc',
        },
        metadata: { source: 'test' },
        continuation: {
          next_action: 'handle_tool_failure',
          can_answer_now: true,
          reason: 'The tool did not complete successfully.',
        },
      };
    },
  };

  await runNodeOrchestration({
    snapshot: makeSnapshot('Deploy a token', {
      normalizedIntent: makeCanonicalIntent({
        domain: 'token',
        intent: 'token_deploy',
        taskMode: 'execute',
        locale: 'en',
      } as any),
    }),
    generationClient: generationClient as any,
    toolExecutionEngine: toolExecutionEngine as any,
    broker: broker as any,
    toolContext: {},
  });

  assert.equal(generationCalls, 1);
  assert.equal(recordedResults.length, 1);
  assert.deepEqual(pushedTexts, [
    'Clanker token deployment failed.\nError: wallet signature rejected\nReason code: USER_REJECTED\nToken address: 0xabc\nClanker page: https://clanker.world/clanker/0xabc',
  ]);
});
