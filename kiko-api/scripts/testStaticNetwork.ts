/**
 * 测试 staticNetwork 对性能的影响
 * 验证是否是 Provider 初始化问题导致延迟
 */

import { ethers } from 'ethers';

const TEST_URL = 'https://ethereum-rpc.publicnode.com';
const CHAIN_ID = 1;

async function testWithoutStaticNetwork() {
    console.log('❌ 测试 WITHOUT staticNetwork:');

    const start = Date.now();
    const provider = new ethers.JsonRpcProvider(TEST_URL, CHAIN_ID);
    const initTime = Date.now() - start;
    console.log(`   Provider 创建时间: ${initTime}ms`);

    const blockStart = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const blockTime = Date.now() - blockStart;
    console.log(`   第一次 getBlockNumber: ${blockTime}ms (Block: ${blockNumber})`);

    const block2Start = Date.now();
    await provider.getBlockNumber();
    const block2Time = Date.now() - block2Start;
    console.log(`   第二次 getBlockNumber: ${block2Time}ms`);

    const block3Start = Date.now();
    await provider.getBlockNumber();
    const block3Time = Date.now() - block3Start;
    console.log(`   第三次 getBlockNumber: ${block3Time}ms`);

    return { first: blockTime, second: block2Time, third: block3Time };
}

async function testWithStaticNetwork() {
    console.log('\n✅ 测试 WITH staticNetwork:');

    const start = Date.now();
    const provider = new ethers.JsonRpcProvider(TEST_URL, CHAIN_ID, { staticNetwork: true });
    const initTime = Date.now() - start;
    console.log(`   Provider 创建时间: ${initTime}ms`);

    const blockStart = Date.now();
    const blockNumber = await provider.getBlockNumber();
    const blockTime = Date.now() - blockStart;
    console.log(`   第一次 getBlockNumber: ${blockTime}ms (Block: ${blockNumber})`);

    const block2Start = Date.now();
    await provider.getBlockNumber();
    const block2Time = Date.now() - block2Start;
    console.log(`   第二次 getBlockNumber: ${block2Time}ms`);

    const block3Start = Date.now();
    await provider.getBlockNumber();
    const block3Time = Date.now() - block3Start;
    console.log(`   第三次 getBlockNumber: ${block3Time}ms`);

    return { first: blockTime, second: block2Time, third: block3Time };
}

async function testProviderReuse() {
    console.log('\n🔄 测试 Provider 复用:');

    // 创建并缓存 Provider
    const provider = new ethers.JsonRpcProvider(TEST_URL, CHAIN_ID, { staticNetwork: true });

    // 预热
    await provider.getBlockNumber();
    console.log('   (预热完成)');

    // 连续 5 次调用
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await provider.getBlockNumber();
        times.push(Date.now() - start);
    }

    console.log(`   连续调用: ${times.map(t => `${t}ms`).join(', ')}`);
    console.log(`   平均: ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)}ms`);

    return times;
}

async function main() {
    console.log('🚀 ethers.js Provider 性能测试\n');
    console.log('='.repeat(60));

    const without = await testWithoutStaticNetwork();
    const withStatic = await testWithStaticNetwork();
    const reuse = await testProviderReuse();

    console.log('\n' + '='.repeat(60));
    console.log('📊 结果对比:');
    console.log('-'.repeat(60));
    console.log(`无 staticNetwork 第一次调用: ${without.first}ms`);
    console.log(`有 staticNetwork 第一次调用: ${withStatic.first}ms`);
    console.log(`Provider 复用后平均调用: ${(reuse.reduce((a, b) => a + b, 0) / reuse.length).toFixed(0)}ms`);

    const improvement = ((without.first - withStatic.first) / without.first * 100).toFixed(0);
    console.log(`\n🎯 staticNetwork 性能提升: ${improvement}%`);

    console.log('\n✅ 测试完成!\n');
}

main().catch(console.error);
