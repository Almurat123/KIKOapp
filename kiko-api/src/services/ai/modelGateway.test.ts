import assert from 'node:assert/strict';
import test from 'node:test';
import { DeployClankerTokenTool } from '../../skills/ClankerSkill/index.js';
import { modelGateway } from './modelGateway.js';

test('modelGateway makes nested tool schemas strict for Clanker deploy', () => {
    const prepared = modelGateway.prepareRequest({
        model: 'gpt-5.4-mini-2026-03-17',
        provider: 'openai',
        system: 'system',
        messages: [],
        tools: [
            {
                type: 'function',
                function: DeployClankerTokenTool.definition,
            },
        ],
    });

    const deployTool = prepared.requestBody.tools?.[0]?.function;
    assert.ok(deployTool, 'expected deploy tool in prepared request');
    assert.equal(deployTool.parameters.additionalProperties, false);
    assert.equal(deployTool.parameters.properties.devBuy.additionalProperties, false);
    assert.equal(deployTool.parameters.properties.devBuy.properties.poolKey.additionalProperties, false);
    assert.equal(deployTool.parameters.properties.rewards.items.additionalProperties, false);
    assert.equal(deployTool.parameters.properties.pool.additionalProperties, false);
    assert.equal(deployTool.parameters.properties.fees.additionalProperties, false);
});

test('modelGateway promotes optional fields to nullable and marks all properties required', () => {
    const prepared = modelGateway.prepareRequest({
        model: 'gpt-5.4-mini-2026-03-17',
        provider: 'openai',
        system: 'system',
        messages: [],
        tools: [
            {
                type: 'function',
                function: {
                    name: 'generate_image_from_intent',
                    description: 'Generate an image.',
                    parameters: {
                        type: 'object',
                        properties: {
                            user_intent: { type: 'string' },
                            style_hint: { type: 'string' },
                            reference_image: {
                                type: 'object',
                                properties: {
                                    url: { type: 'string' },
                                    caption: { type: 'string' },
                                },
                                required: ['url'],
                            },
                        },
                        required: ['user_intent'],
                    },
                },
            },
        ],
    });

    const tool = prepared.requestBody.tools?.[0]?.function;
    assert.ok(tool, 'expected tool in prepared request');
    assert.deepEqual(tool.parameters.required, ['user_intent', 'style_hint', 'reference_image']);
    assert.deepEqual(tool.parameters.properties.style_hint.type, ['string', 'null']);
    assert.equal(tool.parameters.properties.reference_image.additionalProperties, false);
    assert.deepEqual(tool.parameters.properties.reference_image.required, ['url', 'caption']);
    assert.deepEqual(tool.parameters.properties.reference_image.properties.caption.type, ['string', 'null']);
});
