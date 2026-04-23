import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChatContextSnapshot } from './contracts.js';
import { selectTaskRoute } from './taskRouteSelector.js';
import { resolveNodeSkills } from './nodeSkillResolver.js';
import { toolRegistry } from '../../tooling/registry.js';

function makeSnapshot(message: string, overrides: Partial<ChatContextSnapshot> = {}): ChatContextSnapshot {
    const { runtime: runtimeOverrides, ...restOverrides } = overrides;
    const runtime = {
        userSettings: {},
        toolContext: {},
        prefetchedToolResults: {},
        contextBlocks: {},
        ...(runtimeOverrides || {}),
    };
    return {
        sessionId: 'task-route-session',
        taskId: 'task-route-task',
        assistantMessageId: 'task-route-message',
        model: 'gpt-5.4-mini-2026-03-17',
        history: [{ role: 'user', content: message }],
        lastUserMessage: message,
        requestedTokenAddresses: [],
        requestedTokenSymbols: [],
        requestedAddressClassifications: [],
        toolDefinitions: toolRegistry.getAllDefinitions(),
        runtime,
        policySnapshot: null,
    } as ChatContextSnapshot;
}

test('selectTaskRoute keeps long social reference-image prompts on the image owner', async () => {
    const snapshot = makeSnapshot(
        'Read the whole Farcaster thread, keep the token context in mind, use the attached cast photo as the reference, and generate a polished launch poster for KIKO right now with the same subject pose and framing.',
        {
            runtime: {
                currentPage: 'farcaster',
                pageContext: 'farcaster_agent',
                socialInput: {
                    threadContextText: 'Parent cast and replies',
                    images: [{ url: 'https://example.com/kiko-ref.png', sourceLabel: 'cast image' }],
                },
            } as any,
            requestedTokenSymbols: ['KIKO'],
        },
    );
    let capturedMessages: any[] = [];

    const result = await selectTaskRoute({
        snapshot,
        generationClient: {
            async generate(params: any) {
                capturedMessages = params.messages || [];
                return {
                    text: JSON.stringify({
                        owner: 'image',
                        phase: 'execute',
                        facets: ['reference_image', 'social_thread', 'social_images'],
                        confidence: 0.98,
                        explanation: 'The user wants a generated image now; social and token context only support that output image task.',
                        entities: {
                            token_addresses: [],
                            token_symbols: ['KIKO'],
                            wallet_addresses: [],
                            market_identifiers: [],
                            image_refs: ['https://example.com/kiko-ref.png'],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        row_count: null,
                        inherit_entities_from_context: true,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                    }),
                    reasoning: '',
                    toolCalls: [],
                };
            },
        } as any,
    });

    assert.equal(result.state.status, 'ok');
    assert.equal(result.snapshot.taskRoute?.owner, 'image');
    assert.equal(result.snapshot.taskRoute?.phase, 'execute');
    assert.ok(result.snapshot.taskRoute?.facets.includes('reference_image'));
    assert.equal(result.snapshot.normalizedIntent?.intent, 'image_generation');
    const routeUserContent = capturedMessages.find((message) => message.role === 'user')?.content;
    assert.ok(Array.isArray(routeUserContent));
    assert.equal(routeUserContent[1]?.type, 'image_url');
    assert.equal(routeUserContent[1]?.image_url?.url, 'https://example.com/kiko-ref.png');
    const routePayload = JSON.parse(String(routeUserContent[0]?.text || '{}'));
    assert.deepEqual(routePayload.social_images, [
        {
            index: 1,
            label: 'cast image',
            url: 'https://example.com/kiko-ref.png',
        },
    ]);

    const resolution = resolveNodeSkills(result.snapshot, null, result.snapshot.normalizedIntent);
    assert.equal(resolution.toolPackageSource, 'task_route');
    assert.ok(resolution.allowedTools.includes('generate_image_from_intent'));
});

test('selectTaskRoute clears stale token carry-over for assistant_meta debug turns', async () => {
    const snapshot = makeSnapshot('Why did you answer with prompt advice instead of generating the image?', {
        requestedTokenSymbols: ['KIKO', 'WHAT'],
    });

    const result = await selectTaskRoute({
        snapshot,
        generationClient: {
            async generate() {
                return {
                    text: JSON.stringify({
                        owner: 'assistant_meta',
                        phase: 'analyze',
                        facets: ['behavior_debug'],
                        confidence: 0.97,
                        explanation: 'The user is asking about assistant behavior, not token analysis.',
                        entities: {
                            token_addresses: [],
                            token_symbols: [],
                            wallet_addresses: [],
                            market_identifiers: [],
                            image_refs: [],
                        },
                        requested_chain: null,
                        requested_time_window: null,
                        row_count: null,
                        inherit_entities_from_context: false,
                        locale: 'en',
                        needs_clarification: false,
                        clarification_question: null,
                    }),
                    reasoning: '',
                    toolCalls: [],
                };
            },
        } as any,
    });

    assert.equal(result.snapshot.taskRoute?.owner, 'assistant_meta');
    assert.equal(result.snapshot.normalizedIntent?.intent, 'assistant_meta');
    assert.equal(result.snapshot.normalizedIntent?.taskMode, 'analyze');
    assert.deepEqual(result.snapshot.requestedTokenSymbols, []);
});

test('selectTaskRoute marks invalid JSON explicitly', async () => {
    const result = await selectTaskRoute({
        snapshot: makeSnapshot('whatever'),
        generationClient: {
            async generate() {
                return {
                    text: 'not json',
                    reasoning: '',
                    toolCalls: [],
                };
            },
        } as any,
    });

    assert.equal(result.state.status, 'invalid');
    assert.equal(result.state.reasonCode, 'task_route_invalid_json');
    assert.equal(result.snapshot.taskRoute, null);
});
