import assert from 'node:assert/strict';
import test from 'node:test';

import { ChatAiTraceLogger } from './chatAiTraceLogger.js';
import type { ChatContextSnapshot, OrchestratorToolResult } from './contracts.js';

function makeSnapshot(): ChatContextSnapshot {
    return {
        sessionId: 'session-trace',
        taskId: 'task-trace',
        assistantMessageId: 'assistant-trace',
        model: 'gpt-5.4-mini',
        history: [{ role: 'user', content: 'previous' }],
        lastUserMessage: 'Swap 0.1 ETH to USDC for 0x1111111111111111111111111111111111111111',
        requestedTokenAddresses: [],
        requestedTokenSymbols: ['ETH', 'USDC'],
        toolDefinitions: [],
        runtime: {
            userSettings: {},
            contextBlocks: {},
        },
    } as ChatContextSnapshot;
}

test('ChatAiTraceLogger emits compact tool/context metadata without raw prompt content or tool args', () => {
    const trace = new ChatAiTraceLogger(makeSnapshot(), 'openai');
    trace.recordSkillResolution({
        selectedSkills: ['swap'],
        skillPrompts: [],
        allowedTools: ['read_user_context', 'read_wallet_state', 'simulate_swap'],
        blockedTools: [],
        preferredTools: ['read_user_context', 'read_wallet_state', 'simulate_swap'],
        strategyNotes: [],
        allowAllTools: false,
        rankedMatches: [],
        searchMode: 'forbidden',
        searchReason: 'canonical_swap_execution',
        currentPhase: 'execution',
        toolPhasePolicy: {
            initialPhase: 'execution',
            nextPhaseAfterNativeSearch: null,
            searchRetryLimit: 0,
        },
        querySignals: {} as any,
        selectedSkillIds: ['swap'] as any,
        rejectedSkills: [] as any,
        contextContract: {
            mode: 'execution',
            requiredContexts: ['user_context', 'wallet_state', 'user_settings'],
            optionalContexts: [],
            reason: 'mutation workflow',
        },
        intentEnvelope: {
            primary_intent: 'swap_execution',
            task_mode: 'execute',
            search_mode: 'forbidden',
            search_target: 'none',
            domain: 'token',
            execution_risk: 'mutation',
            required_evidence: [],
        },
    } as any);
    trace.recordRoundStart({
        round: 1,
        phase: 'execution',
        toolCount: 3,
        allowedTools: ['read_user_context', 'read_wallet_state', 'simulate_swap'],
    });
    trace.recordGenerationResult({
        round: 1,
        textLength: 0,
        reasoningLength: 120,
        toolCalls: [
            { id: 'call-1', name: 'read_user_context', arguments: {} },
            { id: 'call-2', name: 'simulate_swap', arguments: { private_amount: '0.1' } },
        ],
    });
    trace.recordToolResult(1, {
        id: 'call-1',
        name: 'read_user_context',
        arguments: {},
        ok: true,
        result: { context: { wallet: { address: '0x1111111111111111111111111111111111111111' } } },
        metadata: { source: 'node_context' },
    } as OrchestratorToolResult);
    trace.recordToolResult(1, {
        id: 'call-2',
        name: 'simulate_swap',
        arguments: { private_amount: '0.1' },
        ok: true,
        result: { quote: 'private quote' },
        metadata: { source: 'tool_runtime' },
    } as OrchestratorToolResult);

    const metadata = trace.toLogMetadata({ finalReason: 'test' });
    const serialized = JSON.stringify(metadata);

    assert.equal(metadata.traceType, 'chat_ai_turn_summary');
    assert.deepEqual(metadata.contextReads, ['read_user_context']);
    assert.deepEqual(metadata.contextNamesRead, ['user_context']);
    assert.deepEqual(metadata.businessTools, ['simulate_swap']);
    assert.equal(metadata.toolResults?.[0]?.source, 'node_context');
    assert.equal(metadata.toolResults?.[1]?.source, 'tool_runtime');
    assert.equal(serialized.includes('Swap 0.1 ETH'), false);
    assert.equal(serialized.includes('private_amount'), false);
    assert.equal(serialized.includes('private quote'), false);
});
