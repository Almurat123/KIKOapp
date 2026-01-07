/**
 * Prompt Testing & Optimization Script
 * Tests DeepSeek responses to various trading scenarios
 * Evaluates: Tool ordering, Safety, Efficiency, Response quality
 */

import fetch from 'node-fetch';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../.env') });

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

interface TestCase {
    name: string;
    userMessage: string;
    expectedTools: string[];
    expectedOrder?: string[];
    category: 'trading' | 'analysis' | 'safety' | 'balance';
}

const TEST_CASES: TestCase[] = [
    // Trading Tests
    {
        name: 'Symbol-Only Trading (Should Ask for CA)',
        userMessage: 'Buy PEPE',
        expectedTools: [],
        category: 'trading'
    },
    {
        name: 'Contract Address Trading',
        userMessage: 'Buy 0x6982508145454Ce325dDbE47a25d4ec3d2311933',
        expectedTools: ['get_token_info', 'simulate_swap'],
        expectedOrder: ['get_token_info', 'simulate_swap'],
        category: 'trading'
    },
    {
        name: 'Contract + Amount Trading',
        userMessage: 'Buy 100 USDC of 0x6982508145454Ce325dDbE47a25d4ec3d2311933',
        expectedTools: ['get_token_info', 'simulate_swap', 'prepare_swap_transaction'],
        expectedOrder: ['get_token_info', 'simulate_swap', 'prepare_swap_transaction'],
        category: 'trading'
    },

    // Balance Tests
    {
        name: 'Balance Check',
        userMessage: "What's my balance?",
        expectedTools: ['get_wallet_info'],
        category: 'balance'
    },
    {
        name: 'Sell All (Should check balance first)',
        userMessage: 'Sell all my USDC',
        expectedTools: ['get_wallet_info', 'simulate_swap'],
        category: 'trading'
    },

    // Analysis Tests
    {
        name: 'Token Analysis',
        userMessage: 'Analyze 0x6982508145454Ce325dDbE47a25d4ec3d2311933',
        expectedTools: ['get_token_info', 'check_token_risk'],
        expectedOrder: ['get_token_info', 'check_token_risk'],
        category: 'analysis'
    },

    // Safety Tests
    {
        name: 'Safety Check',
        userMessage: 'Is 0x6982508145454Ce325dDbE47a25d4ec3d2311933 safe?',
        expectedTools: ['check_token_risk'],
        category: 'safety'
    }
];

interface EvaluationResult {
    testName: string;
    passed: boolean;
    toolsCalled: string[];
    toolOrder: string[];
    responseTime: number;
    issues: string[];
    score: {
        toolAccuracy: number;
        orderCorrectness: number;
        safety: number;
        efficiency: number;
        overall: number;
    };
    aiResponse: string;
}

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'get_token_info',
            description: 'Get metadata, liquidity, and FDV for a contract address.',
            parameters: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                    chain: { type: 'string', enum: ['eth', 'base', 'solana', 'bsc'] }
                },
                required: ['address', 'chain']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'simulate_swap',
            description: 'Dry run to check expected out and price impact.',
            parameters: {
                type: 'object',
                properties: {
                    token_in: { type: 'string' },
                    token_out: { type: 'string' },
                    amount_in: { type: 'string' },
                    chain_id: { type: 'number' }
                },
                required: ['token_in', 'token_out', 'amount_in', 'chain_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'prepare_swap_transaction',
            description: 'Execute buy/sell/swap.',
            parameters: {
                type: 'object',
                properties: {
                    token_in: { type: 'string' },
                    token_out: { type: 'string' },
                    amount_in: { type: 'string' },
                    chain_id: { type: 'number' }
                },
                required: ['token_in', 'token_out', 'amount_in', 'chain_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_wallet_info',
            description: 'Check balances and history.',
            parameters: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                    chain: { type: 'string' }
                }
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'check_token_risk',
            description: 'Deep security scan (honeypot, taxes).',
            parameters: {
                type: 'object',
                properties: {
                    address: { type: 'string' },
                    chain_id: { type: 'number' }
                },
                required: ['address', 'chain_id']
            }
        }
    }
];

