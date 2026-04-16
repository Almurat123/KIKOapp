import assert from 'node:assert/strict';
import test from 'node:test';

import { promptOrchestrator } from '../ai/PromptOrchestrator.js';

test('shared system prompt no longer forces conclusion-evidence-next-step formatting', () => {
  const prompt = promptOrchestrator.getSystemPrompt('nvidia', 'TRADING', { routingMode: 'execution' });

  assert.ok(!prompt.includes('Structure output as: conclusion, evidence, next step.'));
  assert.match(prompt, /Do NOT force a fixed template such as "Conclusion \/ Evidence \/ Next step"/);
  assert.match(prompt, /Prefer natural prose by default/);
});

test('grok system prompt inherits the same adaptive output-style guidance', () => {
  const prompt = promptOrchestrator.getSystemPrompt('grok', 'TRADING', { routingMode: 'execution' });

  assert.ok(!prompt.includes('Structure output as: conclusion, evidence, next step.'));
  assert.match(prompt, /Avoid repetitive self-similar wording across turns/);
});
