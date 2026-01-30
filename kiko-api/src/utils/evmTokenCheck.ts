import { ethers } from 'ethers';
import { callRpc } from '../services/rpcManager.js';

const ERC20_IFACE = new ethers.Interface([
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address owner) view returns (uint256)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
]);

async function tryDecodeCall(
    chainId: number,
    address: string,
    fn: 'totalSupply' | 'decimals' | 'balanceOf' | 'symbol' | 'name',
    args: any[] = []
): Promise<boolean> {
    try {
        const data = ERC20_IFACE.encodeFunctionData(fn, args);
        const result = await callRpc<string>(chainId, 'eth_call', [{ to: address, data }, 'latest']);
        if (!result || result === '0x') return false;
        ERC20_IFACE.decodeFunctionResult(fn, result);
        return true;
    } catch {
        return false;
    }
}

export async function isErc20ContractAddress(chainId: number, address: string): Promise<boolean> {
    if (!address || !address.startsWith('0x')) return false;

    try {
        const code = await callRpc<string>(chainId, 'eth_getCode', [address, 'latest']);
        if (!code || code === '0x' || code === '0x0') return false;
    } catch {
        // If we can't fetch code, fail open to avoid blocking legitimate wallets.
        return false;
    }

    const [hasTotalSupply, hasDecimals, hasBalanceOf, hasSymbol, hasName] = await Promise.all([
        tryDecodeCall(chainId, address, 'totalSupply'),
        tryDecodeCall(chainId, address, 'decimals'),
        tryDecodeCall(chainId, address, 'balanceOf', [ethers.ZeroAddress]),
        tryDecodeCall(chainId, address, 'symbol'),
        tryDecodeCall(chainId, address, 'name'),
    ]);

    const successCount = [hasTotalSupply, hasDecimals, hasBalanceOf, hasSymbol, hasName].filter(Boolean).length;
    return successCount >= 2;
}
