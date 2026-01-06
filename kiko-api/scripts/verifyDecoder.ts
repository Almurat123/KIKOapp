
import { parseSwapTransaction, DecodedSwap } from '../src/services/txDecoder.ts';

// Mock Data for "Buy Token with 1 BNB"
const MOCK_TX = {
    hash: '0xmockhash',
    from: '0xUserAddress',
    to: '0xRouterAddress',
    input: '0xswapMethod...',
    value: '1000000000000000000', // 1 BNB
};

// Mock Logs: User receives 1000 TokenX
// Transfer(Router -> User, 1000 TokenX)
const MOCK_TOKEN_ADDRESS = '0xTokenAddress';
const MOCK_USER_ADDRESS = '0xUserAddress';
const MOCK_ROUTER_ADDRESS = '0xRouterAddress';

// Event signature for Transfer(address,address,uint256)
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Pad address to 32 bytes
const padAddress = (addr: string) => '0x000000000000000000000000' + addr.replace('0x', '');

const MOCK_LOGS = [
    {
        address: MOCK_TOKEN_ADDRESS,
        topics: [
            TRANSFER_SIG,
            padAddress(MOCK_ROUTER_ADDRESS), // From Router
            padAddress(MOCK_USER_ADDRESS)    // To User
        ],
        data: '0x00000000000000000000000000000000000000000000000000000000000003e8' // 1000
    }
];

const MOCK_RECEIPT = {
    logs: MOCK_LOGS,
    status: 1
};

async function main() {
    console.log('--- Verifying BNB Buy Detection ---');
    console.log('Input Scenario: User sends 1 BNB to buy TokenX');

    const swap = await parseSwapTransaction(MOCK_TX, MOCK_RECEIPT, 56);

    if (!swap) {
        console.error('❌ Failed to decode swap');
        process.exit(1);
    }

    console.log('Decoded Result:', {
        tokenIn: swap.tokenIn,
        tokenOut: swap.tokenOut,
        amountIn: swap.amountIn,
        amountOut: swap.amountOut
    });

    const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

    // Expectations
    const tokenInIsNative = swap.tokenIn === NATIVE;
    const tokenOutIsToken = swap.tokenOut.toLowerCase() === MOCK_TOKEN_ADDRESS.toLowerCase();

    if (tokenInIsNative && tokenOutIsToken) {
        console.log('✅ TEST PASSED: Correctly identified Sell Native -> Buy Token');
    } else {
        console.error('❌ TEST FAILED: Incorrect detection');
        if (!tokenInIsNative) console.error(`   Expected tokenIn to be Native, got ${swap.tokenIn}`);
        if (!tokenOutIsToken) console.error(`   Expected tokenOut to be Token (${MOCK_TOKEN_ADDRESS}), got ${swap.tokenOut}`);

        if (swap.tokenOut === NATIVE) {
            console.error('   BUG CONFIRMED: tokenOut was incorrectly overridden to Native!');
        }
    }
}

main().catch(console.error);
