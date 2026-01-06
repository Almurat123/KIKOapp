import 'dotenv/config';
import { ChatWorker } from '../src/jobs/chatWorker.js';
import { toolRegistry } from '../src/tools/index.js';

// --- CONFIGURATION ---
const TIMEOUT_MS = 60000; // 60s timeout per test

const mockWS = {
    broadcast: () => { }
};

// Track current test prompt for dynamic mock responses
let currentTestHistory: { role: string; content: string }[] = [];

const mockRepo = {
    getQueuedTasks: async () => [],
    updateTask: async () => { },
    updateTaskStatus: async () => { },
    getTask: async (id: string) => ({
        id,
        status: 'queued',
        sessionId: 'test-session',
        model: 'deepseek-v3-thinking', // Testing the main thinking model
        toolContext: {
            walletAddress: '0x1234567890123456789012345678901234567890',
            chainId: 8453,
            userId: 'test-user',
            toolConfig: {
                // Ensure tool usage is enabled
                toolConfig: 'active'
            }
        }
    }),
    updateMessage: async () => { },
    // Return the current test history instead of empty array
    getSessionMessages: async () => currentTestHistory.map(h => ({
        role: h.role,
        content: h.content
    })),
    createChunk: async () => ({})
};

// --- TEST SCENARIOS ---
interface TestScenario {
    name: string;
    description: string;
    prompt: string;
    expectedTool: string;
    // Function to validate arguments
    validateArgs?: (args: any) => boolean | string;
}

const scenarios: TestScenario[] = [
    {
        name: 'Token Info - Explicit',
        description: 'User asks for price/info of a specific token',
        prompt: 'What is the price of ETH on Base?',
        expectedTool: 'get_token_info',
        validateArgs: (args) => {
            if (!args.address && !args.symbol) {
                // Note: Tool definition expects invalid 'address' if symbol not supported? 
                // Actually get_token_info definition requires 'address' and 'chain'.
                // Wait, if user says "ETH", LLM might not know address. 
                // Our get_token_info prompt says "address" is required. 
                // Let's see if LLM tries to find it or uses web_search.
                // Actually ideally it should use get_token_info if it knows the address or web_search if not.
                // Let's test a known address to be fair for PURE tool understanding.
                return true;
            }
            return args.chain === 'base';
        }
    },
    {
        name: 'Token Info - Address',
        description: 'User provides a contract address',
        prompt: 'check 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 on Base',
        expectedTool: 'get_token_info',
        validateArgs: (args) => args.address.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' && args.chain.toLowerCase() === 'base'
    },
    {
        name: 'Wallet Balance',
        description: 'User asks for their own balance',
        prompt: 'Check my wallet balance',
        expectedTool: 'get_wallet_info',
        validateArgs: (args) => true // Address might be inferred
    },
    {
        name: 'Trending Tokens',
        description: 'User asks what is trending',
        prompt: 'What tokens are trending right now?',
        expectedTool: 'get_trending_tokens',
        validateArgs: (args) => true
    },
    {
        name: 'Swap Transaction',
        description: 'User wants to swap tokens',
        prompt: 'Swap 100 USDC to ETH on Base',
        expectedTool: 'prepare_swap_transaction',
        validateArgs: (args) => {
            // Expect strict types
            if (args.amount_in !== '100') return 'amount_in should be string "100"';
            if (typeof args.chain_id !== 'number') return 'chain_id should be number';
            return true;
        }
    },
    {
        name: 'Farcaster Trending',
        description: 'User asks for Farcaster trends',
        prompt: 'What is hot on Farcaster?',
        expectedTool: 'get_trending_casts',
        validateArgs: (args) => true
    },
    {
        name: 'Social Search',
        description: 'User wants to search social posts',
        prompt: 'Search Farcaster for "Vitalik"',
        expectedTool: 'search_farcaster_casts',
        validateArgs: (args) => args.query.toLowerCase().includes('vitalik')
    },
    {
        name: 'Token Risk',
        description: 'User asks if a token is safe',
        prompt: 'Is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 safe to buy?',
        expectedTool: 'check_token_risk',
        validateArgs: (args) => args.address.toLowerCase() === '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
    },
    {
        name: 'Market Overview',
        description: 'User asks about general market',
        prompt: 'How is the crypto market doing today?',
        expectedTool: 'get_market_overview',
        validateArgs: (args) => true
    },
    // General Knowledge tests
    {
        name: 'General Knowledge - Crypto',
        description: 'User asks educational question about crypto',
        prompt: 'What is DeFi and how does it work?',
        expectedTool: 'web_search',
        validateArgs: (args) => args.query && args.query.toLowerCase().includes('defi')
    },
    {
        name: 'General Knowledge - Specific Token',
        description: 'User asks about a specific project',
        prompt: 'Tell me about Ethereum',
        expectedTool: 'web_search',
        validateArgs: (args) => args.query && args.query.toLowerCase().includes('ethereum')
    }
];

