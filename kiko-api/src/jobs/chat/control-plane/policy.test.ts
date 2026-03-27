import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTaskControlDecision } from './policy.js';
import type { SemanticParse } from './types.js';

function makeParse(overrides: Partial<SemanticParse>): SemanticParse {
    return {
        parserVersion: 'semantic-parse-v1',
        domain: 'token',
        intent: 'token_analysis',
        confidence: 0.9,
        locale: 'en',
        explanation: 'test',
        entities: {
            tokenAddresses: [],
            tokenSymbols: [],
            walletAddresses: [],
            chainIds: [],
            chainNames: [],
        },
        cues: {
            explicitTradeVerb: false,
            explicitExternalEvidenceRequest: false,
            explicitSocialEvidenceRequest: false,
            currentTurnExplicitAddress: false,
            followupReference: false,
        },
        timeWindow: null,
        ...overrides,
    };
}

test('token attention analysis stays in analysis lane and requires external attention evidence', () => {
    const decision = deriveTaskControlDecision(makeParse({
        intent: 'token_attention_analysis',
        entities: {
            tokenAddresses: ['0x3d4f0513e8a29669b960f9dbca61861548a9a760'],
            tokenSymbols: [],
            walletAddresses: [],
            chainIds: [56],
            chainNames: ['BNB Chain'],
        },
        cues: {
            explicitTradeVerb: false,
            explicitExternalEvidenceRequest: false,
            explicitSocialEvidenceRequest: true,
            currentTurnExplicitAddress: true,
            followupReference: false,
        },
    }));

    assert.equal(decision.lane, 'analysis');
    assert.equal(decision.taskType, 'token_attention_analysis');
    assert.equal(decision.searchRequirement, 'required');
    assert.equal(decision.searchTarget, 'x_and_web');
    assert.equal(decision.targetScope.mode, 'current_turn_only');
    assert.ok(decision.evidenceContract.requirements.some((item) => item.kind === 'external_attention' && item.required));
    assert.equal(decision.answerGrounding.allowExternalClaimsWithoutEvidence, false);
});

test('explicit swap execution stays in execution lane without mandatory search', () => {
    const decision = deriveTaskControlDecision(makeParse({
        intent: 'swap_execution',
        entities: {
            tokenAddresses: ['0x3d4f0513e8a29669b960f9dbca61861548a9a760'],
            tokenSymbols: [],
            walletAddresses: [],
            chainIds: [56],
            chainNames: ['BNB Chain'],
        },
        cues: {
            explicitTradeVerb: true,
            explicitExternalEvidenceRequest: false,
            explicitSocialEvidenceRequest: false,
            currentTurnExplicitAddress: true,
            followupReference: false,
        },
    }));

    assert.equal(decision.lane, 'execution');
    assert.equal(decision.taskType, 'swap_execution');
    assert.equal(decision.searchRequirement, 'forbidden');
    assert.ok(decision.evidenceContract.requirements.some((item) => item.kind === 'execution_preflight' && item.required));
});

test('early buyer export stays chain-first and does not require search', () => {
    const decision = deriveTaskControlDecision(makeParse({
        intent: 'early_buyer_export',
        entities: {
            tokenAddresses: ['0xeccbb861c0dda7efd964010085488b69317e4444'],
            tokenSymbols: [],
            walletAddresses: [],
            chainIds: [56],
            chainNames: ['BNB Chain'],
        },
        cues: {
            explicitTradeVerb: false,
            explicitExternalEvidenceRequest: false,
            explicitSocialEvidenceRequest: false,
            currentTurnExplicitAddress: true,
            followupReference: false,
        },
    }));

    assert.equal(decision.lane, 'analysis');
    assert.equal(decision.taskType, 'early_buyer_export');
    assert.equal(decision.searchRequirement, 'forbidden');
    assert.ok(decision.evidenceContract.requirements.some((item) => item.kind === 'onchain_token' && item.required));
});
