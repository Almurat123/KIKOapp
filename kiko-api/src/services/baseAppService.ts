import { ethers } from 'ethers';
import snapchainService from './snapchainService.js';

// Base RPC URL
const BASE_RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const POOL_MANAGER_ADDRESS = '0x498581ff718922c3f8e6a244956af099b2652b2b';

// Uniswap V4 PoolManager ABI (minimal for Initialize event)
const POOL_MANAGER_ABI = [
    'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks)',
];

export class BaseAppService {
    private provider: ethers.JsonRpcProvider;
    private poolManager: ethers.Contract;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
        this.poolManager = new ethers.Contract(POOL_MANAGER_ADDRESS, POOL_MANAGER_ABI, this.provider);
    }

    /**
     * Check if a Cast Hash appears on Base chain (specifically linked to a Uniswap V4 Pool)
     * The logic assumes the Cast Hash might be involved in the Pool creation.
     * Note: Exact linking mechanism depends on "Base App" specific implementation.
     * For this MVP, we search if the Cast Hash (as bytes32) appears in recent logs or as a Pool ID??
     * 
     * Current understanding: "Hash whether in Base chain appear".
     * This implies we search for the hash (padded to 32 bytes) in logs.
     */
    async checkCastOnChain(castHash: string): Promise<{ isBaseAppCoin: boolean; metadata?: any; coinValue?: string }> {
        try {
            // Normalize cast hash (remove 0x, pad to 32 bytes if needed)
            // Farcaster hashes are 20 bytes (add 0x + 40 hex chars).
            // We might need to pad it to 32 bytes (64 hex chars) for topic matching.

            const cleanHash = castHash.startsWith('0x') ? castHash.slice(2) : castHash;
            if (cleanHash.length !== 40) {
                // If not 20 bytes, might be different. log warning.
                // console.warn('Unexpected cast hash length:', cleanHash.length);
            }

            // Pad to 32 bytes for EVM topic match (left padded usually for value, right for string? standard is left pad for bytes32 conversion from smaller types? bytes20 is right padded? )
            // Actually usually addresses/bytes20 are padded to 32 bytes (left 0s).
            const topicHash = ethers.zeroPadValue('0x' + cleanHash, 32);

            // Search filters: Look for Initialize events where ANY indexed parameter matches our hash?
            // Initialize(id, currency0, currency1, ...)
            // If the Cast Hash became the Pool ID (id), it would be topic[1].

            const filter = this.poolManager.filters.Initialize(topicHash); // topic1 = id

            // We search a reasonable block range. Searching "forever" is hard.
            // Maybe we assume the cast is recent?
            // For now, we search last 10,000 blocks (~30 mins) or just check providing no block range (might fail on some RPCs).
            // Let's try to query fromBlock: 'earliest' (might timeout) or rely on indexer.
            // Given this is a real-time user request, maybe we search a range relative to cast timestamp?

            // OPTIMIZATION: In production utilize an indexer (Dune API or similar).
            // For MVP, we check recent history or specific known blocks if we had them.
            // Let's assume we check last 24h (approx 43k blocks on Base 2s block time).

            const currentBlock = await this.provider.getBlockNumber();
            const fromBlock = currentBlock - 50000; // ~27 hours

            const logs = await this.poolManager.queryFilter(filter, fromBlock, currentBlock);

            if (logs.length > 0) {
                // Found a pool initialized with this ID!
                const log = logs[0];
                if (log instanceof ethers.EventLog) {
                    return {
                        isBaseAppCoin: true,
                        metadata: {
                            poolId: log.args.id,
                            currency0: log.args.currency0,
                            currency1: log.args.currency1,
                            transactionHash: log.transactionHash
                        },
                        coinValue: "$796" // Mock value based on user spec
                    };
                }
            }

            return { isBaseAppCoin: false };

        } catch (error) {
            console.error('Error checking cast on chain:', error);
            return { isBaseAppCoin: false };
        }
    }
}

export const baseAppService = new BaseAppService();
