import * as dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseIntent } from '../services/ai/intentParser.js';
import { promptOrchestrator } from '../services/ai/PromptOrchestrator.js';
import type { ModelType, UserContext } from '../services/ai/types.js';
import { skillRegistry } from '../skills/registry.js';

type Scenario = {
  name: string;
  model: ModelType;
  query: string;
  context: UserContext;
};

function maskAddress(addr?: string) {
  if (!addr) return undefined;
  if (addr.startsWith('0x') && addr.length >= 10) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  if (addr.length >= 10) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr;
}

function simulateAgentPlan(parsed: Awaited<ReturnType<typeof parseIntent>>, context: UserContext): string[] {
  const steps: string[] = [];

  const intent = parsed.highLevel.type;
  const contractAddress = parsed.contractAddress;
  const isTrading = intent === 'TRADING';

  if (isTrading) {
    const hasAmount = Boolean(parsed.swapIntent?.amount);
    const chainOk = Boolean(context.chainId);
    const hasPendingToken = Boolean(context.pendingSwapToken?.address);
    const hasTokenOut = Boolean(parsed.swapIntent?.tokenOut) || Boolean(contractAddress);

    if (!hasTokenOut && !hasPendingToken) {
      steps.push('ASK: token contract/address (to avoid symbol ambiguity)');
      return steps;
    }
    if (!chainOk) {
      steps.push('ASK: chain (Base/Eth/Solana/BSC)');
      return steps;
    }
    if (!hasAmount && !(context.toolConfig as any)?.defaultSwapAmount) {
      steps.push('ASK: amount to trade');
      return steps;
    }

    if (contractAddress) {
      steps.push('TOOL: get_token_info (confirm metadata / launchpad)');
    }

    const checkTokenBeforeSwap = Boolean((context.toolConfig as any)?.checkTokenBeforeSwap);
    if (checkTokenBeforeSwap) {
      steps.push('TOOL: check_token_risk (required by user settings)');
    }

    steps.push('TOOL: prepare_swap_transaction (prepare or execute based on user settings)');
    return steps;
  }

  if (intent === 'RISK_SCAN') {
    if (contractAddress) steps.push('TOOL: check_token_risk');
    else steps.push('ASK: token contract/address for risk scan');
    return steps;
  }

  if (intent === 'MARKET_ANALYSIS') {
    if (contractAddress) steps.push('TOOL: get_token_info');
    else steps.push('TOOL: search_token (if available) or ask for contract');
    return steps;
  }

  if (intent === 'SOCIAL_SENSING') {
    steps.push('TOOL: social_trending / social_user_info (depending on query)');
    return steps;
  }

  if (intent === 'COPY_TRADING') {
    steps.push('TOOL: follow_wallet / copytrade setup (depending on tools)');
    return steps;
  }

  if (intent === 'PREDICTION_MARKETS') {
    steps.push('TOOL: polymarket_* (event/odds)');
    return steps;
  }

  steps.push('NO TOOL: answer directly or ask 1 question');
  return steps;
}

function hasTradingPolicy(systemPrompt: string) {
  return systemPrompt.includes('Trading policy (v2):');
}

function hasIntentPolicy(systemPrompt: string) {
  return systemPrompt.includes('Intent policy (v2):');
}

function hasToolList(systemPrompt: string) {
  return systemPrompt.includes('**AVAILABLE TOOLS (Auto-Generated)**') || systemPrompt.includes('- `');
}

function mentionsSearchTools(systemPrompt: string) {
  return systemPrompt.includes('x_search') || systemPrompt.includes('web_search') || systemPrompt.includes('external_web_search');
}

