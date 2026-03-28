import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTaskPlanningContext, buildWarmupPlan, materializePlanCard } from './taskPlanner.js';

test('buildWarmupPlan creates an immediate generic runtime card before routing completes', () => {
    const plan = buildWarmupPlan('What can you doing Kiko?');

    assert.equal(plan.title, 'Working on your request');
    assert.equal(plan.summary, 'I will inspect the task step by step and continue as results come in.');
    assert.equal(plan.steps[0]?.id, 'step-understand');
    assert.equal(plan.steps[0]?.title, 'Understand the request');
    assert.equal(plan.steps[0]?.status, 'in_progress');
    assert.equal(plan.steps[1]?.id, 'step-summary');
});

test('buildTaskPlanningContext creates a lightweight skeleton from canonical intent', () => {
    const planning = buildTaskPlanningContext({
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5.4',
        history: [],
        lastUserMessage: 'Check early buyers for this token',
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        requestedTokenSymbols: [],
        runtime: {},
        toolDefinitions: [],
        normalizedIntent: {
            domain: 'token',
            intent: 'early_buyers',
            taskMode: 'analyze',
            outputMode: 'full_table',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.9,
            explanation: 'early buyers',
            entities: {
                tokenAddresses: ['0x1111111111111111111111111111111111111111'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: null,
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
    } as any, {
        preferredTools: ['get_early_buyers'],
        intentEnvelope: {
            execution_risk: 'read_only',
        },
    } as any);

    assert.equal(planning.plan.title, '');
    assert.equal(planning.plan.summary, '');
    assert.equal(planning.plan.steps[0]?.title, '');
    assert.equal(planning.planHints.steps[0]?.title, 'Understand the request');
    assert.equal(planning.plan.steps[0]?.id, 'step-understand');
    assert.equal(planning.plan.steps[1]?.id, 'step-evidence');
    assert.equal(planning.plan.steps[2]?.id, 'step-summary');
});

test('materializePlanCard upgrades structural planning into a user-visible runtime card', () => {
    const planning = buildTaskPlanningContext({
        sessionId: 'session-1',
        taskId: 'task-1',
        model: 'gpt-5.4',
        history: [],
        lastUserMessage: 'Check early buyers for this token',
        requestedTokenAddresses: ['0x1111111111111111111111111111111111111111'],
        requestedTokenSymbols: [],
        runtime: {},
        toolDefinitions: [],
        normalizedIntent: {
            domain: 'token',
            intent: 'early_buyers',
            taskMode: 'analyze',
            outputMode: 'full_table',
            searchMode: 'forbidden',
            searchTarget: 'none',
            confidence: 0.9,
            explanation: 'early buyers',
            entities: {
                tokenAddresses: ['0x1111111111111111111111111111111111111111'],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: null,
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
    } as any, {
        preferredTools: ['get_early_buyers'],
        intentEnvelope: {
            execution_risk: 'read_only',
        },
    } as any);

    const plan = materializePlanCard(planning);
    assert.equal(plan.title, 'Gather relevant evidence');
    assert.equal(plan.summary, 'I will gather the necessary evidence first, then answer from the real results.');
    assert.equal(plan.locale, 'en');
    assert.equal(plan.steps[0]?.title, 'Understand the request');
    assert.equal(plan.steps[1]?.title, 'Gather evidence');
    assert.equal(plan.steps[2]?.title, 'Generate answer');
});

test('buildTaskPlanningContext follows resolved search contract instead of raw canonical realtime flags', () => {
    const planning = buildTaskPlanningContext({
        sessionId: 'session-2',
        taskId: 'task-2',
        model: 'grok-4.1-fast',
        history: [],
        lastUserMessage: 'BSC热门的代币有什么？',
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        runtime: {},
        toolDefinitions: [],
        normalizedIntent: {
            domain: 'token',
            intent: 'social_discovery',
            taskMode: 'discover',
            outputMode: 'narrative',
            searchMode: 'required',
            searchTarget: 'none',
            confidence: 0.9,
            explanation: 'token trends',
            entities: {
                tokenAddresses: [],
                tokenSymbols: [],
                walletAddresses: [],
                marketIdentifiers: [],
            },
            requestedChain: null,
            timeContext: null,
            evidenceRequirements: ['native_search_results'],
            requiresRealtime: true,
            requiresOnchainEvidence: false,
            executionCandidate: false,
            rowCount: null,
            locale: 'zh',
            needsClarification: false,
            clarificationQuestion: null,
            source: 'llm',
        },
    } as any, {
        searchMode: 'forbidden',
        intentEnvelope: {
            search_target: 'none',
            domain: 'token',
            required_evidence: [],
            execution_risk: 'read_only',
        },
    } as any);

    assert.equal(planning.asksRealtimeSocial, false);
    assert.equal(planning.plan.steps.some((step) => step.id === 'step-evidence'), false);
    assert.equal(planning.plan.steps[0]?.id, 'step-understand');
    assert.equal(planning.plan.steps[1]?.id, 'step-summary');
});
