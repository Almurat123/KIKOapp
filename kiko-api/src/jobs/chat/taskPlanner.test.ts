import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTaskPlanningContext } from './taskPlanner.js';

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

    assert.equal(planning.plan.steps[0]?.id, 'step-discover');
    assert.equal(planning.plan.steps[1]?.id, 'step-verify');
    assert.equal(planning.plan.steps[2]?.id, 'step-summary');
});
