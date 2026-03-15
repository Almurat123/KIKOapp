import assert from 'node:assert/strict';
import test from 'node:test';
import {
    createLeadingInternalScaffoldSuppressor,
    sanitizeSkillPrompt,
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