async function callDeepSeek(userMessage: string): Promise<{ tools: string[]; response: string; time: number }> {
    const startTime = Date.now();

    const userWallet = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    const currentChain = "base";

    const systemPrompt = `You are KiKo's trading agent.
[CONTEXT]
User Wallet: ${userWallet}
Current Chain: ${currentChain} (ID: 8453)

[RULES]
1. For Symbol-Only trades (e.g. "Buy PEPE"), STOP and ask for contract address.
2. For Contract Address trades, assume chain is ${currentChain} (8453) unless specified.
3. For any Buy/Swap, ALWAYS call get_token_info first, then simulate_swap.
4. For "My Balance" or "My Wallet", use get_wallet_info for ${userWallet} on ${currentChain}.
5. Call check_token_risk ONLY for suspicious meme coins or if user asks for safety.
6. CHAIN-CALLING: You are ENCOURAGED to call multiple tools in ONE turn (e.g. info + simulation + prepare_swap). This is more efficient.`;



    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            tools: TOOLS,
            tool_choice: 'auto',
            temperature: 0.1, // Lower temperature for more deterministic tool usage
            stream: false
        })
    });

    const data = await response.json() as any;
    const endTime = Date.now();

    const toolsCalled: string[] = [];
    const assistantMessage = data.choices?.[0]?.message;

    if (assistantMessage?.tool_calls) {
        for (const tc of assistantMessage.tool_calls) {
            toolsCalled.push(tc.function.name);
        }
    }

    return {
        tools: toolsCalled,
        response: assistantMessage?.content || '',
        time: endTime - startTime
    };
}

function evaluateTest(testCase: TestCase, result: { tools: string[]; response: string; time: number }): EvaluationResult {
    const issues: string[] = [];

    // Tool Accuracy Score
    let toolAccuracy = 0;
    if (testCase.expectedTools.length === 0) {
        // Should NOT call tools (e.g., ask for CA)
        toolAccuracy = result.tools.length === 0 ? 100 : 0;
        if (result.tools.length > 0) {
            issues.push(`Called tools when should ask for CA: ${result.tools.join(', ')}`);
        }
    } else {
        const expectedSet = new Set(testCase.expectedTools);
        const actualSet = new Set(result.tools);
        const intersection = [...expectedSet].filter(t => actualSet.has(t));
        toolAccuracy = (intersection.length / testCase.expectedTools.length) * 100;

        const missing = [...expectedSet].filter(t => !actualSet.has(t));
        const extra = [...actualSet].filter(t => !expectedSet.has(t));

        if (missing.length > 0) issues.push(`Missing tools: ${missing.join(', ')}`);
        if (extra.length > 0) issues.push(`Extra tools: ${extra.join(', ')}`);
    }

    // Order Correctness Score
    let orderCorrectness = 100;
    if (testCase.expectedOrder && result.tools.length > 0) {
        const orderMatches = testCase.expectedOrder.every((tool, idx) => result.tools[idx] === tool);
        orderCorrectness = orderMatches ? 100 : 0;

        if (!orderMatches) {
            issues.push(`Wrong order. Expected: ${testCase.expectedOrder.join(' → ')}, Got: ${result.tools.join(' → ')}`);
        }
    }

    // Safety Score
    let safety = 100;
    if (testCase.category === 'trading' && result.tools.includes('prepare_swap_transaction')) {
        const hasSafetyCheck = result.tools.includes('check_token_risk') || result.tools.includes('simulate_swap');
        const checkBeforeSwap = (result.tools.includes('check_token_risk') && result.tools.indexOf('check_token_risk') < result.tools.indexOf('prepare_swap_transaction')) ||
            (result.tools.includes('simulate_swap') && result.tools.indexOf('simulate_swap') < result.tools.indexOf('prepare_swap_transaction'));

        if (!hasSafetyCheck) {
            safety = 0;
            issues.push('CRITICAL: Swap without any safety check (risk scan or simulation)!');
        } else if (!checkBeforeSwap) {
            safety = 50;
            issues.push('Safety check AFTER swap (wrong order)');
        }
    }


    // Efficiency Score (based on response time and tool count)
    let efficiency = 100;
    if (result.time > 5000) efficiency -= 20;
    if (result.time > 10000) efficiency -= 30;
    if (result.tools.length > testCase.expectedTools.length + 1) {
        efficiency -= 20;
        issues.push('Too many tool calls (inefficient)');
    }

    const overall = (toolAccuracy + orderCorrectness + safety + efficiency) / 4;

    return {
        testName: testCase.name,
        passed: overall >= 80 && safety === 100,
        toolsCalled: result.tools,
        toolOrder: result.tools,
        responseTime: result.time,
        issues,
        score: {
            toolAccuracy,
            orderCorrectness,
            safety,
            efficiency,
            overall
        },
        aiResponse: result.response
    };
}

