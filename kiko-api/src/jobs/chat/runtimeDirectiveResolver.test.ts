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
});

