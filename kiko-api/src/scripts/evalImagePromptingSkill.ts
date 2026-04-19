// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: Prompt routing and prompt text alone were not enough to prove that
//         the main model actually loaded and used the `image_prompting` skill.
//         Product now needs a repeatable OpenAI-aligned live eval that checks
//         both skill routing and final answer shape against the prompt-writing
//         playbook used for image prompt coaching.
// Goal: provide a small live evaluation harness that verifies OpenAI-mainline
//       models can load `read_skill_prompts` and produce OpenAI-first,
//       copy-ready image prompt coaching replies.
// Owns: ad hoc live evaluation of image prompt coaching quality.
// Does Not Own: production routing, provider billing policy, or image
//               generation execution.
// Design Language:
// - live eval should reuse the real chat routing and prompt assembly path
// - image prompt coaching passes only if `read_skill_prompts` is actually used
// - OpenAI-first prompt coaching should stay copy-ready and avoid unsolicited non-OpenAI variants
// - each scenario should test one OpenAI prompting pattern clearly
// Document Provenance:
// - Source: OpenAI GPT-image-1.5 Prompting Guide
//   - Kind: official API doc
//   - Retrieved: 2026-04-19
//   - Applied To: eval rubric for structure, edit-preserve phrasing,
//     text-in-image handling, and photorealism cues
//   - Verification: verified in docs
// - Source: OpenAI Image generation guide
//   - Kind: official API doc
//   - Retrieved: 2026-04-19
//   - Applied To: iterative editing framing and prompt-rewrite expectations
//   - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/image-prompt-guidance.md
// - /Users/almurat/KiKo/system-journal/owner-map/image-prompt-skills.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-openai-alignment-eval.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md

import { assembleGenerationMessages } from '../jobs/chat/nodePromptAssembler.js';
import { CHAT_CONTEXT_READ_TOOLS } from '../jobs/chat/contextReadTools.js';
import type { ChatContextSnapshot } from '../jobs/chat/contracts.js';
import { resolveNodeSkills } from '../jobs/chat/nodeSkillResolver.js';
import { toolRegistry } from '../tooling/registry.js';

type EvalCase = {
    id: string;
    prompt: string;
    check(output: string): string[];
};

type EvalResult = {
    id: string;
    selectedSkills: string[];
    usedTools: string[];
    output: string;
    failures: string[];
};

const MODEL = process.env.IMAGE_PROMPT_EVAL_MODEL || 'gpt-5.4-mini-2026-03-17';
const OPENAI_API_URL = String(process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions').trim();

const CASES: EvalCase[] = [
    {
        id: 'poster_text',
        prompt: '帮我优化一个图片提示词：我要做一张冷萃咖啡新品海报，画面高级一点，要有英文文案 Fresh Brew，但现在总是出得很乱。',
        check(output) {
            const failures: string[] = [];
            if (!/[“"]Fresh Brew[”"]/.test(output)) {
                failures.push('缺少带引号的精确文案');
            }
            if (!/(字体|排版|版式|布局|placement|layout)/i.test(output)) {
                failures.push('缺少文字版式或排版约束');
            }
            if (!/负向约束/.test(output)) {
                failures.push('缺少负向约束段落');
            }
            return failures;
        },
    },
    {
        id: 'edit_preserve',
        prompt: '帮我写一个更准确的改图提示词：只把这张产品图的背景改成米白色，保留瓶子角度、标签、光影和构图，别改别的。',
        check(output) {
            const failures: string[] = [];
            if (!/(只改|只修改|仅修改).*(背景)/s.test(output)) {
                failures.push('缺少只改背景的编辑边界');
            }
            if (!/(保持|保留).*(角度|标签|光影|构图)/s.test(output)) {
                failures.push('缺少明确的 preserve 列表');
            }
            if (!/负向约束/.test(output)) {
                failures.push('缺少负向约束段落');
            }
            return failures;
        },
    },
    {
        id: 'portrait_realism',
        prompt: '告诉我怎么把提示词写得更像 OpenAI 教程里那种真实感人像图：一个三十岁左右的亚洲女性，窗边自然光，像真实照片，不要假。',
        check(output) {
            const failures: string[] = [];
            if (!/(镜头|85mm|50mm|lens|f\/)/i.test(output)) {
                failures.push('缺少镜头或摄影参数语言');
            }
            if (!/(自然光|侧光|lighting|framing|构图)/i.test(output)) {
                failures.push('缺少光线或构图语言');
            }
            if (!/(肤质|纹理|texture|磨皮|imperfection|pores)/i.test(output)) {
                failures.push('缺少真实质感约束');
            }
            return failures;
        },
    },
];

function makeSnapshot(message: string): ChatContextSnapshot {
    return {
        sessionId: 'image-prompting-live-eval-session',
        taskId: 'image-prompting-live-eval-task',
        model: MODEL,
        history: [{ role: 'user', content: message }],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        toolDefinitions: toolRegistry.getAllDefinitions(),
        policySnapshot: null,
        runtime: {
            contextBlocks: {},
            userSettings: {},
            toolContext: {},
            prefetchedToolResults: {},
            currentPage: 'chat',
            pageContext: 'ordinary chat',
        },
        recentToolTrace: {
            messageId: 'assistant-image-prompting-live-eval',
            toolCalls: [],
        },
        conversationActionState: {
            pendingAction: 'none',
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        },
    } as ChatContextSnapshot;
}

async function callModel(messages: any[], tools: any[]) {
    const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for evalImagePromptingSkill.ts');
    }
    const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: MODEL,
            temperature: 0.2,
            messages,
            tools,
            tool_choice: 'auto',
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`OpenAI request failed (${response.status}): ${JSON.stringify(data)}`);
    }
    return data;
}

