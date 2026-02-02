/**
 * V4 PoolId 计算验证
 * 目标：验证 keccak256(abi.encode(PoolKey)) 是否产生正确的 PoolId
 * 
 * [Ref]: https://docs.uniswap.org/contracts/v4/reference/core/types/PoolId
 * PoolId = keccak256(abi.encode(PoolKey))
 * PoolKey = {currency0, currency1, fee, tickSpacing, hooks}
 */

import { ethers } from 'ethers';

// 已知的 V4 Pool (从 DEX Screener)
// CLAWNCH/WETH: 0x03d3c21ea1daf51dd2898ebaf9342a93374877ba6ab34cc7ffe5b5d43ee46e0a
// lpFee = 10000 (1%)

const KNOWN_POOLS = [
    {
        name: 'CLAWNCH/WETH',
        expectedPoolId: '0x03d3c21ea1daf51dd2898ebaf9342a93374877ba6ab34cc7ffe5b5d43ee46e0a',
        lpFee: 10000  // 从 StateView 读取
    }
];

// Token addresses (CLAWNCH 和 WETH)
const CLAWNCH = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be';
const WETH = '0x4200000000000000000000000000000000000006';

// Clanker Hook 地址
const CLANKER_HOOKS = [
    '0x0000000000000000000000000000000000000000',
    '0x34a45c6B61876d739400Bd71228CbcbD4F53E8cC', // ClankerHookDynamicFee v4.0.0
    '0xDd5EeaFf7BD481AD55Db083062b13a3cdf0A68CC', // ClankerHookStaticFee v4.0.0
    '0xd60D6B218116cFd801E28F78d011a203D2b068Cc', // ClankerHookDynamicFeeV2 v4.1.0
    '0xb429d62f8f3bFFb98CdB9569533eA23bF0Ba28CC', // ClankerHookStaticFeeV2 v4.1.0
];

// 常见费率配置
const FEE_CONFIGS = [
    { fee: 10000, tickSpacing: 200 },   // 1%
    { fee: 3000, tickSpacing: 60 },     // 0.3%
    { fee: 500, tickSpacing: 10 },      // 0.05%
    { fee: 100, tickSpacing: 1 },       // 0.01%
    // Clanker 可能使用动态费率标志
    { fee: 0x800000, tickSpacing: 200 }, // Dynamic fee flag
];

/**
 * 计算 PoolId
 * PoolKey 结构: (Currency currency0, Currency currency1, uint24 fee, int24 tickSpacing, IHooks hooks)
 */
function computePoolId(
    currency0: string,
    currency1: string,
    fee: number,
    tickSpacing: number,
    hooks: string
): string {
    // 排序 token
    const [sortedCurrency0, sortedCurrency1] =
        BigInt(currency0) < BigInt(currency1)
            ? [currency0, currency1]
            : [currency1, currency0];

    // ABI encode PoolKey
    // struct PoolKey { Currency currency0; Currency currency1; uint24 fee; int24 tickSpacing; IHooks hooks; }
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    // 尝试不同的 tickSpacing 编码方式
    // int24 需要正确处理
    let tickSpacingEncoded = tickSpacing;
    if (tickSpacing < 0) {
        // 负数需要转换为补码
        tickSpacingEncoded = (1 << 24) + tickSpacing;
    }

    const encoded = abiCoder.encode(
        ['address', 'address', 'uint24', 'int24', 'address'],
        [sortedCurrency0, sortedCurrency1, fee, tickSpacing, hooks]
    );

    const poolId = ethers.keccak256(encoded);
    return poolId;
}

async function main() {
    console.log('🔍 V4 PoolId 计算验证\n');
    console.log('已知池子: CLAWNCH/WETH');
    console.log('期望 PoolId:', KNOWN_POOLS[0].expectedPoolId);
    console.log('已知 lpFee:', KNOWN_POOLS[0].lpFee);
    console.log('');

    // 排序 tokens
    const [currency0, currency1] =
        BigInt(WETH) < BigInt(CLAWNCH)
            ? [WETH, CLAWNCH]
            : [CLAWNCH, WETH];

    console.log('Sorted tokens:');
    console.log('  currency0:', currency0);
    console.log('  currency1:', currency1);
    console.log('');

    // 尝试不同组合
    console.log('尝试不同的 fee + tickSpacing + hook 组合...\n');

    let found = false;
    for (const hook of CLANKER_HOOKS) {
        for (const { fee, tickSpacing } of FEE_CONFIGS) {
            const poolId = computePoolId(currency0, currency1, fee, tickSpacing, hook);

            if (poolId.toLowerCase() === KNOWN_POOLS[0].expectedPoolId.toLowerCase()) {
                console.log('✅ 找到匹配！');
                console.log('   Hook:', hook);
                console.log('   Fee:', fee);
                console.log('   TickSpacing:', tickSpacing);
                console.log('   计算的 PoolId:', poolId);
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (!found) {
        console.log('❌ 未找到匹配。尝试更多 tickSpacing 值...\n');

        // 尝试更多 tickSpacing
        const moreTickSpacings = [1, 10, 50, 60, 100, 200, 500, 1000];
        const moreFees = [100, 500, 3000, 10000, 0x800000];

        for (const hook of CLANKER_HOOKS) {
            for (const fee of moreFees) {
                for (const tickSpacing of moreTickSpacings) {
                    const poolId = computePoolId(currency0, currency1, fee, tickSpacing, hook);

                    if (poolId.toLowerCase() === KNOWN_POOLS[0].expectedPoolId.toLowerCase()) {
                        console.log('✅ 找到匹配！');
                        console.log('   Hook:', hook);
                        console.log('   Fee:', fee, fee === 0x800000 ? '(DYNAMIC_FEE)' : '');
                        console.log('   TickSpacing:', tickSpacing);
                        console.log('   计算的 PoolId:', poolId);
                        return;
                    }
                }
            }
        }

        // 暴力搜索 tickSpacing
        console.log('尝试暴力搜索所有 tickSpacing (1-1000)...\n');
        for (const hook of CLANKER_HOOKS) {
            for (const fee of [10000, 0x800000]) {
                for (let tickSpacing = 1; tickSpacing <= 1000; tickSpacing++) {
                    const poolId = computePoolId(currency0, currency1, fee, tickSpacing, hook);

                    if (poolId.toLowerCase() === KNOWN_POOLS[0].expectedPoolId.toLowerCase()) {
                        console.log('✅ 找到匹配！');
                        console.log('   Hook:', hook);
                        console.log('   Fee:', fee, fee === 0x800000 ? '(DYNAMIC_FEE)' : '');
                        console.log('   TickSpacing:', tickSpacing);
                        console.log('   计算的 PoolId:', poolId);
                        return;
                    }
                }
            }
        }

        console.log('❌ 仍未找到。可能需要检查更多 Hook 地址或原生 ETH 编码');
    }
}

main().catch(console.error);
