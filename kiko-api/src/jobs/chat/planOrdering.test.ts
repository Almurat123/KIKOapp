import assert from 'node:assert/strict';
import test from 'node:test';
import type { PlanStep } from './contracts.js';
import { orderPlanSteps } from './planOrdering.js';

function makeStep(id: string, title = id): PlanStep {
    return {
        id,
        title,
        status: 'pending',
        executions: [],
    };
}

test('orderPlanSteps keeps summary last when runtime evidence steps are added later', () => {
    const ordered = orderPlanSteps([
        makeStep('step-discover'),
        makeStep('step-verify'),
        makeStep('step-summary'),
        makeStep('step-social'),
    ]);

    assert.deepEqual(ordered.map((step) => step.id), [
        'step-discover',
        'step-social',
        'step-verify',
        'step-summary',
    ]);
});

test('orderPlanSteps preserves relative order for unknown step ids', () => {
    const ordered = orderPlanSteps([
        makeStep('step-discover'),
        makeStep('step-custom-a'),
        makeStep('step-custom-b'),
        makeStep('step-summary'),
    ]);

    assert.deepEqual(ordered.map((step) => step.id), [
        'step-discover',
        'step-custom-a',
        'step-custom-b',
        'step-summary',
    ]);
});
