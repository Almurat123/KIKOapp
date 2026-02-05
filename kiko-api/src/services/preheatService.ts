import { ethers } from 'ethers';
import { getPreheatConfig } from '../config/preheat.js';
import { CHAINS } from '../config/chainConfig.js';
import { normalizeAddress } from '../utils/address.js';
import { buildV4SwapTransaction } from './dex/uniswapV4Swap.js';
import { findV4Pools } from './dex/uniswapV4.js';
import { callRpc } from './rpcManager.js';
import { isClankerHook } from './dex/v4Hooks.js';
import { extractRevertReason } from '../utils/evm.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export interface PreheatEvent {
    chainId: number;
    tokenAddress: string;
    factoryAddress?: string;
    eventName?: string;
    txHash?: string;
    blockNumber?: number | string;
}

interface PreheatStatus {
    status: 'open' | 'closed' | 'no_pool' | 'unknown';
    reason?: string;
    poolHook?: string;
    updatedAt: number;
}

const preheatConfig = getPreheatConfig();
const preheatQueue: Array<{ event: PreheatEvent; attempt: number }> = [];
const preheatInflight = new Set<string>();
const preheatStatus = new Map<string, PreheatStatus>();
let activeWorkers = 0;

function buildKey(chainId: number, tokenAddress: string): string {
    return `${chainId}:${tokenAddress.toLowerCase()}`;
}

function isCacheFresh(status?: PreheatStatus): boolean {
    if (!status) return false;
    return Date.now() - status.updatedAt < preheatConfig.ttlMs;
}

function scheduleRetry(event: PreheatEvent, attempt: number) {
    const delay = preheatConfig.retryScheduleMs[Math.min(attempt, preheatConfig.retryScheduleMs.length - 1)];
    setTimeout(() => {
        enqueuePreheat(event, attempt + 1);
    }, delay);
}

export function enqueuePreheat(event: PreheatEvent, attempt = 0) {
    if (!preheatConfig.enabled) return;
    if (!preheatConfig.chainIds.includes(event.chainId)) return;

    const key = buildKey(event.chainId, event.tokenAddress);
    const cached = preheatStatus.get(key);
    if (cached && isCacheFresh(cached)) return;
    if (preheatInflight.has(key)) return;

    preheatQueue.push({ event, attempt });
    processQueue();
}

function processQueue() {
    if (activeWorkers >= preheatConfig.concurrency) return;
    const job = preheatQueue.shift();
    if (!job) return;

    activeWorkers += 1;
    const { event, attempt } = job;
    const key = buildKey(event.chainId, event.tokenAddress);
    preheatInflight.add(key);

    runPreheat(event, attempt)
        .catch((err) => {
            logger.warn(LogCode.API_FETCH_FAILED, '[Preheat] Task failed', {
                error: err?.message?.slice(0, 160),
                token: event.tokenAddress,
                chainId: event.chainId
            });
        })
        .finally(() => {
            preheatInflight.delete(key);
            activeWorkers -= 1;
            if (preheatQueue.length > 0) processQueue();
        });
}

async function runPreheat(event: PreheatEvent, attempt: number) {
    const chainConfig = CHAINS[event.chainId];
    if (!chainConfig) return;

    const token = normalizeAddress(event.tokenAddress);
    const weth = normalizeAddress(chainConfig.wrappedNativeAddress);

    if (!token || token === weth) return;

    // 1) Try WETH pair first (most Clanker pools)
    let pools = await findV4Pools(token, weth, event.chainId, { strategy: 'cheap' });
    let pool = pools[0];

    // 2) Fallback to stable pairs for discovery (no gate check)
    if (!pool && chainConfig.stablecoins?.length) {
        for (const stable of chainConfig.stablecoins) {
            pools = await findV4Pools(token, stable, event.chainId, { strategy: 'cheap' });
            pool = pools[0];
            if (pool) break;
        }
    }

    if (!pool) {
        if (attempt < preheatConfig.maxAttempts) {
            scheduleRetry(event, attempt);
        } else {
            preheatStatus.set(buildKey(event.chainId, token), {
                status: 'no_pool',
                updatedAt: Date.now()
            });
        }
        return;
    }

    const hook = pool.poolKey.hooks;
    const isClanker = isClankerHook(event.chainId, hook);
    const poolStatus: PreheatStatus = {
        status: 'unknown',
        poolHook: hook,
        updatedAt: Date.now()
    };

    // Gate check only when WETH pool exists (to avoid ERC20 approvals)
    if (normalizeAddress(pool.poolKey.currency0) === weth || normalizeAddress(pool.poolKey.currency1) === weth) {
        const zeroForOne = normalizeAddress(pool.poolKey.currency0) === weth;
        const amountInWei = ethers.parseEther(preheatConfig.amountInEth);
        const deadline = Math.floor(Date.now() / 1000) + 60;

        const tx = buildV4SwapTransaction(
            event.chainId,
            pool.poolKey,
            zeroForOne,
            amountInWei,
            0n,
            preheatConfig.callerAddress,
            deadline,
            true,
            false
        );

        try {
            await callRpc<string>(event.chainId, 'eth_call', [{
                from: preheatConfig.callerAddress,
                to: tx.to,
                data: tx.data,
                value: ethers.toQuantity(amountInWei)
            }, 'latest'], { strategy: 'cheap' });

            poolStatus.status = 'open';
        } catch (err: any) {
            const reason = extractRevertReason(err?.message);
            if (reason && (reason.toLowerCase().includes('not open') || reason.toLowerCase().includes('chill bro'))) {
                poolStatus.status = 'closed';
                poolStatus.reason = reason;
            } else {
                poolStatus.status = 'unknown';
                poolStatus.reason = reason || err?.message?.slice(0, 120);
            }
        }
    }

    preheatStatus.set(buildKey(event.chainId, token), poolStatus);

    logger.info(LogCode.API_FETCH_SUCCESS, '[Preheat] V4 pool warmed', {
        token,
        chainId: event.chainId,
        hook: pool.poolKey.hooks,
        clanker: isClanker,
        status: poolStatus.status,
        reason: poolStatus.reason?.slice(0, 64)
    });
}

