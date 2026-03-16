import assert from 'node:assert/strict';
import test from 'node:test';
import type { OrchestratorToolResult, PlanStepExecution } from './contracts.js';
import { mergeCollapsedExecutionDetail, mergeOrchestratorUsage, shouldCollapseRuntimeResult, terminalizeRemainingPlanStepsAfterFailure } from './streamBroker.js';

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

test('terminalizeRemainingPlanStepsAfterFailure marks remaining pending steps as failed', () => {
    const next = terminalizeRemainingPlanStepsAfterFailure([
        {
            id: 'step-1',
            title: 'Understand Query',
            status: 'failed',
            feedback: 'Assistant output blocked by moderation',
        },
        {
            id: 'step-2',
            title: 'Check timing and social context',
            status: 'pending',
        },
        {
            id: 'step-3',
            title: 'Summarize findings',
            status: 'pending',
        },
    ], 'step-1', '2026-03-15T05:00:00.000Z', 'Not completed because the task stopped after an earlier error.');

    assert.equal(next[1]?.status, 'failed');
    assert.equal(next[2]?.status, 'failed');
    assert.equal(next[1]?.feedback, 'Not completed because the task stopped after an earlier error.');
    assert.equal(next[2]?.completedAt, '2026-03-15T05:00:00.000Z');
});

test('mergeOrchestratorUsage accumulates multi-round provider usage', () => {
    const merged = mergeOrchestratorUsage(
        {
            prompt_tokens: 100,
            completion_tokens: 25,
            total_tokens: 150,
            prompt_cache_hit_tokens: 40,
            prompt_cache_miss_tokens: 60,
            completion_tokens_details: { reasoning_tokens: 25 },
            cost_in_usd_ticks: 1000,
        },
        {
            prompt_tokens: 80,
            completion_tokens: 20,
            total_tokens: 130,
            reasoning_tokens: 30,
            prompt_cache_hit_tokens: 10,
            prompt_cache_miss_tokens: 70,
            prompt_tokens_details: { cached_tokens: 10, text_tokens: 70 },
            completion_tokens_details: { reasoning_tokens: 30 },
            cost_in_usd_ticks: 2500,
        },
    );

    assert.deepEqual(merged, {
        prompt_tokens: 180,
        completion_tokens: 45,
        total_tokens: 280,
        reasoning_tokens: 55,
        prompt_cache_hit_tokens: 50,
        prompt_cache_miss_tokens: 130,
        prompt_tokens_details: { cached_tokens: 10, text_tokens: 70 },
        completion_tokens_details: { reasoning_tokens: 55 },
        cost_in_usd_ticks: 3500,
    });
});
