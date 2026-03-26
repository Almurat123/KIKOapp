import type { PlanStep } from './contracts.js';

const STEP_ORDER: Record<string, number> = {
    'step-discover': 10,
    'step-social': 20,
    'step-chain': 30,
    'step-creator': 35,
    'step-verify': 40,
    'step-prepare': 50,
    'step-summary': 90,
};

function resolveStepOrder(step: PlanStep): number {
    return STEP_ORDER[step.id] ?? 60;
}

export function orderPlanSteps(steps: PlanStep[]): PlanStep[] {
    return steps
        .map((step, index) => ({
            step,
            index,
            order: resolveStepOrder(step),
        }))
        .sort((left, right) => {
            if (left.order !== right.order) return left.order - right.order;
            return left.index - right.index;
        })
        .map((entry) => entry.step);
}
