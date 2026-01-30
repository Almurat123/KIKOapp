import { callRpc } from './rpcManager.js';
import { getChainConfig } from '../config/chainConfig.js';
import { encodeFunctionData, decodeFunctionResult, parseAbi } from 'viem';

// Minimal ABI for ERC20 metadata
const ERC20_ABI = parseAbi([
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
]);

export interface OnChainMetadata {
    name: string;
    symbol: string;
    decimals: number;
}

/**
 * Fetch token metadata directly from chain via RPC (Failover safe)
 */
export async function getTokenMetadata(chainId: number, address: string): Promise<OnChainMetadata> {
    const normalized = address.toLowerCase();
    if (normalized === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' ||
        normalized === '0x0000000000000000000000000000000000000000') {
        const chain = getChainConfig(chainId);
        return {
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            decimals: chain.nativeCurrency.decimals
        };
    }
    // 1. Solana Handling
    if (chainId === 900) {
        try {
            // Solana Token Program: Get Mint Info
            // We use callRpc with 'getAccountInfo' and parse data manually or use a simple heuristic
            // For simplicity in this fallback, we might rely on a specific Solana RPC method if available
            // But standard JSON-RPC getAccountInfo with encoding jsonParsed is best
            const result = await callRpc(chainId, 'getAccountInfo', [
                address,
                { encoding: "jsonParsed" }
            ]);

            if (!result || !result.value) {
                throw new Error('Account not found');
            }

            const data = result.value.data;
            if (data.program !== 'spl-token' && data.program !== 'spl-token-2022') {
                throw new Error('Not an SPL token');
            }

            const info = data.parsed.info;
            return {
                name: 'Solana Token', // On-chain metadata requires Metaplex fetch, too complex for simple fallback. Use symbol/addr.
                symbol: 'SOL-TOKEN',  // Often not stored on Mint account directly without Metaplex
                decimals: info.decimals
            };
        } catch (e: any) {
            console.warn(`[RpcService] Solana fetch failed for ${address}:`, e.message);
            // Fallback for Solana: assume 6 decimals (common) or 9? 
            // Better to fail than guess wrong? Or Default to 6.
            // USDC is 6, SOL is 9. Most SPL are 6 or 9.
            throw e;
        }
    }

    // 2. EVM Handling (ETH, Base, BSC, etc.)
    const [nameResult, symbolResult, decimalsResult] = await Promise.allSettled([
        callEthCall(chainId, address, 'name'),
        callEthCall(chainId, address, 'symbol'),
        callEthCall(chainId, address, 'decimals')
    ]);

    const name = nameResult.status === 'fulfilled' ? nameResult.value as string : 'Unknown Token';
    const symbol = symbolResult.status === 'fulfilled' ? symbolResult.value as string : 'UNK';
    const decimals = decimalsResult.status === 'fulfilled' ? Number(decimalsResult.value) : 18; // Default to 18 if fail

    if (decimalsResult.status === 'rejected') {
        console.warn(`[RpcService] Failed to fetch decimals for ${address} on chain ${chainId}`);
    }

    return { name, symbol, decimals };
}

async function callEthCall(chainId: number, to: string, functionName: 'name' | 'symbol' | 'decimals') {
    const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: functionName
    });

    const resultHex = await callRpc<string>(chainId, 'eth_call', [{
        to,
        data
    }, 'latest']);

    return decodeFunctionResult({
        abi: ERC20_ABI,
        functionName: functionName,
        data: resultHex as `0x${string}`
    });
}