export function getPreheatStatus(chainId: number, tokenAddress: string): PreheatStatus | null {
    const key = buildKey(chainId, tokenAddress);
    const status = preheatStatus.get(key);
    if (!status || !isCacheFresh(status)) return null;
    return status;
}

function extractAddressesFromObject(input: any): string[] {
    if (!input || typeof input !== 'object') return [];
    const addresses: string[] = [];
    for (const value of Object.values(input)) {
        if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
            addresses.push(value.toLowerCase());
        }
    }
    return addresses;
}

function extractTokenAddressFromPayload(data: any, factoryAddress?: string): string | null {
    const candidates: string[] = [];
    const normalizedFactory = factoryAddress?.toLowerCase();

    const directKeys = [
        'token',
        'tokenAddress',
        'token_address',
        'newToken',
        'new_token',
        'createdToken',
        'created_token',
        'erc20',
        'erc20Address',
        'tokenContract',
        'asset',
        'collection',
        'collectionAddress'
    ];

    for (const key of directKeys) {
        const value = data?.[key];
        if (typeof value === 'string' && value.startsWith('0x') && value.length === 42) {
            candidates.push(value.toLowerCase());
        }
    }

    if (data?.args && typeof data.args === 'object') {
        candidates.push(...extractAddressesFromObject(data.args));
    }
    if (data?.event && typeof data.event === 'object') {
        candidates.push(...extractAddressesFromObject(data.event));
    }

    const filtered = candidates.filter(addr =>
        addr !== '0x0000000000000000000000000000000000000000' &&
        addr !== normalizedFactory
    );

    const unique = Array.from(new Set(filtered));
    if (unique.length === 1) return unique[0];
    return unique[0] || null;
}

function parseChainId(raw?: string | number): number | null {
    if (!raw) return null;
    if (typeof raw === 'number') return raw;
    const normalized = raw.toLowerCase();

    if (normalized.startsWith('eip155:')) {
        const num = Number(normalized.split(':')[1]);
        return Number.isFinite(num) ? num : null;
    }

    if (/^\\d+$/.test(normalized)) {
        const num = Number(normalized);
        return Number.isFinite(num) ? num : null;
    }

    if (normalized.includes('base')) return 8453;
    if (normalized.includes('ethereum') || normalized === 'mainnet' || normalized === 'eth') return 1;

    return null;
}

export function handleCdpWebhookPayload(payload: any) {
    if (!preheatConfig.enabled) return;

    const type = payload?.type || payload?.event?.type || payload?.data?.type;
    const data = payload?.data || payload?.event?.data || payload?.event || payload;
    const eventName = (data?.eventName || payload?.eventName || payload?.event?.eventName || '').toString();

    if (!type && !eventName) return;
    if (type && !type.toLowerCase().includes('onchain')) return;
    if (!eventName) return;
    if (!preheatConfig.eventNames.includes(eventName.toLowerCase())) {
        return;
    }

    const chainId = parseChainId(data?.networkId || payload?.networkId || data?.chainId || payload?.chainId);
    if (!chainId) return;

    const factoryAddress = normalizeAddress(data?.contractAddress || data?.contract || data?.address);

    const allowlist = preheatConfig.factoryAllowlist[chainId] || [];
    if (allowlist.length > 0 && factoryAddress && !allowlist.includes(factoryAddress)) {
        return;
    }

    const tokenAddress = extractTokenAddressFromPayload(data, factoryAddress);
    if (!tokenAddress) return;

    enqueuePreheat({
        chainId,
        tokenAddress,
        factoryAddress,
        eventName,
        txHash: data?.transactionHash || payload?.transactionHash,
        blockNumber: data?.blockNumber || payload?.blockNumber
    });
}
