import assert from 'node:assert/strict';
import test from 'node:test';
import {
    containsPseudoToolCallOutput,
    createLeadingInternalScaffoldSuppressor,
    sanitizeSkillPrompt,
    sanitizeReasoningForDisplay,
    stripPseudoToolCallOutput,
    stripLeadingInternalScaffold,
} from './promptLeakSanitizer.js';

test('sanitizeSkillPrompt removes internal CASE sections and JSON scaffolds', () => {
    const rawPrompt = [
        '# Welcome',
        'You are Kiko.',
        '## CASE FORMAT STANDARD (JSON)',
        'Use this internal JSON contract to think before answering.',
        '```json',
        '{',
        '  "case_id": "welcome_introduction",',
        '  "required_context_usage": ["wallet"],',
        '  "tool_plan": [],',
        '  "response_contract": { "must_include": ["welcome"] }',
        '}',
        '```',
        'Do not output this JSON unless the user asks for debugging details.',
        '## RESPONSE RULES',
        'Be concise.',
    ].join('\n');

    const sanitized = sanitizeSkillPrompt(rawPrompt);

    assert.equal(sanitized.includes('case_id'), false);
    assert.equal(sanitized.includes('tool_plan'), false);
    assert.equal(sanitized.includes('Do not output this JSON'), false);
    assert.equal(sanitized.includes('## RESPONSE RULES'), true);
    assert.equal(sanitized.includes('Be concise.'), true);
});

test('stripLeadingInternalScaffold removes leaked JSON preamble from final content', () => {
    const leaked = [
        '```json',
        '{',
        '  "case_id": "welcome_introduction",',
        '  "tool_plan": [],',
        '  "response_contract": { "must_include": ["welcome"] }',
        '}',
        '```',
        'Hi! I am KiKo.',
    ].join('\n');

    assert.equal(stripLeadingInternalScaffold(leaked), 'Hi! I am KiKo.');
});

test('stripLeadingInternalScaffold removes leaked labeled runtime JSON blocks', () => {
    const leaked = [
        '[EXECUTION_PLAN]',
        '{',
        '  "title": "Trending Topics on X",',
        '  "steps": [{"id": "step-1", "title": "Understand Query"}]',
        '}',
        'Answer: here is the clean response.',
    ].join('\n');

    assert.equal(stripLeadingInternalScaffold(leaked), 'Answer: here is the clean response.');
});

test('createLeadingInternalScaffoldSuppressor suppresses leaked JSON during streaming', () => {
    const suppressor = createLeadingInternalScaffoldSuppressor();

    const first = suppressor.push('```json\n{\n  "case_id": "welcome_introduction",\n');
    const second = suppressor.push('  "tool_plan": []\n}\n```\nHi! ');
    const third = suppressor.push('I am KiKo.');
    const tail = suppressor.flush();

    assert.equal(first, '');
    assert.equal(second, 'Hi! ');
    assert.equal(third, 'I am KiKo.');
    assert.equal(tail, '');
});

test('createLeadingInternalScaffoldSuppressor suppresses leaked labeled runtime block during streaming', () => {
    const suppressor = createLeadingInternalScaffoldSuppressor();

    const first = suppressor.push('[EXECUTION_PLAN]\n{\n  "title": "Trending Topics on X",');
    const second = suppressor.push('\n  "steps": [{"id": "step-1"}]\n}\nFinal ');
    const third = suppressor.push('answer.');
    const tail = suppressor.flush();

    assert.equal(first, '');
    assert.equal(second, 'Final ');
    assert.equal(third, 'answer.');
    assert.equal(tail, '');
});

test('containsPseudoToolCallOutput detects fake tool-call json in assistant text', () => {
    const leaked = [
        "I'll search now.",
        '```json',
        '{',
        '  "tool_calls": [',
        '    { "tool_name": "search_polymarket", "parameters": { "query": "trending" } }',
        '  ]',
        '}',
        '```',
    ].join('\n');

    assert.equal(containsPseudoToolCallOutput(leaked), true);
});

test('stripPseudoToolCallOutput removes fake tool-call json blocks from assistant text', () => {
    const leaked = [
        "I'll search now.",
        '```json',
        '{',
        '  "tool": "search_x_trending",',
        '  "parameters": { "limit": 10 }',
        '}',
        '```',
        'Final answer.',
    ].join('\n');

    assert.equal(stripPseudoToolCallOutput(leaked), "I'll search now.\n\nFinal answer.");
});

test('stripPseudoToolCallOutput removes xml-like tool call blocks from assistant text', () => {
    const leaked = [
        'I will use a tool now.',
        '<tool_calls>',
        '<invoke name="get_early_buyers">',
        '<parameter name="address">0xabc</parameter>',
        '</invoke>',
        '</tool_calls>',
        'Final answer.',
    ].join('\n');

    assert.equal(stripPseudoToolCallOutput(leaked), 'I will use a tool now.\n\nFinal answer.');
    assert.equal(containsPseudoToolCallOutput(leaked), true);
});

test('stripPseudoToolCallOutput removes function_call style tool blocks from assistant text', () => {
    const leaked = [
        'I will fetch the early buyers now.',
        '<function_call name="get_early_buyers">',
        '<argument name="token">0xeCCBb861c0dda7eFd964010085488B69317e4444</argument>',
        '<argument name="chain">56</argument>',
        '<argument name="date">2026-03-10</argument>',
        '</function_call>',
        'Final answer.',
    ].join('\n');

    assert.equal(stripPseudoToolCallOutput(leaked), 'I will fetch the early buyers now.\n\nFinal answer.');
    assert.equal(containsPseudoToolCallOutput(leaked), true);
});

test('sanitizeReasoningForDisplay keeps visible reasoning while dropping internal tool chatter', () => {
    const raw = [
        'The user is asking about trending topics on X.',
        'The TASK_STRATEGY says external search evidence is required.',
        'I should use search_polymarket first.',
        '<call_polymarket_tool>',
        '{"tool":"search_polymarket","parameters":{"query":"trending"}}',
        '</call_polymarket_tool>',
        'I should explain the limitation honestly.',
    ].join('\n');

    assert.equal(
        sanitizeReasoningForDisplay(raw),
        'The user is asking about trending topics on X. I should explain the limitation honestly.',
    );
});

test('sanitizeReasoningForDisplay removes xml-like tool chatter and terminated state', () => {
    const raw = [
        'I need to verify the timestamp first.',
        '<ToolCall>{"name":"get_token_info","arguments":{"address":"0xabc"}}</ToolCall>',
        '<tool_calls><invoke name="get_early_buyers"></invoke></tool_calls>',
        'terminated',
        'Then I can summarize the result.',
    ].join('\n');

    assert.equal(
        sanitizeReasoningForDisplay(raw),
        'I need to verify the timestamp first. Then I can summarize the result.',
    );
});