function summarizeOutput(output: string): string {
    const normalized = String(output || '').replace(/\s+/g, ' ').trim();
    return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized;
}

async function runCase(testCase: EvalCase): Promise<EvalResult> {
    const snapshot = makeSnapshot(testCase.prompt);
    const resolution = resolveNodeSkills(snapshot, null);
    // CONTEXT MEMORY
    // Updated: 2026-04-19
    // Author: Rowan
    // Reason: the live eval snapshot needs to carry resolved skill prompts even
    //         though the shared ChatContext runtime type does not yet expose
    //         that field directly.
    // Goal: keep the eval harness compiling while still checking the real
    //       prompt-routing payload.
    snapshot.runtime = {
        ...snapshot.runtime,
        skillPrompts: resolution.skillPrompts,
        executionPlan: null,
        providerNativeEvidence: [],
    } as ChatContextSnapshot['runtime'] & { skillPrompts: string[] };

    const messages = assembleGenerationMessages(snapshot, resolution.skillPrompts, {
        provider: 'openai',
        model: MODEL,
        supportsNativeSearch: false,
        supportsPreviousResponse: true,
    }, {
        preferredTools: resolution.preferredTools,
        strategyNotes: resolution.strategyNotes,
        allowAllTools: resolution.allowAllTools,
        rankedMatches: resolution.rankedMatches,
        searchMode: resolution.searchMode,
        searchReason: resolution.searchReason,
        toolPhase: resolution.currentPhase,
        intentEnvelope: resolution.intentEnvelope,
        contextContract: resolution.contextContract,
        executionPlan: null,
        providerNativeEvidence: [],
    }).map((message) => ({ ...message }));

    const toolSchema = CHAT_CONTEXT_READ_TOOLS.map((tool) => ({
        type: 'function',
        function: tool.definition,
    }));
    const toolMap = new Map(CHAT_CONTEXT_READ_TOOLS.map((tool) => [tool.definition.name, tool]));
    const transcript: any[] = [...messages];
    const usedTools: string[] = [];
    let finalOutput = '';

    for (let attempt = 0; attempt < 8; attempt += 1) {
        const data = await callModel(transcript, toolSchema);
        const assistantMessage = data.choices?.[0]?.message;
        if (!assistantMessage) {
            throw new Error(`No assistant message returned for ${testCase.id}`);
        }
        transcript.push(assistantMessage);
        const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
        if (toolCalls.length === 0) {
            finalOutput = String(assistantMessage.content || '').trim();
            break;
        }
        for (const call of toolCalls) {
            const toolName = String(call?.function?.name || '').trim();
            if (!toolName) continue;
            usedTools.push(toolName);
            const tool = toolMap.get(toolName);
            const parsedArgs = (() => {
                try {
                    return call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
                } catch {
                    return {};
                }
            })();
            const result = tool
                ? await tool.handler(parsedArgs, {
                    __snapshot: snapshot,
                    __chatContextRuntime: snapshot.runtime,
                } as any)
                : { available: false, error: `Tool ${toolName} is unavailable in the eval harness.` };
            transcript.push({
                role: 'tool',
                tool_call_id: call.id,
                content: JSON.stringify(result),
            });
        }
    }

    const failures: string[] = [];
    if (!resolution.selectedSkills.includes('image_prompting')) {
        failures.push('没有路由到 image_prompting');
    }
    if (!usedTools.includes('read_skill_prompts')) {
        failures.push('主模型没有实际调用 read_skill_prompts');
    }
    if (!finalOutput) {
        failures.push('没有拿到最终文本输出');
    }
    if (/Midjourney|Stable Diffusion|\bSD\b/i.test(finalOutput)) {
        failures.push('输出主动漂移到非 OpenAI 模型变体');
    }
    failures.push(...testCase.check(finalOutput));

    return {
        id: testCase.id,
        selectedSkills: resolution.selectedSkills,
        usedTools: Array.from(new Set(usedTools)),
        output: finalOutput,
        failures,
    };
}

async function main() {
    const results: EvalResult[] = [];
    for (const testCase of CASES) {
        results.push(await runCase(testCase));
    }

    let failed = false;
    for (const result of results) {
        const status = result.failures.length === 0 ? 'PASS' : 'FAIL';
        if (status === 'FAIL') failed = true;
        console.log(`\n[${status}] ${result.id}`);
        console.log(`selected_skills=${result.selectedSkills.join(',') || '(none)'}`);
        console.log(`used_tools=${result.usedTools.join(',') || '(none)'}`);
        console.log(`output=${summarizeOutput(result.output)}`);
        if (result.failures.length > 0) {
            console.log(`failures=${result.failures.join(' | ')}`);
        }
    }

    if (failed) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
}).finally(() => {
    process.exit(process.exitCode ?? 0);
});