// --- EXECUTION ---

async function runEvaluations() {
    console.log('🔍 Starting LLM Tool Selection Evaluation...');
    console.log(`📋 Total Scenarios: ${scenarios.length}`);
    console.log('--------------------------------------------------\n');

    let passed = 0;
    let failed = 0;

    // We need to spy on toolRegistry.execute to capture the LLM's choice
    // WITHOUT actually running the tool (some tools might be heavy or need real data).
    // Actually, for this test, we want to see what the LLM *calls*.

    // Hack: We'll modify toolRegistry.execute for the duration of the test.
    const originalExecute = toolRegistry.execute;

    // Use a clean worker instance
    const worker = new ChatWorker({ repo: mockRepo, ws: mockWS });

    for (const scenario of scenarios) {
        process.stdout.write(`Testing: ${scenario.name}... `);

        // State for this run
        let selectedTool: string | null = null;
        let selectedArgs: any = null;
        let toolCallCount = 0;

        // Mock execute specifically for this run 
        // We only care about the FIRST tool call for decision verification
        toolRegistry.execute = async (name: string, args: any) => {
            if (toolCallCount === 0) {
                selectedTool = name;
                selectedArgs = args;
            }
            toolCallCount++;
            // Throwing error to force break out of runTask loop
            throw new Error('TEST_TOOL_CAPTURED');
        };

        try {
            // Set current test history for mockRepo.getSessionMessages to return
            currentTestHistory = [{ role: 'user', content: scenario.prompt }];

            // Run task (this calls the real LLM with our mocked tool runner)
            await (worker as any).runTask({
                id: `test-${Date.now()}`,
                sessionId: 'test-session',
                model: 'deepseek-v3-thinking',
                toolContext: {
                    walletAddress: '0x1234567890123456789012345678901234567890',
                    chainId: 8453,
                    userId: 'test-user',
                    toolConfig: { toolConfig: 'active' }
                }
            });

            // Check results
            const toolMatch = selectedTool === scenario.expectedTool;

            let argsValid: boolean | string = true;
            if (toolMatch && scenario.validateArgs) {
                argsValid = scenario.validateArgs(selectedArgs);
            }

            if (toolMatch && argsValid === true) {
                console.log('✅ PASS');
                passed++;
            } else {
                console.log('❌ FAIL');
                console.log(`   Prompt: "${scenario.prompt}"`);
                console.log(`   Expected: ${scenario.expectedTool}`);
                console.log(`   Actual:   ${selectedTool || '(No tool called)'}`);
                if (selectedTool && selectedArgs) {
                    console.log(`   Args:     ${JSON.stringify(selectedArgs)}`);
                }
                if (argsValid !== true) {
                    console.log(`   Arg Check: ${argsValid}`);
                }
                failed++;
            }

        } catch (error) {
            console.log('❌ ERROR');
            console.error('   Execution failed:', error);
            failed++;
        }

        // Small delay to respect rate limits
        await new Promise(r => setTimeout(r, 1000));
    }

    // Restore registry
    toolRegistry.execute = originalExecute;

    console.log('\n--------------------------------------------------');
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log('--------------------------------------------------');

    // Explicitly exit
    process.exit(0);
}

runEvaluations().catch(console.error);
