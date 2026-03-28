import assert from 'node:assert/strict';
import test from 'node:test';

import { generateModelPlan } from './modelPlanGenerator.js';

test('generateModelPlan preserves model-authored locale and ui text for multilingual plan cards', async () => {
    const plan = await generateModelPlan({
        snapshot: {
            sessionId: 'session-1',
            taskId: 'task-1',
            model: 'grok-4',
            history: [],
            lastUserMessage: 'なぜこのトークンはこんなに人気なのでしょうか？',
            requestedTokenAddresses: [],
            requestedTokenSymbols: [],
            runtime: {},
            toolDefinitions: [],
        } as any,
        planning: {
            locale: 'en',
            planHints: {
                title: 'Explain why the token is popular',
                summary: 'Review the available evidence first, then explain the main drivers.',
                steps: [
                    {
                        id: 'step-understand',
                        title: 'Understand the request',
                        description: 'Interpret the question before proceeding.',
                    },
                    {
                        id: 'step-summary',
                        title: 'Generate answer',
                        description: 'Answer from the confirmed evidence only.',
                    },
                ],
            },
            asksRealtimeSocial: false,
            asksOnChainEvidence: false,
            asksCreatorEvidence: false,
            requestedToken: false,
            plan: {
                planId: 'plan-1',
                title: 'Working on your request',
                summary: 'I will interpret the request first and prepare the next steps.',
                locale: 'en',
                status: 'in_progress',
                currentStepId: 'step-understand',
                steps: [
                    {
                        id: 'step-understand',
                        title: 'Understand the request',
                        description: 'Interpret the request first.',
                        status: 'in_progress',
                        executions: [],
                    },
                    {
                        id: 'step-summary',
                        title: 'Generate answer',
                        description: 'Answer from the gathered evidence.',
                        status: 'pending',
                        executions: [],
                    },
                ],
                activity: [],
            },
        },
        skillResolution: {
            preferredTools: ['get_token_info'],
        } as any,
        generationClient: {
            async generate() {
                return {
                    text: JSON.stringify({
                        locale: 'ja',
                        title: 'このトークンが人気な理由',
                        summary: 'まず事実を確認してから人気の理由を整理します。',
                        uiText: {
                            eyebrow: 'タスク',
                            reasoningLabel: '考え方',
                            statusLabels: {
                                pending: '保留',
                                in_progress: '進行中',
                                completed: '完了',
                                failed: '失敗',
                            },
                            completedStepFeedback: 'このステップは追加作業なしで完了しました。',
                            stoppedStepFeedback: 'タスクが停止したため、このステップは続行されませんでした。',
                        },
                        steps: [
                            {
                                id: 'step-understand',
                                title: '質問を整理する',
                                description: '何を知りたいのかを先に明確にします。',
                            },
                            {
                                id: 'step-summary',
                                title: '回答をまとめる',
                                description: '確認できた情報だけで結論をまとめます。',
                            },
                        ],
                    }),
                };
            },
        } as any,
    });

    assert.ok(plan);
    assert.equal(plan?.locale, 'ja');
    assert.equal(plan?.title, 'このトークンが人気な理由');
    assert.equal(plan?.uiText?.eyebrow, 'タスク');
    assert.equal(plan?.uiText?.statusLabels?.in_progress, '進行中');
    assert.equal(plan?.steps[0]?.title, '質問を整理する');
});
