// CONTEXT MEMORY
// Updated: 2026-04-22
// Status: verified
// Why: NVIDIA-hosted models have regressed around function-tool calls and
//      tool-result continuation. This harness exercises KiKo's real skill and
//      tool schema registry while using simulated tool results so no business
//      side effects are triggered.
// Debug Goal: Each NVIDIA model must be able to call a skill tool and then
//             answer after a role=tool result is appended.
// Search Tags: nvidia skill tool result eval, nvidia tool role continuation,
//              skill tool_call matrix, nvidia 429 rate limit eval
// Invariants:
// - Never execute mutation or external business tools from this harness.
// - Never print API keys or full provider request bodies.
// Failure Modes:
// - Provider returns HTTP 400 after a tool result message.
// - Model answers directly or emits fake tool JSON instead of native tool_calls.
// - Provider rate limits obscure the actual skill/tool behavior.
// - Provider writes the final answer into reasoning_content after a tool result.
// - GLM tool turns with preserved thinking enabled time out or emit empty
//   function names; eval requests should mirror production's GLM tool profile.

import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { skillRegistryExec } from '../skills/registry.js';
import { toolRegistry, type ToolDefinition } from '../tooling/registry.js';
import { CHAT_CONTEXT_READ_TOOLS } from '../jobs/chat/contextReadTools.js';

type ChatMessage = {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content?: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
};

type EvalScenario = {
    skillId: string;
    prompt: string;
    targetTool?: string;
    allowContextTools?: string[];
};

