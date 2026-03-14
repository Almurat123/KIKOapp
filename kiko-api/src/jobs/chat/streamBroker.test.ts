import assert from 'node:assert/strict';
import test from 'node:test';
import type { OrchestratorToolResult, PlanStepExecution } from './contracts.js';
import { mergeCollapsedExecutionDetail, shouldCollapseRuntimeResult } from './streamBroker.js';

test('collapses repeat-cache tool results onto an existing execution', () => {
    const executions: PlanStepExecution[] = [
        {
            id: 'exec-1',
            toolName: 'get_trending_casts',
            status: 'failed',
            summary: 'Failed: get trending casts',
            detail: { error: 'initial failure' },
        },
    ];
    const result: OrchestratorToolResult = {
        id: 'tool-2',
        name: 'get_trending_casts',
        arguments: { limit: 30 },
        ok: false,
        error: 'cached failure',
        metadata: { source: 'repeat_cache' },
    };

    const collapsedIndex = shouldCollapseRuntimeResult(result, executions);
    assert.equal(collapsedIndex, 0);

    const merged = mergeCollapsedExecutionDetail(executions[0].detail, result);
    assert.equal(merged.collapsed.repeatCacheCount, 1);
    assert.equal(merged.collapsed.lastRepeatCache.error, 'cached failure');
});

test('collapses budget-guard tool results onto an existing execution', () => {
    const executions: PlanStepExecution[] = [
        {
            id: 'exec-1',
            toolName: 'get_trending_casts',
            status: 'failed',
            summary: 'Failed: get trending casts',
            detail: { error: 'tool budget reached previously' },
        },
    ];
    const result: OrchestratorToolResult = {
        id: 'tool-3',
        name: 'get_trending_casts',
        arguments: { limit: 30 },
        ok: false,
        error: 'Tool budget reached',
        metadata: { source: 'tool_budget_guard' },
    };

    const collapsedIndex = shouldCollapseRuntimeResult(result, executions);
    assert.equal(collapsedIndex, 0);

    const merged = mergeCollapsedExecutionDetail(executions[0].detail, result);
    assert.equal(merged.collapsed.budgetGuardCount, 1);
    assert.equal(merged.collapsed.lastBudgetGuard.error, 'Tool budget reached');
});
