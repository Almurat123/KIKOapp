import { ethers } from 'ethers';

// Clanker V4 hooks (MEV auction hooks require hookData)
// [Ref]: https://clanker.gitbook.io/clanker-documentation/references/core-contracts/v4
export const CLANKER_HOOKS_BY_CHAIN: Record<number, string[]> = {
    8453: [
        '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc', // ClankerHookStaticFeeV2 v4.1.0
        '0xd60d6b218116cfd801e28f78d011a203d2b068cc', // ClankerHookDynamicFeeV2 v4.1.0
        '0x34a45c6b61876d739400bd71228cbcbd4f53e8cc', // ClankerHookDynamicFee v4.0.0
        '0xdd5eeaff7bd481ad55db083062b13a3cdf0a68cc', // ClankerHookStaticFee v4.0.0
        '0x7debe6943acefe85c4ee81aadd736466e07528cc', // Clanker hook variant seen in recent Base txs
    ]
};

export function isClankerHook(chainId: number, hookAddress: string): boolean {
    const hooks = CLANKER_HOOKS_BY_CHAIN[chainId] || [];
    return hooks.some(h => h.toLowerCase() === hookAddress.toLowerCase());
}

export function buildClankerHookData(payee: string): string {
    // PoolSwapData: (bytes mevModuleSwapData, bytes poolExtensionSwapData)
    // mevModuleSwapData = abi.encode(address payee)
    const mevModuleSwapData = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [payee]);
    return ethers.AbiCoder.defaultAbiCoder().encode(['bytes', 'bytes'], [mevModuleSwapData, '0x']);
}
