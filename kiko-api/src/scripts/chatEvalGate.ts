import fs from 'node:fs';
import path from 'node:path';
import { contextBudgetManager } from '../services/ai/contextBudgetManager.js';
import { modelGateway } from '../services/ai/modelGateway.js';

interface EvalCase {
  id: string;
  category: string;
  input: string;
}

function loadJsonl(filePath: string): EvalCase[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.map((line, idx) => {
    const parsed = JSON.parse(line);
    return {
      id: parsed.id || `case_${idx + 1}`,
      category: parsed.category || 'general',
      input: String(parsed.input || ''),
    };
  });
}

function run(): number {
  const filePath = path.resolve(process.cwd(), 'src/evals/chat_golden_set.jsonl');
  const cases = loadJsonl(filePath);

  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    try {
      const history = Array.from({ length: 24 }).map((_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `${c.input} #${i} `.repeat(60),
      }));
      const budget = contextBudgetManager.applyBudget(history, {
        recentWindow: 12,
        maxInputTokens: 1400,
        reservedOutputTokens: 300,
      });

      const gateway = modelGateway.prepareRequest({
        model: 'gpt-5-mini',
        provider: 'openai',
        system: 'You are KiKo assistant.',
        messages: budget.messages,
        tools: [
          {
            type: 'function',
            function: {
              name: 'external_web_search',
              description: 'Search web',
              parameters: {
                type: 'object',
                properties: {
                  q: { type: 'string' },
                },
                required: ['q'],
              },
            },
          },
        ],
        allowedTools: { names: ['external_web_search'] },
        stream: true,
      });

      if (!gateway.requestBody.tools?.length) throw new Error('tools missing');
      if (budget.messages.length > 12) throw new Error('budget not applied');
      passed += 1;
    } catch (err: any) {
      failed += 1;
      console.error(`[eval][${c.id}] failed: ${err?.message || err}`);
    }
  }

  const passRate = cases.length === 0 ? 0 : (passed / cases.length) * 100;
  console.log(JSON.stringify({ total: cases.length, passed, failed, passRate: Number(passRate.toFixed(2)) }));

  // Eval gate: require >= 99% pass rate
  return passRate >= 99 ? 0 : 1;
}

process.exit(run());
