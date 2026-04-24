import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRuntimeDirectives } from './runtimeDirectiveResolver.js';

test('resolveRuntimeDirectives adds a Farcaster public reply style directive in Farcaster agent context', () => {
    const directives = resolveRuntimeDirectives({
        task: {
            toolContext: {
                pageContext: 'farcaster_agent',
                currentPage: 'farcaster',
            },
        },
        lastUserMessage: 'What is this token?',
        confirmationState: null,
    });

    const farcasterDirective = directives.find((directive) => directive.kind === 'farcaster_public_reply_style');
    assert.ok(farcasterDirective);
    assert.match(farcasterDirective?.message || '', /short, natural reply/i);
    assert.match(farcasterDirective?.message || '', /Lead with the direct answer/i);

    const executionDirective = directives.find((directive) => directive.kind === 'social_agent_single_turn_execution');
    assert.ok(executionDirective);
    assert.match(executionDirective?.message || '', /do not ask for a second chat confirmation/i);
});

test('resolveRuntimeDirectives adds single-turn execution guidance in X agent context', () => {
    const directives = resolveRuntimeDirectives({
        task: {
            toolContext: {
                pageContext: 'x_agent',
                currentPage: 'x',
                socialInput: { platform: 'x' },
            },
        },
        lastUserMessage: 'Deploy this token',
        confirmationState: null,
    });

    const executionDirective = directives.find((directive) => directive.kind === 'social_agent_single_turn_execution');
    assert.ok(executionDirective);
    assert.match(executionDirective?.message || '', /X\/Farcaster @mention agent turn/i);
    assert.match(executionDirective?.message || '', /call the executable tool directly/i);
});
