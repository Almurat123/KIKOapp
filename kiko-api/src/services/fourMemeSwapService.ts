/**
 * Four.Meme Swap Service
 * Implements native bonding curve swaps for Four.Meme tokens.
 */

import {
    createPublicClient,
    http,
    parseEther,
    type Address,
    encodeFunctionData,
    parseAbi,
} from 'viem';
import { base, bsc } from 'viem/chains';
import { sendTransaction, isPrivyConfigured } from './privyWallet.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

// Four.Meme Helper V3 Addresses
const FOURMEME_HELPER = {
    BASE: '0x1172FABbAc4Fe05f5a5Cebd8EBBC593A76c42399' as Address,
    BSC: '0xF251F83e40a78868FcfA3FA4599Dad6494E46034' as Address,
};

// ABIs
const HELPER_ABI = parseAbi([
    'function getTokenInfo(address token) view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)',
    'function tryBuy(address token, uint256 amount, uint256 funds) view returns (address tokenManager, address quote, uint256 estimatedAmount, uint256 estimatedCost, uint256 estimatedFee, uint256 amountMsgValue, uint256 amountApproval, uint256 amountFunds)',
    'function trySell(address token, uint256 amount) view returns (address tokenManager, address quote, uint256 funds, uint256 fee)',
    'function buyWithEth(uint256 origin, address token, address to, uint256 funds, uint256 minAmount) payable'
]);

const TOKEN_MANAGER_V2_ABI = parseAbi([
    'function buyTokenAMAP(address token, uint256 funds, uint256 minAmount) payable',
    'function sellToken(address token, uint256 amount) external',
    'function buyToken(bytes args, uint256 time, bytes signature) public payable'
]);

const TOKEN_MANAGER_V1_ABI = parseAbi([
    'function purchaseTokenAMAP(address token, uint256 funds, uint256 minAmount) payable',
    'function saleToken(address token, uint256 amount) external'
]);

const ERC20_ABI = parseAbi([
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)'
]);

export class FourMemeSwapService {
    private getClient(chainId: number) {
        return createPublicClient({
            chain: chainId === 56 ? bsc : base,
            transport: http()
        });
    }

    private getHelperAddress(chainId: number): Address {
        return chainId === 56 ? FOURMEME_HELPER.BSC : FOURMEME_HELPER.BASE;
    }

    /**
     * Fast swap for Four.Meme tokens
     */
    async fastSwap(params: {
        userId: string;
        accessToken: string;
        walletAddress: string;
        tokenIn: string;
        tokenOut: string;
        amountIn: string;
        chainId: number;
        slippage?: number;
    }): Promise<string> {
        logger.debug(LogCode.EXE_TX_BROADCAST, 'Executing Four.Meme FastSwap');

        if (!isPrivyConfigured()) {
            throw new Error('Privy not configured');
        }

        const client = this.getClient(params.chainId);
        const helper = this.getHelperAddress(params.chainId);

        const isBuy = params.tokenIn === 'ETH' || params.tokenIn === 'BNB' || params.tokenIn === '0x0000000000000000000000000000000000000000';
        const targetToken = (isBuy ? params.tokenOut : params.tokenIn) as Address;
        const amountInWei = parseEther(params.amountIn);

        // 1. Get Token Info to see version and liquidity status
        const info = await client.readContract({
            address: helper,
            abi: HELPER_ABI,
            functionName: 'getTokenInfo',
            args: [targetToken]
        });

        const [version, tokenManager, quote, , , , , , , , , liquidityAdded] = info;

        if (liquidityAdded) {
            logger.warn(LogCode.EXE_TX_REVERTED, 'Four.Meme: Liquidity already added to DEX', { token: targetToken });
            throw new Error('Liquidity already added to DEX. Use aggregator instead.');
        }

        logger.debug(LogCode.SYS_INFO, 'Four.Meme Token Info fetched', { version: version.toString(), manager: tokenManager, quote });

        let txData: `0x${string}`;
        let txTo: Address = tokenManager as Address;
        let txValue: string = '0';

        if (isBuy) {
            // BUY Logic
            const slippagePct = params.slippage || 3;
            // Get estimate to calculate minAmount
            const estimate = await client.readContract({
                address: helper,
                abi: HELPER_ABI,
                functionName: 'tryBuy',
                args: [targetToken, BigInt(0), amountInWei]
            });
            const [, , estimatedAmount] = estimate;
            const minAmount = (estimatedAmount * BigInt(100 - slippagePct)) / BigInt(100);

            if (quote === '0x0000000000000000000000000000000000000000') {
                // Native ETH/BNB pair
                if (version === BigInt(2)) {
                    txData = encodeFunctionData({
                        abi: TOKEN_MANAGER_V2_ABI,
                        functionName: 'buyTokenAMAP',
                        args: [targetToken, amountInWei, minAmount]
                    });
                } else {
                    txData = encodeFunctionData({
                        abi: TOKEN_MANAGER_V1_ABI,
                        functionName: 'purchaseTokenAMAP',
                        args: [targetToken, amountInWei, minAmount]
                    });
                }
                txValue = amountInWei.toString();
            } else {
                // ERC20/ERC20 pair (buy with ETH/BNB using buyWithEth helper)
                txData = encodeFunctionData({
                    abi: HELPER_ABI,
                    functionName: 'buyWithEth',
                    args: [BigInt(0), targetToken, params.walletAddress as Address, amountInWei, minAmount]
                });
                txTo = helper;
                txValue = amountInWei.toString();
            }
        } else {
            // SELL Logic
            // 1. Check Allowance for TokenManager
            const allowance = await client.readContract({
                address: targetToken,
                abi: ERC20_ABI,
                functionName: 'allowance',
                args: [params.walletAddress as Address, tokenManager as Address]
            });

            if (allowance < amountInWei) {
                logger.info(LogCode.EXE_TX_BROADCAST, 'Four.Meme: Approving TokenManager', { token: targetToken });
                const approveData = encodeFunctionData({
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [tokenManager as Address, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')]
                });
                // We might need to send a separate approval tx first in a real UI flow, 
                // but for backend sniper style we'll try to just send it.
                // Note: Ideally the executor handles sequential txs.
                await sendTransaction(params.userId, params.accessToken, {
                    to: targetToken,
                    data: approveData,
                    value: '0',
                    chainId: params.chainId
                });
            }

            if (version === BigInt(2)) {
                txData = encodeFunctionData({
                    abi: TOKEN_MANAGER_V2_ABI,
                    functionName: 'sellToken',
                    args: [targetToken, amountInWei]
                });
            } else {
                txData = encodeFunctionData({
                    abi: TOKEN_MANAGER_V1_ABI,
                    functionName: 'saleToken',
                    args: [targetToken, amountInWei]
                });
            }
        }

        // Execute Transaction
        const txHash = await sendTransaction(params.userId, params.accessToken, {
            to: txTo,
            data: txData!,
            value: txValue,
            chainId: params.chainId,
        });

        logger.info(LogCode.EXE_TX_BROADCAST, 'Four.Meme Swap Success', { txHash, chainId: params.chainId });
        return txHash;
    }
}

export const fourMemeSwapService = new FourMemeSwapService();