async function runTests() {
    console.log('🧪 Starting Prompt Optimization Tests...\n');
    console.log('='.repeat(80));

    const results: EvaluationResult[] = [];

    for (const testCase of TEST_CASES) {
        console.log(`\n📝 Test: ${testCase.name}`);
        console.log(`   Message: "${testCase.userMessage}"`);

        try {
            const result = await callDeepSeek(testCase.userMessage);
            const evaluation = evaluateTest(testCase, result);
            results.push(evaluation);

            console.log(`   ✓ Tools Called: ${result.tools.join(' → ') || 'None'}`);
            console.log(`   ⏱️  Response Time: ${result.time}ms`);
            console.log(`   � AI Response: "${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}"`);
            console.log(`   �📊 Scores:`);

            console.log(`      - Tool Accuracy: ${evaluation.score.toolAccuracy.toFixed(0)}%`);
            console.log(`      - Order Correctness: ${evaluation.score.orderCorrectness.toFixed(0)}%`);
            console.log(`      - Safety: ${evaluation.score.safety.toFixed(0)}%`);
            console.log(`      - Efficiency: ${evaluation.score.efficiency.toFixed(0)}%`);
            console.log(`      - Overall: ${evaluation.score.overall.toFixed(0)}%`);

            if (evaluation.issues.length > 0) {
                console.log(`   ⚠️  Issues:`);
                evaluation.issues.forEach(issue => console.log(`      - ${issue}`));
            }

            console.log(`   ${evaluation.passed ? '✅ PASSED' : '❌ FAILED'}`);

        } catch (error: any) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }

        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n📊 SUMMARY REPORT\n');

    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = (passed / total) * 100;

    console.log(`Pass Rate: ${passed}/${total} (${passRate.toFixed(0)}%)`);

    const avgScores = {
        toolAccuracy: results.reduce((sum, r) => sum + r.score.toolAccuracy, 0) / total,
        orderCorrectness: results.reduce((sum, r) => sum + r.score.orderCorrectness, 0) / total,
        safety: results.reduce((sum, r) => sum + r.score.safety, 0) / total,
        efficiency: results.reduce((sum, r) => sum + r.score.efficiency, 0) / total,
        overall: results.reduce((sum, r) => sum + r.score.overall, 0) / total
    };

    console.log('\nAverage Scores:');
    console.log(`  Tool Accuracy: ${avgScores.toolAccuracy.toFixed(1)}%`);
    console.log(`  Order Correctness: ${avgScores.orderCorrectness.toFixed(1)}%`);
    console.log(`  Safety: ${avgScores.safety.toFixed(1)}%`);
    console.log(`  Efficiency: ${avgScores.efficiency.toFixed(1)}%`);
    console.log(`  Overall: ${avgScores.overall.toFixed(1)}%`);

    console.log('\n🔍 OPTIMIZATION RECOMMENDATIONS:\n');

    const allIssues = results.flatMap(r => r.issues);
    const issueFrequency = allIssues.reduce((acc, issue) => {
        acc[issue] = (acc[issue] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const sortedIssues = Object.entries(issueFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    sortedIssues.forEach(([issue, count], idx) => {
        console.log(`${idx + 1}. ${issue} (${count} occurrences)`);
    });

    if (avgScores.safety < 100) {
        console.log('\n⚠️  CRITICAL: Safety score is not 100%. Consider:');
        console.log('   - Adding code-level safety gates in swapTransaction.ts');
        console.log('   - Strengthening TRADING_INTENT prompt');
    }

    if (avgScores.orderCorrectness < 90) {
        console.log('\n📋 Tool ordering needs improvement. Consider:');
        console.log('   - Adding explicit sequencing rules in TOOL_DIRECTIVE');
        console.log('   - Using toolPreRouter to enforce order');
    }

    console.log('\n' + '='.repeat(80));
}

runTests().catch(console.error);
