// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: OpenAI-aligned live evaluation showed image prompt coaching still had
//         two regressions that ordinary routing tests did not catch: Chinese
//         edit-prompt wording such as “改图提示词” could miss `image_prompting`,
//         and prompt-coaching strategy notes did not explicitly tell the model
//         to load `read_skill_prompts` before replying.
// Goal: keep image prompt coaching routed and instructed tightly enough that
//       the main model can actually apply the OpenAI-first prompt playbook.
// Owns: regression coverage for image-prompt routing and prompt-coaching strategy notes.
// Does Not Own: runtime model behavior, external API calls, or the image prompt
//               playbook text itself.
// Design Language:
// - Chinese edit-prompt wording must count as image prompt coaching
// - prompt-coaching turns must explicitly load `read_skill_prompts`
// - OpenAI-first prompt coaching should not volunteer non-OpenAI variants by default
// Document Provenance:
// - Source: OpenAI GPT-image-1.5 Prompting Guide
//   - Kind: official API doc
//   - Retrieved: 2026-04-19
//   - Applied To: OpenAI-first prompt coaching expectations
//   - Verification: verified in docs
// - Source: local OpenAI-aligned live eval of image prompt coaching turns
//   - Kind: runtime observation
//   - Retrieved: 2026-04-19
//   - Applied To: routing and strategy-note regression coverage
//   - Verification: verified in runtime and code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/image-prompt-guidance.md
// - /Users/almurat/KiKo/system-journal/owner-map/image-prompt-skills.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-openai-alignment-eval.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-image-prompt-skill-provenance.md

import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleGenerationMessages } from './nodePromptAssembler.js';
import type { ChatContextSnapshot } from './contracts.js';
import { ReadSkillPromptsTool } from './contextReadTools.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { toolRegistry } from '../../tooling/registry.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    return {
        sessionId: 'image-prompting-eval-session',
        taskId: 'image-prompting-eval-task',
        model: 'gpt-5.4-mini-2026-03-17',
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
        },
        recentToolTrace: {
            messageId: 'assistant-image-prompting-eval',
            toolCalls: [],
        },
        conversationActionState: {
            pendingAction: 'none',
            canExecute: false,
            needsClarification: false,
            clarificationQuestion: null,
        },
        ...overrides,
    } as ChatContextSnapshot;
}

test('routes Chinese edit-prompt wording to image_prompting', () => {
    const resolution = resolveNodeSkills(
        makeSnapshot('帮我写一个更准确的改图提示词：只把这张产品图的背景改成米白色，保留瓶子角度、标签、光影和构图。'),
        null,
    );

    assert.ok(resolution.selectedSkills.includes('image_prompting'));
    assert.ok(!resolution.selectedSkills.includes('image_generation'));
});

test('image prompt coaching strategy explicitly requires read_skill_prompts and stays OpenAI-first', () => {
    const resolution = resolveNodeSkills(
        makeSnapshot('帮我优化一个图片提示词：我要做一张冷萃咖啡新品海报。'),
        null,
    );

    assert.ok(
        resolution.strategyNotes.some((note) => note.includes('Call read_skill_prompts before answering')),
    );
    assert.ok(
        resolution.strategyNotes.some((note) => note.includes('Do not volunteer Midjourney, Stable Diffusion')),
    );
});

test('read_skill_prompts description covers image prompt coaching', () => {
    assert.match(
        ReadSkillPromptsTool.definition.description,
        /image prompt coaching\/edit-preserve guidance/i,
    );
});

test('prompt assembly adds a system rule to load skill prompts before prompt-coaching answers', () => {
    const snapshot = makeSnapshot('帮我优化一个图片提示词：我要做一张冷萃咖啡新品海报。');
    const resolution = resolveNodeSkills(snapshot, null);
    const messages = assembleGenerationMessages(
        snapshot,
        resolution.skillPrompts,
        {
            provider: 'openai',
            model: snapshot.model,
            supportsNativeSearch: false,
            supportsPreviousResponse: true,
        },
        {
            preferredTools: resolution.preferredTools,
            strategyNotes: resolution.strategyNotes,
            allowAllTools: resolution.allowAllTools,
            rankedMatches: resolution.rankedMatches,
            searchMode: resolution.searchMode,
            searchReason: resolution.searchReason,
            toolPhase: resolution.currentPhase,
            intentEnvelope: resolution.intentEnvelope,
            contextContract: resolution.contextContract,
        },
    );

    const systemContent = String(messages.find((message) => message.role === 'system')?.content || '');
    assert.match(
        systemContent,
        /call read_skill_prompts before drafting the answer/i,
    );
});
