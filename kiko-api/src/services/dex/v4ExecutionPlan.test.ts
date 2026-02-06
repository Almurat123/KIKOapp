import test from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { buildV4SwapTransaction } from './uniswapV4Swap.js';
import { buildV4ExecutionPlan, SelectedV4Pool } from './v4ExecutionPlan.js';
import { buildClankerHookData } from './v4Hooks.js';

test('buildV4SwapTransaction encodes provided hookData into swap params', () => {
    const poolKey = {
        currency0: '0x4200000000000000000000000000000000000006',
        currency1: '0x1111111111111111111111111111111111111111',
        fee: 500,
        tickSpacing: 10,
        hooks: '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc'
    };
    const hookData = '0x1234abcd';
    const tx = buildV4SwapTransaction(
        8453,
        poolKey,
        true,
        1_000_000n,
        900_000n,
        '0x2222222222222222222222222222222222222222',
        1_900_000_000,
        false,
        false,
        hookData
    );

    const routerInterface = new ethers.Interface([
        'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable'
    ]);
    const decoded = routerInterface.decodeFunctionData('execute', tx.data);
    const combinedInput = decoded[1][0];
    const abi = ethers.AbiCoder.defaultAbiCoder();
    const [, paramsArray] = abi.decode(['bytes', 'bytes[]'], combinedInput);
    const [swapParams] = abi.decode(
        ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
        paramsArray[0]
    );

    assert.equal(swapParams[4], hookData);
});

test('buildV4ExecutionPlan uses selected pool and builds clanker hookData', () => {
    const wallet = '0x3333333333333333333333333333333333333333';
    const selectedPool: SelectedV4Pool = {
        poolId: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        poolAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        poolKey: {
            currency0: '0x1111111111111111111111111111111111111111',
            currency1: '0x4200000000000000000000000000000000000006',
            fee: 500,
            tickSpacing: 10,
            hooks: '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc'
        },
        sqrtPriceX96: '1',
        liquidity: '1',
        fee: 500,
        version: 'v4',
        dex: 'uniswap'
    };

    const plan = buildV4ExecutionPlan({
        tokenIn: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        tokenOut: '0x1111111111111111111111111111111111111111',
        chainId: 8453,
        walletAddress: wallet,
        pool: selectedPool
    });

    assert.equal(plan.poolId, selectedPool.poolId);
    assert.equal(plan.poolKey.hooks, selectedPool.poolKey.hooks);
    assert.equal(plan.normalizedIn, '0x4200000000000000000000000000000000000006');
    assert.equal(plan.zeroForOne, false);
    assert.equal(plan.hookData, buildClankerHookData(wallet));
});
