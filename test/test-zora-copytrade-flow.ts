
import { handleSwapDetected } from '../src/services/autoTradeService';
import { detectLaunchpadToken } from '../src/services/ai/launchpadDetector';
import { zoraSniperService } from '../src/services/zoraSniperService';
import prisma from '../src/lib/prisma';

// Mocking dependencies
jest.mock('../src/services/ai/launchpadDetector');
jest.mock('../src/services/zoraSniperService');
jest.mock('../src/lib/prisma', () => ({
    copyTradeConfig: {
        findMany: jest.fn(),
    },
    position: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
    },
}));

describe('Zora CopyTrade Flow', () => {
    const mockUser = {
        id: 'user1',
        privyDid: 'did:privy:123',
        walletAddress: '0x123',
    };

    const mockConfig = {
        id: 'config1',
        userId: 'user1',
        targetWallet: '0xtarget',
        chainId: 8453,
        buyAmountUsd: 100,
        maxSlippageBps: 100,
        status: 'active',
        user: mockUser,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should use zoraSniperService.fastSwap for Zora tokens on BUY', async () => {
        const swap = {
            tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
            tokenOut: '0xzoratoken',
            amountIn: '100000000000000000', // 0.1 ETH
            amountOut: '1000000000000000000',
            dexName: 'Zora',
        };

        (prisma.copyTradeConfig.findMany as jest.Mock).mockResolvedValue([mockConfig]);
        (detectLaunchpadToken as jest.Mock).mockResolvedValue({ provider: 'zora' });
        (zoraSniperService.fastSwap as jest.Mock).mockResolvedValue('0xtxhash');

        await handleSwapDetected('0xtarget', swap as any, 8453);

        expect(detectLaunchpadToken).toHaveBeenCalledWith('0xzoratoken', 8453);
        expect(zoraSniperService.fastSwap).toHaveBeenCalledWith(expect.objectContaining({
            tokenOut: '0xzoratoken',
            walletAddress: '0x123',
        }));
    });

    it('should use zoraSniperService.fastSell for Zora tokens on SELL', async () => {
        const swap = {
            tokenIn: '0xzoratoken',
            tokenOut: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
            amountIn: '1000000000000000000',
            amountOut: '100000000000000000',
            dexName: 'Zora',
        };

        const sellConfig = { ...mockConfig, mirrorSell: true };
        (prisma.copyTradeConfig.findMany as jest.Mock).mockResolvedValue([sellConfig]);
        (prisma.position.findMany as jest.Mock).mockResolvedValue([{ id: 'pos1' }]);
        (detectLaunchpadToken as jest.Mock).mockResolvedValue({ provider: 'zora' });
        (zoraSniperService.fastSell as jest.Mock).mockResolvedValue('0xtxhash_sell');

        // We need to mock ethers balanceOf/decimals if we were calling real logic, 
        // but here we are checking the routing.

        await handleSwapDetected('0xtarget', swap as any, 8453);

        expect(detectLaunchpadToken).toHaveBeenCalledWith('0xzoratoken', 8453);
        expect(zoraSniperService.fastSell).toHaveBeenCalled();
    });
});
