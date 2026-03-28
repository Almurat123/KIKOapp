import { logger } from '../../utils/logger.js';
import { LogCode } from '../../config/logRegistry.js';
import type { ChatContextSnapshot, PlanCard, PlanCardUiText, PlanStep } from './contracts.js';
import type { SkillResolution } from './nodeSkillResolver.js';
import type { PythonGenerationClient } from './pythonGenerationClient.js';
import type { GenerationMessage } from './nodePromptAssembler.js';
import { orderPlanSteps } from './planOrdering.js';
import type { TaskPlanningContext } from './taskPlanner.js';

type ModelPlanPayload = {
    locale?: string;
    title?: string;
    summary?: string;
    uiText?: {
        eyebrow?: string;
        reasoningLabel?: string;
        statusLabels?: {
            pending?: string;
            in_progress?: string;
            completed?: string;
            failed?: string;
        };
        completedStepFeedback?: string;
        stoppedStepFeedback?: string;
    };
    steps?: Array<{
        id?: string;
        title?: string;
        description?: string;
        preferredTools?: string[];
    }>;
};

export async function generateModelPlan(args: {
    snapshot: ChatContextSnapshot;
    planning: TaskPlanningContext;
    skillResolution: SkillResolution;
    generationClient: PythonGenerationClient;
    shouldCancel?: () => Promise<boolean>;
}): Promise<PlanCard | null> {
    const { snapshot, planning, skillResolution, generationClient, shouldCancel } = args;
    const allowedStepIds = planning.plan.steps.map((step) => step.id);
    const preferredTools = Array.from(new Set(skillResolution.preferredTools || [])).slice(0, 12);

    const messages: GenerationMessage[] = [
        {
            role: 'system',
            content: [
                'You generate a compact task plan for an AI runtime card.',
                'Return JSON only. No markdown. No prose before or after the JSON.',
                'Write every user-facing string in the same language as the latest user message.',
                'Preserve the user script when possible instead of translating into Chinese or English.',
                'Set locale to a short language tag like en, zh, or ja when clear.',
                'Use only the provided step ids. Do not invent new ids.',
                'Keep titles short and user-facing. Keep descriptions to one sentence.',
            ].join(' '),
        },
        {
            role: 'user',
            content: JSON.stringify({
                task: snapshot.lastUserMessage,
                available_step_ids: allowedStepIds,
                plan_hints: {
                    title: planning.planHints.title,
                    summary: planning.planHints.summary,
                    steps: planning.planHints.steps,
                },
                preferred_tools: preferredTools,
                requested_token_addresses: snapshot.requestedTokenAddresses || [],
                requested_token_symbols: snapshot.requestedTokenSymbols || [],
                return_schema: {
                    locale: 'optional_language_tag_string',
                    title: 'string',
                    summary: 'string',
                    uiText: {
                        eyebrow: 'string',
                        reasoningLabel: 'string',
                        statusLabels: {
                            pending: 'string',
                            in_progress: 'string',
                            completed: 'string',
                            failed: 'string',
                        },
                        completedStepFeedback: 'string',
                        stoppedStepFeedback: 'string',
                    },
                    steps: [
                        {
                            id: 'one of available_step_ids',
                            title: 'string',
                            description: 'string',
                            preferredTools: ['tool_name'],
                        },
                    ],
                },
            }),
        },
    ];

    try {
        const result = await generationClient.generate({
            sessionId: snapshot.sessionId,
            taskId: `${snapshot.taskId}:plan`,
            model: snapshot.model,
            messages,
            tools: [],
            providerOptions: {
                enable_search: false,
                metadata: {
                    phase: 'plan_generation',
                },
            },
            shouldCancel,
            onTextDelta: async () => {},
            onReasoningDelta: async () => {},
            onUsage: () => {},
            onCitation: () => {},
        });

        const payload = parsePlanPayload(result.text);
        if (!payload) {
            logger.warn(LogCode.AI_ORCHESTRATOR, 'ModelPlanGenerator: failed to parse plan payload', {
                sessionId: snapshot.sessionId,
                taskId: snapshot.taskId,
                preview: result.text?.slice(0, 300),
            });
            return null;
        }

        return mergePlan(planning.plan, payload, preferredTools);
    } catch (error: any) {
        logger.warn(LogCode.AI_ORCHESTRATOR, 'ModelPlanGenerator: plan generation failed', {
            sessionId: snapshot.sessionId,
            taskId: snapshot.taskId,
            error: error?.message || String(error),
        });
        return null;
    }
}

