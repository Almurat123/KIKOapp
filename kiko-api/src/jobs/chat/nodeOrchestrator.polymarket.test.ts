import assert from 'node:assert/strict';
import test from 'node:test';
import { toolRegistry } from '../../tooling/registry.js';
import type { ChatContextSnapshot } from './contracts.js';
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
    snapshot: makeSnapshot('Place a yes order on Polymarket'),
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
