import { ethers } from 'ethers';

/**
 * 调试 CREATE2 池地址计算
 */
async function debugCreate2() {
    const factoryAddress = '0x33128a8fC17869897dcE68Ed026d694621f6FDfD'; // Base Uniswap V3
    const tokenAddress = '0xa1F72459dfA10BAD200Ac160eCd78C6b77a747be'; // CLAWNCH
    const wrappedNative = '0x4200000000000000000000000000000000000006'; // WETH on Base
    const initCodeHash = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54';

    const FEE_TIERS = [3000, 500, 10000];

    console.log('🔍 Debugging CREATE2 Pool Address Calculation\n');
    console.log(`Factory: ${factoryAddress}`);
    console.log(`Token: ${tokenAddress}`);
    console.log(`WETH: ${wrappedNative}`);
    console.log(`Init Code Hash: ${initCodeHash}\n`);

    for (const fee of FEE_TIERS) {
        const [token0, token1] = tokenAddress.toLowerCase() < wrappedNative.toLowerCase()
            ? [tokenAddress, wrappedNative]
            : [wrappedNative, tokenAddress];

        console.log(`\n━━━ Fee Tier: ${fee / 10000}% ━━━`);
        console.log(`Token0: ${token0}`);
        console.log(`Token1: ${token1}`);

        const salt = ethers.keccak256(
            ethers.AbiCoder.defaultAbiCoder().encode(
                ['address', 'address', 'uint24'],
                [token0, token1, fee]
            )
        );
        console.log(`Salt: ${salt}`);

        const poolAddress = ethers.getCreate2Address(factoryAddress, salt, initCodeHash);
        console.log(`Computed Pool: ${poolAddress}`);
    }

    // Now call RPC to get actual pool addresses
    console.log('\n━━━ Actual Pool Addresses from RPC ━━━');

    const rpcUrl = 'https://base-mainnet.g.alchemy.com/v2/demo';
    const factoryInterface = new ethers.Interface([
        'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
    ]);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const factory = new ethers.Contract(factoryAddress, factoryInterface, provider);

    for (const fee of FEE_TIERS) {
        try {
            const pool = await factory.getPool(tokenAddress, wrappedNative, fee);
            console.log(`Fee ${fee / 10000}%: ${pool}`);
        } catch (e: any) {
            console.log(`Fee ${fee / 10000}%: Error - ${e.message}`);
        }
    }

    process.exit(0);
}

debugCreate2().catch(console.error);