function mergePlan(plan: PlanCard, payload: ModelPlanPayload, fallbackPreferredTools: string[]): PlanCard {
    const planStepMap = new Map(plan.steps.map((step) => [step.id, step]));
    const nextSteps: PlanStep[] = [];

    for (const step of payload.steps || []) {
        const id = String(step?.id || '').trim();
        if (!id || !planStepMap.has(id)) continue;
        const base = planStepMap.get(id)!;
        nextSteps.push({
            ...base,
            title: String(step?.title || '').trim() || base.title,
            description: String(step?.description || '').trim() || base.description,
            preferredTools: normalizeTools(step?.preferredTools, fallbackPreferredTools, base.preferredTools || []),
        });
        planStepMap.delete(id);
    }

    if (nextSteps.length === 0) return plan;

    for (const base of plan.steps) {
        if (!nextSteps.some((step) => step.id === base.id) && planStepMap.has(base.id)) {
            nextSteps.push(base);
        }
    }

    return {
        ...plan,
        locale: String(payload.locale || '').trim() || plan.locale,
        title: String(payload.title || '').trim() || plan.title,
        summary: String(payload.summary || '').trim() || plan.summary,
        uiText: mergeUiText(plan.uiText, payload.uiText),
        steps: orderPlanSteps(nextSteps),
    };
}

function mergeUiText(
    existing: PlanCardUiText | undefined,
    incoming: ModelPlanPayload['uiText'],
): PlanCardUiText | undefined {
    if (!incoming || typeof incoming !== 'object') return existing;
    const statusLabels = normalizeStatusLabels(incoming.statusLabels, existing?.statusLabels);
    const merged: PlanCardUiText = {
        ...existing,
        eyebrow: String(incoming.eyebrow || '').trim() || existing?.eyebrow,
        reasoningLabel: String(incoming.reasoningLabel || '').trim() || existing?.reasoningLabel,
        statusLabels,
        completedStepFeedback: String(incoming.completedStepFeedback || '').trim() || existing?.completedStepFeedback,
        stoppedStepFeedback: String(incoming.stoppedStepFeedback || '').trim() || existing?.stoppedStepFeedback,
    };
    return Object.values(merged).some((value) => {
        if (!value) return false;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return true;
    }) ? merged : existing;
}

function normalizeStatusLabels(
    incoming: ModelPlanPayload['uiText'] extends { statusLabels?: infer T } ? T | undefined : Record<string, unknown> | undefined,
    existing: PlanCardUiText['statusLabels'] | undefined,
): PlanCardUiText['statusLabels'] {
    const record = incoming && typeof incoming === 'object'
        ? incoming as Record<string, unknown>
        : {};
    const next: PlanCardUiText['statusLabels'] = {
        ...existing,
    };
    for (const key of ['pending', 'in_progress', 'completed', 'failed'] as const) {
        const value = String(record[key] || '').trim();
        if (value) {
            next[key] = value;
        }
    }
    return Object.keys(next).length > 0 ? next : existing;
}

function normalizeTools(tools: unknown, fallbackPreferredTools: string[], existing: string[]): string[] {
    if (Array.isArray(tools)) {
        const normalized = tools.map((item) => String(item || '').trim()).filter(Boolean);
        if (normalized.length > 0) return Array.from(new Set(normalized)).slice(0, 5);
    }
    if (existing.length > 0) return existing;
    return fallbackPreferredTools.slice(0, 3);
}

function parsePlanPayload(text: string): ModelPlanPayload | null {
    const candidate = stripCodeFence(String(text || '').trim());
    if (!candidate) return null;
    const json = extractFirstJsonObject(candidate);
    if (!json) return null;
    try {
        const parsed = JSON.parse(json) as ModelPlanPayload;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        return null;
    }
}

function stripCodeFence(text: string): string {
    return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractFirstJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
        const char = text[i];
        if (inString) {
            if (escaped) escaped = false;
            else if (char === '\\') escaped = true;
            else if (char === '"') inString = false;
            continue;
        }
        if (char === '"') {
            inString = true;
            continue;
        }
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}