async function run() {
  // Force v2 for this audit run (user said: always use new version).
  process.env.PROMPT_SYSTEM_VERSION = 'v2';

  const baseContext: UserContext = {
    isWalletConnected: true,
    chainId: 8453,
    chainName: 'Base',
    userAddress: '0x1111111111111111111111111111111111111111',
    nativeBalance: '0.42',
    balance: { USDC: '250.00', ETH: '0.12' },
    toolConfig: {
      quickSwapMode: true,
      checkTokenBeforeSwap: false,
      swapMethod: 'confirm',
      defaultSwapAmount: 10,
      defaultSwapUnit: 'usd',
      slippageMode: 'auto',
      mevProtection: true,
      priceDeviationCheck: true,
      userRole: 'trader',
    },
  };

  const solContext: UserContext = {
    isWalletConnected: true,
    chainId: 900,
    chainName: 'Solana',
    solanaAddress: '11111111111111111111111111111111',
    nativeBalance: '1.5',
    toolConfig: {
      quickSwapMode: true,
      checkTokenBeforeSwap: false,
      swapMethod: 'confirm',
      defaultSwapAmount: 0.01,
      defaultSwapUnit: 'native',
    },
  };

  const scenarios: Scenario[] = [
    {
      name: 'Trading (explicit pair + amount)',
      model: 'grok',
      query: 'Swap 100 USDC to ETH on Base',
      context: baseContext,
    },
    {
      name: 'Trading (contract + amount)',
      model: 'grok',
      query: 'Buy 0x4200000000000000000000000000000000000006 with 0.05 ETH',
      context: baseContext,
    },
    {
      name: 'Trading (sell all)',
      model: 'grok',
      query: 'Sell all my USDC on Base for ETH',
      context: baseContext,
    },
    {
      name: 'Trading (missing amount; should ask 1)',
      model: 'grok',
      query: 'Buy 0x4200000000000000000000000000000000000006',
      context: { ...baseContext, toolConfig: { ...(baseContext.toolConfig as any), defaultSwapAmount: undefined } },
    },
    {
      name: 'Risk only',
      model: 'grok',
      query: 'Is 0x4200000000000000000000000000000000000006 safe? honeypot?',
      context: baseContext,
    },
    {
      name: 'Market analysis',
      model: 'grok',
      query: 'Show me ETH price and 24h change on Base',
      context: baseContext,
    },
    {
      name: 'Prediction market',
      model: 'grok',
      query: 'Polymarket odds for Trump to win?',
      context: baseContext,
    },
    {
      name: 'Copy trade',
      model: 'grok',
      query: '跟单这个钱包 0x1234567890abcdef1234567890abcdef12345678',
      context: baseContext,
    },
    {
      name: 'Social sensing',
      model: 'grok',
      query: 'Farcaster trending tokens today',
      context: baseContext,
    },
    {
      name: 'Solana trading (contract, defaults)',
      model: 'grok',
      query: '用SOL买这个 7vfCXT3kZk1xJrXh4g7yq9uW8nQvY8n7xq3qZzZzZzZz',
      context: solContext,
    },
    {
      name: 'Trading narrative (why pumping + should I buy)',
      model: 'grok',
      query: 'Why is this token pumping and should I buy? 0x4200000000000000000000000000000000000006',
      context: baseContext,
    },
  ];

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '../../..');
  const outPath = path.join(repoRoot, 'test', 'prompt_audit.md');

  const lines: string[] = [];
  lines.push(`# Prompt System Audit`);
  lines.push(``);
  lines.push(`- Time (UTC): ${new Date().toISOString()}`);
  lines.push(`- PROMPT_SYSTEM_VERSION: v2 (forced in script)`);
  lines.push(``);

  // Skills inventory
  const allSkills = skillRegistry.getAllSkills();
  lines.push(`## Skills Loaded`);
  lines.push(`Total: ${allSkills.length}`);
  lines.push(``);
  for (const s of allSkills) {
    lines.push(`- ${s.metadata.id}: intents=[${(s.metadata.intents || []).join(', ')}], tools=${(s.metadata.tools || []).length}, prompt_chars=${s.prompt.length}`);
  }
  lines.push(``);

  // Scenario audits
  lines.push(`## Scenarios`);
  lines.push(``);

  for (const scenario of scenarios) {
    const parsed = await parseIntent(scenario.query, scenario.context);
    const intent = parsed.highLevel.type;
    const systemPrompt = promptOrchestrator.getSystemPrompt(scenario.model, intent);
    const userPrompt = promptOrchestrator.buildPrompt(scenario.query, scenario.context, intent);
    const matchedSkills = skillRegistry.getSkillsByIntent(intent);

    const expectedPlans = simulateAgentPlan(parsed, scenario.context);

    const warnings: string[] = [];
    if (!hasIntentPolicy(systemPrompt)) warnings.push('missing INTENT_POLICY');
    if (!hasToolList(systemPrompt)) warnings.push('missing tool list');
    if (intent === 'TRADING' && !hasTradingPolicy(systemPrompt)) warnings.push('missing TRADING_POLICY');
    if (matchedSkills.length === 0) warnings.push('no skills matched this intent (legacy fallback will apply)');
    if (scenario.model === 'grok' && !mentionsSearchTools(systemPrompt)) warnings.push('grok prompt does not mention x_search/web_search/external_web_search');

    lines.push(`### ${scenario.name}`);
    lines.push(`- model: ${scenario.model}`);
    lines.push(`- query: ${scenario.query}`);
    lines.push(
      `- context: chain=${scenario.context.chainName || scenario.context.chainId || 'unknown'}, evm=${maskAddress(scenario.context.userAddress)}, sol=${maskAddress(scenario.context.solanaAddress)}, wallet=${scenario.context.isWalletConnected ? 'connected' : 'not connected'}`
    );
    lines.push(`- parsed: high=${parsed.highLevel.type} (conf=${parsed.highLevel.confidence}), detailed=${parsed.detailed.action}`);
    lines.push(`- contractAddress: ${maskAddress(parsed.contractAddress) || 'none'}`);
    lines.push(`- matchedSkills: ${matchedSkills.map(s => s.metadata.id).join(', ') || 'none'}`);
    lines.push(`- systemPromptChars: ${systemPrompt.length}`);
    lines.push(`- userPromptChars: ${userPrompt.length}`);
    lines.push(`- expectedAgentPlan: ${expectedPlans.join(' -> ')}`);
    if (warnings.length > 0) lines.push(`- warnings: ${warnings.join('; ')}`);
    lines.push(``);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');

  console.log(`Wrote audit report: ${outPath}`);
  console.log(`Scenarios: ${scenarios.length}`);
}

run().catch((e) => {
  console.error('Prompt audit failed:', e);
  process.exit(1);
});