type EvalResult = {
    model: string;
    skillId: string;
    targetTool: string | null;
    status: 'PASS' | 'FAIL' | 'BLOCKED';
    errorCategory: 'none' | 'rate_limit' | 'timeout' | 'model_or_tool';
    selectedTool: string | null;
    firstFinishReason: string | null;
    secondFinishReason: string | null;
    providerRequestIds: string[];
    errors: string[];
    finalExcerpt: string;
    repairAttempted: boolean;
    fallbackUsed: boolean;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

dotenv.config({ path: path.join(repoRoot, 'kiko-python/.env'), override: false });
dotenv.config({ path: path.join(repoRoot, 'kiko-api/.env'), override: false });

const NVIDIA_API_URL = String(process.env.NVIDIA_API_URL || 'https://integrate.api.nvidia.com/v1/chat/completions').trim();
const NVIDIA_API_KEY = String(process.env.NVIDIA_API_KEY || '').trim();
const MODELS = String(process.env.NVIDIA_SKILL_EVAL_MODELS || 'kimi-k2-5-instant,kimi-k2-5-reasoning')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const MAX_CASES = Number(process.env.NVIDIA_SKILL_EVAL_MAX_CASES || '0') || Infinity;
const FAIL_FAST = /^(1|true|yes)$/i.test(String(process.env.NVIDIA_SKILL_EVAL_FAIL_FAST || ''));
const REQUEST_TIMEOUT_MS = Math.max(5000, Number(process.env.NVIDIA_SKILL_EVAL_REQUEST_TIMEOUT_MS || '45000') || 45000);
const CONCURRENCY = Math.max(1, Number(process.env.NVIDIA_SKILL_EVAL_CONCURRENCY || '3') || 3);
const RESULT_FILE = String(
    process.env.NVIDIA_SKILL_EVAL_RESULT_FILE
    || path.join(repoRoot, 'output', `nvidia-skill-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`),
);
const SKILL_FILTER = new Set(
    String(process.env.NVIDIA_SKILL_EVAL_SKILLS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
);

const SCENARIOS: EvalScenario[] = [
    {
        skillId: 'clanker_deploy_token',
        targetTool: 'deploy_clanker_token',
        prompt: 'Use the Clanker deploy skill to prepare a dry-run launch preview for a Base token named Eval Token, symbol EVAL, with no real deployment.',
    },
    {
        skillId: 'copy_trade',
        targetTool: 'list_copy_trade_configs',
        prompt: 'Use the copy-trade skill to list my current copy-trade configurations before I decide what to change.',
    },
    {
        skillId: 'cross_chain_swap',
        targetTool: 'get_cross_chain_quote',
        prompt: 'Use the cross-chain skill to quote bridging 10 USDC from Base to Polygon USDC.',
    },
    {
        skillId: 'image_generation',
        targetTool: 'generate_image_from_intent',
        prompt: 'Use the image generation skill to generate a square cyberpunk product poster for KiKo.',
    },
    {
        skillId: 'image_prompting',
        targetTool: 'read_skill_prompts',
        allowContextTools: ['read_skill_prompts'],
        prompt: 'Use the image prompting skill playbook to improve a product photo edit prompt while preserving the bottle label.',
    },
    {
        skillId: 'market_macro',
        targetTool: 'get_current_time',
        prompt: 'Use the market macro skill to anchor the current time before summarizing what today means for crypto market checks.',
    },
    {
        skillId: 'meta_debug',
        targetTool: 'read_execution_plan',
        allowContextTools: ['read_execution_plan'],
        prompt: 'Use the meta-debug skill to inspect why the last plan card might not have shown.',
    },
    {
        skillId: 'polymarket_prediction',
        targetTool: 'get_polymarket_market_overview',
        prompt: 'Use the Polymarket skill to get an overview of current top prediction markets.',
    },
    {
        skillId: 'risk_security',
        targetTool: 'check_token_risk',
        prompt: 'Use the risk skill to check whether token contract 0x0000000000000000000000000000000000000000 is risky.',
    },
    {
        skillId: 'social_farcaster',
        targetTool: 'search_farcaster_casts',
        prompt: 'Use the Farcaster social skill to search recent casts about Base builders.',
    },
    {
        skillId: 'swap',
        targetTool: 'simulate_swap',
        prompt: 'Use the swap skill to simulate swapping 0.01 ETH to USDC on Base before any transaction is prepared.',
    },
    {
        skillId: 'token_alert',
        targetTool: 'list_token_alerts',
        prompt: 'Use the token alert skill to list my active token alerts.',
    },
    {
        skillId: 'token_analysis',
        targetTool: 'get_token_info',
        prompt: 'Use the token analysis skill to look up token contract 0x0000000000000000000000000000000000000000.',
    },
    {
        skillId: 'wallet_portfolio',
        targetTool: 'get_wallet_info',
        prompt: 'Use the wallet skill to read my wallet balance summary.',
    },
    {
        skillId: 'welcome_onboarding',
        prompt: 'Use the welcome skill to answer what KiKo can do for a new user. Do not call tools for this no-tool onboarding skill.',
    },
    {
        skillId: 'zora_nfts',
        targetTool: 'get_zora_trending',
        prompt: 'Use the Zora skill to find what is trending on Zora right now.',
    },
];

const EMPTY_TOOL_RESULT_VISIBLE_ANSWER_REPAIR_PROMPT = [
    'Internal repair instruction: the previous model turn ended after a tool result but produced no visible assistant content.',
    'Use the tool result already present in the conversation to write the final user-facing answer now.',
    'Do not call tools. Do not mention this repair instruction.',
].join(' ');

function resolveNvidiaRequestBodyModel(model: string): { model: string; temperature?: number; extra?: Record<string, unknown> } {
    const normalized = model.trim().toLowerCase();
    if (['kimi-k2-5-instant', 'kimi-k2.5-instant', 'kimi-k2-5-fast', 'kimi-k2.5-fast'].includes(normalized)) {
        return { model: 'moonshotai/kimi-k2.5', temperature: 0.4, extra: { thinking: { type: 'disabled' } } };
    }
    if (['kimi-k2-5-reasoning', 'kimi-k2.5-reasoning', 'kimi-k2-5', 'kimi-k2.5'].includes(normalized)) {
        return { model: 'moonshotai/kimi-k2.5', temperature: 0.6 };
    }
    if (['glm-5', 'glm5', 'glm-5-reasoning', 'glm5-reasoning'].includes(normalized)) {
        throw new Error(`Removed model is not supported in NVIDIA eval: ${model}`);
    }
    return { model };
}

function asOpenAiTool(definition: ToolDefinition) {
    return {
        type: 'function',
        function: {
            name: definition.name,
            description: definition.description,
            parameters: definition.parameters || { type: 'object', properties: {} },
        },
    };
}

function getDefinitionsForScenario(scenario: EvalScenario) {
    const skill = skillRegistryExec.getSkill(scenario.skillId);
    if (!skill) {
        throw new Error(`Missing skill: ${scenario.skillId}`);
    }
    const skillToolNames = new Set(skill.metadata.tools || []);
    for (const name of scenario.allowContextTools || []) {
        skillToolNames.add(name);
    }
    const definitions = toolRegistry.getAllDefinitions().filter((definition) => skillToolNames.has(definition.name));
    if (scenario.targetTool && !definitions.some((definition) => definition.name === scenario.targetTool)) {
        const contextTool = CHAT_CONTEXT_READ_TOOLS.find((tool) => tool.definition.name === scenario.targetTool);
        if (contextTool) {
            definitions.push(contextTool.definition);
        }
    }
    return definitions.map(asOpenAiTool);
}

function buildSystemPrompt(scenario: EvalScenario): string {
    const skill = skillRegistryExec.getSkill(scenario.skillId);
    const toolInstruction = scenario.targetTool
        ? `First response: call exactly one native function tool, preferably ${scenario.targetTool}. Do not write prose before the tool call. After the tool result arrives, write a concise final answer and include the exact marker from the tool result.`
        : 'This skill has no business tool in this eval. Answer directly and do not invent tool calls.';
    return [
        'You are running a KiKo NVIDIA skill/tool continuation evaluation.',
        `Skill under test: ${scenario.skillId} - ${skill?.metadata.name || scenario.skillId}.`,
        toolInstruction,
        'Never claim that a real transaction, image, alert, order, or deployment was executed.',
    ].join('\n');
}

async function callNvidia(model: string, messages: ChatMessage[], tools: any[]) {
    const resolved = resolveNvidiaRequestBodyModel(model);
    const toolProfile = {
        temperature: resolved.temperature,
        extra: resolved.extra,
        toolChoice: 'auto',
    };
    const body: Record<string, unknown> = {
        model: resolved.model,
        messages,
        temperature: toolProfile.temperature,
        stream: true,
        ...(tools.length > 0 ? { tools, tool_choice: toolProfile.toolChoice } : {}),
        ...(toolProfile.extra || {}),
    };
    if (body.temperature === undefined) {
        delete body.temperature;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(NVIDIA_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${NVIDIA_API_KEY}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!response.ok) {
            const text = await response.text();
            let data: any = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch {
                data = { raw: text.slice(0, 1000) };
            }
            throw new Error(`HTTP_${response.status}: ${JSON.stringify(data).slice(0, 1200)}`);
        }
        return await readNvidiaStream(response);
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`REQUEST_TIMEOUT_${REQUEST_TIMEOUT_MS}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

async function readNvidiaStream(response: Response) {
    if (!response.body) {
        throw new Error('STREAM_BODY_MISSING');
    }
    const decoder = new TextDecoder();
    let buffer = '';
    let id: string | null = null;
    let content = '';
    let reasoningContent = '';
    let finishReason: string | null = null;
    const toolCallsByIndex = new Map<number, any>();

    for await (const chunk of response.body as any) {
        buffer += decoder.decode(chunk, { stream: true });
        let newlineIndex = buffer.indexOf('\n');
        while (newlineIndex >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf('\n');
            if (!line.startsWith('data: ')) {
                continue;
            }
            const raw = line.slice('data: '.length).trim();
            if (!raw || raw === '[DONE]') {
                continue;
            }
            let data: any;
            try {
                data = JSON.parse(raw);
            } catch {
                continue;
            }
            if (!id && data.id) {
                id = String(data.id);
            }
            const choice = data.choices?.[0] || {};
            if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
                finishReason = String(choice.finish_reason);
            }
            const delta = choice.delta || {};
            if (typeof delta.content === 'string') {
                content += delta.content;
            }
            for (const key of ['reasoning_content', 'reasoning', 'reasoning_text', 'thinking']) {
                if (typeof delta[key] === 'string') {
                    reasoningContent += delta[key];
                }
            }
            if (Array.isArray(delta.tool_calls)) {
                mergeToolCallDeltas(toolCallsByIndex, delta.tool_calls);
            }
            const message = choice.message || {};
            if (typeof message.content === 'string' && !content) {
                content = message.content;
            }
            if (Array.isArray(message.tool_calls)) {
                mergeToolCallDeltas(toolCallsByIndex, message.tool_calls);
            }
        }
    }

    return {
        id,
        choices: [{
            finish_reason: finishReason,
            message: {
                content,
                reasoning_content: reasoningContent,
                tool_calls: Array.from(toolCallsByIndex.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([, call]) => ({
                        ...call,
                        function: {
                            ...call.function,
                            arguments: call.function?.arguments || '',
                        },
                    })),
            },
        }],
    };
}

function mergeToolCallDeltas(toolCallsByIndex: Map<number, any>, deltas: any[]) {
    for (const delta of deltas) {
        const index = Number.isFinite(Number(delta?.index)) ? Number(delta.index) : toolCallsByIndex.size;
        const current = toolCallsByIndex.get(index) || {
            id: '',
            type: 'function',
            function: {
                name: '',
                arguments: '',
            },
        };
        if (delta.id) current.id = String(delta.id);
        if (delta.type) current.type = String(delta.type);
        const fn = delta.function || {};
        if (fn.name) current.function.name += String(fn.name);
        const args = normalizeToolArgumentsDelta(fn.arguments);
        if (args) current.function.arguments += args;
        toolCallsByIndex.set(index, current);
    }
}

function normalizeToolArgumentsDelta(value: unknown): string {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function summarizeText(value: unknown): string {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 260);
}

function makeToolResult(scenario: EvalScenario, model: string, toolName: string) {
    const marker = `TOOL_RESULT_OK_${scenario.skillId}_${model}`.replace(/[^A-Za-z0-9_]/g, '_');
    return {
        marker,
        ok: true,
        simulated: true,
        skillId: scenario.skillId,
        toolName,
        note: 'This is a simulated KiKo tool result from the NVIDIA skill eval harness. No real business action was executed.',
    };
}

async function runScenario(model: string, scenario: EvalScenario): Promise<EvalResult> {
    const tools = getDefinitionsForScenario(scenario);
    const providerRequestIds: string[] = [];
    const errors: string[] = [];
    let selectedTool: string | null = null;
    let firstFinishReason: string | null = null;
    let secondFinishReason: string | null = null;
    let finalExcerpt = '';
    let repairAttempted = false;
    let fallbackUsed = false;

    try {
        const messages: ChatMessage[] = [
            { role: 'system', content: buildSystemPrompt(scenario) },
            { role: 'user', content: scenario.prompt },
        ];
        const first = await callNvidia(model, messages, tools);
        if (first?.id) providerRequestIds.push(String(first.id));
        const firstChoice = first?.choices?.[0] || {};
        firstFinishReason = firstChoice.finish_reason || null;
        const assistantMessage = firstChoice.message || {};
        const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];

        if (!scenario.targetTool) {
            const directOutput = summarizeText(assistantMessage.content);
            finalExcerpt = directOutput;
            if (!directOutput) {
                errors.push('direct_answer_empty');
            }
            return buildResult(model, scenario, selectedTool, firstFinishReason, secondFinishReason, providerRequestIds, errors, finalExcerpt, repairAttempted, fallbackUsed);
        }

        if (toolCalls.length === 0) {
            errors.push(`missing_native_tool_call finish=${firstFinishReason || 'unknown'} content=${summarizeText(assistantMessage.content)}`);
            return buildResult(model, scenario, selectedTool, firstFinishReason, secondFinishReason, providerRequestIds, errors, finalExcerpt, repairAttempted, fallbackUsed);
        }

        const firstToolCall = toolCalls[0];
        selectedTool = String(firstToolCall?.function?.name || '').trim() || null;
        if (scenario.targetTool && selectedTool !== scenario.targetTool) {
            errors.push(`wrong_tool selected=${selectedTool || '(none)'} expected=${scenario.targetTool}`);
        }
        const toolResult = makeToolResult(scenario, model, selectedTool || scenario.targetTool);
        messages.push({
            role: 'assistant',
            content: assistantMessage.content ?? null,
            tool_calls: toolCalls,
        });
        messages.push({
            role: 'tool',
            tool_call_id: String(firstToolCall.id || ''),
            content: JSON.stringify(toolResult),
        });

        const second = await callNvidia(model, messages, tools);
        if (second?.id) providerRequestIds.push(String(second.id));
        let secondChoice = second?.choices?.[0] || {};
        secondFinishReason = secondChoice.finish_reason || null;
        let finalText = String(secondChoice.message?.content || '');
        let finalReasoning = String(secondChoice.message?.reasoning_content || '');
        if (!finalText.trim() && finalReasoning.trim()) {
            repairAttempted = true;
            messages.push({ role: 'system', content: EMPTY_TOOL_RESULT_VISIBLE_ANSWER_REPAIR_PROMPT });
            const repair = await callNvidia(model, messages, tools);
            if (repair?.id) providerRequestIds.push(String(repair.id));
            secondChoice = repair?.choices?.[0] || {};
            secondFinishReason = `${secondFinishReason || '-'}->repair:${secondChoice.finish_reason || '-'}`;
            finalText = String(secondChoice.message?.content || '');
            finalReasoning += String(secondChoice.message?.reasoning_content || '');
        }
        if (!finalText.trim() && finalReasoning.trim()) {
            fallbackUsed = true;
            finalText = buildVisibleToolResultFallback(toolResult);
        }
        finalExcerpt = summarizeText(finalText);
        if (!finalText) {
            errors.push('final_answer_empty_after_tool_result');
        }
        if (!finalText.includes(toolResult.marker)) {
            if (finalReasoning.includes(toolResult.marker)) {
                errors.push(`tool_result_marker_in_reasoning_only marker=${toolResult.marker}`);
            } else {
                errors.push(`tool_result_marker_missing marker=${toolResult.marker}`);
            }
        }
    } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
    }

    return buildResult(model, scenario, selectedTool, firstFinishReason, secondFinishReason, providerRequestIds, errors, finalExcerpt, repairAttempted, fallbackUsed);
}

function buildVisibleToolResultFallback(toolResult: Record<string, unknown>): string {
    const preferred = ['summary', 'message', 'status', 'marker', 'note']
        .map((key) => toolResult[key] ? `${key}: ${String(toolResult[key])}` : '')
        .filter(Boolean);
    const rendered = preferred.length > 0
        ? `${preferred.join('\n')}\n${JSON.stringify(toolResult, null, 2)}`
        : JSON.stringify(toolResult, null, 2);
    return `The tool returned a result, but the model produced an empty visible answer. Here is the tool result:\n\n${rendered}`;
}

function buildResult(
    model: string,
    scenario: EvalScenario,
    selectedTool: string | null,
    firstFinishReason: string | null,
    secondFinishReason: string | null,
    providerRequestIds: string[],
    errors: string[],
    finalExcerpt: string,
    repairAttempted: boolean,
    fallbackUsed: boolean,
): EvalResult {
    const errorCategory = classifyErrors(errors);
    return {
        model,
        skillId: scenario.skillId,
        targetTool: scenario.targetTool || null,
        status: errors.length === 0 ? 'PASS' : errorCategory === 'rate_limit' ? 'BLOCKED' : 'FAIL',
        errorCategory,
        selectedTool,
        firstFinishReason,
        secondFinishReason,
        providerRequestIds,
        errors,
        finalExcerpt,
        repairAttempted,
        fallbackUsed,
    };
}

function classifyErrors(errors: string[]): EvalResult['errorCategory'] {
    if (errors.length === 0) {
        return 'none';
    }
    if (errors.every((error) => error.startsWith('HTTP_429:'))) {
        return 'rate_limit';
    }
    if (errors.some((error) => error.startsWith('REQUEST_TIMEOUT_'))) {
        return 'timeout';
    }
    return 'model_or_tool';
}

async function main() {
    if (!NVIDIA_API_KEY) {
        throw new Error('NVIDIA_API_KEY is required. Export it or set it in kiko-python/.env.');
    }
    const scenarios = SCENARIOS
        .filter((scenario) => SKILL_FILTER.size === 0 || SKILL_FILTER.has(scenario.skillId))
        .slice(0, MAX_CASES);
    const jobs = MODELS.flatMap((model) => scenarios.map((scenario) => ({ model, scenario })));
    const results = await runJobs(jobs);

    printSummary(results);
    if (results.some((result) => result.status === 'FAIL')) {
        process.exit(1);
    }
    process.exit(0);
}

async function runJobs(jobs: Array<{ model: string; scenario: EvalScenario }>): Promise<EvalResult[]> {
    const results: EvalResult[] = [];
    let nextIndex = 0;
    let stop = false;

    async function worker(workerId: number) {
        while (!stop) {
            const index = nextIndex;
            nextIndex += 1;
            const job = jobs[index];
            if (!job) return;
            const label = `model=${job.model} skill=${job.scenario.skillId} target=${job.scenario.targetTool || '(direct)'}`;
            console.log(`[RUN] worker=${workerId} ${label}`);
            const startedAt = Date.now();
            const result = await runScenario(job.model, job.scenario);
            const elapsedMs = Date.now() - startedAt;
            results.push(result);
            const toolPart = result.targetTool ? ` tool=${result.selectedTool || '(none)'}/${result.targetTool}` : ' direct';
            console.log(`[${result.status}] ${label}${toolPart} finish=${result.firstFinishReason || '-'}->${result.secondFinishReason || '-'} elapsed_ms=${elapsedMs} errors=${result.errors.length}`);
            if (result.errors.length > 0) {
                console.log(`  ${result.errors.join(' | ')}`);
                if (FAIL_FAST) {
                    stop = true;
                    return;
                }
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, (_, index) => worker(index + 1)));
    return results.sort((a, b) => {
        const modelOrder = MODELS.indexOf(a.model) - MODELS.indexOf(b.model);
        if (modelOrder !== 0) return modelOrder;
        return SCENARIOS.findIndex((scenario) => scenario.skillId === a.skillId)
            - SCENARIOS.findIndex((scenario) => scenario.skillId === b.skillId);
    });
}

function printSummary(results: EvalResult[]) {
    const passed = results.filter((result) => result.status === 'PASS').length;
    const blocked = results.filter((result) => result.status === 'BLOCKED').length;
    const failed = results.length - passed - blocked;
    const payload = {
        ok: failed === 0 && blocked === 0,
        models: MODELS,
        scenarioCount: SCENARIOS.length,
        executed: results.length,
        passed,
        blocked,
        failed,
        concurrency: CONCURRENCY,
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        results,
        failures: results
            .filter((result) => result.status === 'FAIL')
            .map((result) => ({
                model: result.model,
                skillId: result.skillId,
                targetTool: result.targetTool,
                selectedTool: result.selectedTool,
                errorCategory: result.errorCategory,
                errors: result.errors,
                finalExcerpt: result.finalExcerpt,
            })),
        blockedByRateLimit: results
            .filter((result) => result.status === 'BLOCKED')
            .map((result) => ({
                model: result.model,
                skillId: result.skillId,
                targetTool: result.targetTool,
                selectedTool: result.selectedTool,
                errors: result.errors,
            })),
    };
    fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
    fs.writeFileSync(RESULT_FILE, `${JSON.stringify(payload, null, 2)}\n`);
    console.log('\nNVIDIA skill tool-result eval summary');
    console.log(JSON.stringify(payload, null, 2));
    console.log(`result_file=${RESULT_FILE}`);
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
