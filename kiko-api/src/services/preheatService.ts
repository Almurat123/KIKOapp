import { ethers } from 'ethers';
import { getPreheatConfig } from '../config/preheat.js';
import { CHAINS } from '../config/chainConfig.js';
import { normalizeAddress } from '../utils/address.js';
import { buildV4SwapTransaction } from './dex/uniswapV4Swap.js';
import { findV4Pools, getV4PoolInfo, matchV4PoolKeyById, V4PoolKey } from './dex/uniswapV4.js';
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
    detectedAt?: number;
    poolId?: string;
    poolHook?: string;
    pairedToken?: string;
    startingTick?: number | string;
}

interface PreheatStatus {
    status: 'open' | 'closed' | 'no_pool' | 'unknown';
    reason?: string;
    poolHook?: string;
    updatedAt: number;
    firstSeenAt?: number;
    lastAttemptAt?: number;
    attempts?: number;
}

const preheatConfig = getPreheatConfig();
const preheatQueue: Array<{ event: PreheatEvent; attempt: number }> = [];
const preheatInflight = new Set<string>();
const preheatStatus = new Map<string, PreheatStatus>();
const preheatFirstSeen = new Map<string, number>();
let activeWorkers = 0;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<T>;
}

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

    const normalizedToken = normalizeAddress(event.tokenAddress) || event.tokenAddress;
    const key = buildKey(event.chainId, normalizedToken);
    if (!preheatFirstSeen.has(key)) {
        preheatFirstSeen.set(key, event.detectedAt || Date.now());
    }
    const cached = preheatStatus.get(key);
    if (cached && isCacheFresh(cached)) return;
    if (preheatInflight.has(key)) return;

    logger.info(LogCode.SYS_INFO, '[Preheat] Enqueue', {
        chainId: event.chainId,
        token: event.tokenAddress,
        factory: event.factoryAddress,
        eventName: event.eventName,
        attempt,
        sinceFirstSeenMs: Date.now() - (preheatFirstSeen.get(key) || Date.now()),
        queueDepth: preheatQueue.length
    });

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
    const key = buildKey(event.chainId, normalizeAddress(event.tokenAddress) || event.tokenAddress);
    logger.info(LogCode.SYS_INFO, '[Preheat] Start', {
        chainId: event.chainId,
        token: event.tokenAddress,
        factory: event.factoryAddress,
        eventName: event.eventName,
        poolId: event.poolId,
        poolHook: event.poolHook,
        attempt,
        sinceFirstSeenMs: Date.now() - (preheatFirstSeen.get(key) || Date.now())
    });

    const chainConfig = CHAINS[event.chainId];
    if (!chainConfig) {
        logger.warn(LogCode.SYS_INFO, '[Preheat] Skip (no chain config)', {
            chainId: event.chainId
        });
        return;
    }

    const token = normalizeAddress(event.tokenAddress);
    const weth = normalizeAddress(chainConfig.wrappedNativeAddress);
    const keyNormalized = buildKey(event.chainId, token);

    if (!token) {
        logger.warn(LogCode.SYS_INFO, '[Preheat] Skip (empty token)', {
            chainId: event.chainId,
            token: event.tokenAddress
        });
        return;
    }

    if (token === weth) {
        logger.warn(LogCode.SYS_INFO, '[Preheat] Skip (token is WETH)', {
            chainId: event.chainId,
            token
        });
        return;
    }

    try {
        // 0) Try to resolve poolId directly from payload (fast path)
        let pool: any = null;
        const payloadPoolId = event.poolId ? event.poolId.toLowerCase() : null;
        const payloadHook = event.poolHook ? event.poolHook.toLowerCase() : null;
        const paired = normalizeAddress(event.pairedToken || '') || weth;
        let matchedPoolKey: V4PoolKey | null = null;

        if (payloadPoolId && paired) {
            matchedPoolKey = matchV4PoolKeyById(event.chainId, payloadPoolId, token, paired, payloadHook);
            if (matchedPoolKey) {
                logger.info(LogCode.SYS_INFO, '[Preheat] PoolId matched config', {
                    chainId: event.chainId,
                    token,
                    pairedToken: paired,
                    poolId: payloadPoolId,
                    hook: matchedPoolKey.hooks,
                    fee: matchedPoolKey.fee,
                    tickSpacing: matchedPoolKey.tickSpacing,
                    attempt
                });
                const info = await withTimeout(
                    getV4PoolInfo(matchedPoolKey, event.chainId, { strategy: 'cheap' }),
                    3000,
                    'getV4PoolInfo(payload)'
                ).catch(() => null);
                pool = info || {
                    poolId: payloadPoolId,
                    poolKey: matchedPoolKey,
                    sqrtPriceX96: '0',
                    tick: 0,
                    liquidity: '0',
                    protocolFee: 0,
                    lpFee: 0
                };
            }
            if (!matchedPoolKey) {
                logger.warn(LogCode.SYS_INFO, '[Preheat] PoolId not matched to config', {
                    chainId: event.chainId,
                    token,
                    pairedToken: paired,
                    poolId: payloadPoolId,
                    poolHook: payloadHook,
                    attempt
                });
            }
        }

        // 1) Try WETH pair first (most Clanker pools)
        let pools: any[] = [];
        if (!pool) {
            pools = await withTimeout(
                findV4Pools(token, weth, event.chainId, { strategy: 'cheap' }),
                5000,
                'findV4Pools(WETH)'
            );
            pool = pools[0];
        }

        // 2) Fallback to stable pairs for discovery (no gate check)
        if (!pool && chainConfig.stablecoins?.length) {
            for (const stable of chainConfig.stablecoins) {
                pools = await withTimeout(
                    findV4Pools(token, stable, event.chainId, { strategy: 'cheap' }),
                    5000,
                    'findV4Pools(stable)'
                );
                pool = pools[0];
                if (pool) break;
            }
        }

        if (!pool) {
            if (attempt < preheatConfig.maxAttempts) {
                logger.info(LogCode.SYS_INFO, '[Preheat] No pool yet, retry scheduled', {
                    chainId: event.chainId,
                    token,
                    attempt,
                    sinceFirstSeenMs: Date.now() - (preheatFirstSeen.get(key) || Date.now())
                });
                scheduleRetry(event, attempt);
            } else {
                preheatStatus.set(keyNormalized, {
                    status: 'no_pool',
                    updatedAt: Date.now(),
                    firstSeenAt: preheatFirstSeen.get(key),
                    lastAttemptAt: Date.now(),
                    attempts: attempt + 1
                });
                logger.info(LogCode.SYS_INFO, '[Preheat] No pool found (max attempts)', {
                    chainId: event.chainId,
                    token,
                    sinceFirstSeenMs: Date.now() - (preheatFirstSeen.get(key) || Date.now())
                });
            }
            return;
        }

        const hook = pool.poolKey.hooks;
        const isClanker = isClankerHook(event.chainId, hook);
        logger.info(LogCode.SYS_INFO, '[Preheat] Pool found', {
            chainId: event.chainId,
            token,
            poolId: pool.poolId,
            hook,
            fee: pool.poolKey.fee,
            tickSpacing: pool.poolKey.tickSpacing,
            currency0: pool.poolKey.currency0,
            currency1: pool.poolKey.currency1,
            clanker: isClanker,
            attempt,
            sinceFirstSeenMs: Date.now() - (preheatFirstSeen.get(key) || Date.now())
        });
        const poolStatus: PreheatStatus = {
            status: 'unknown',
            poolHook: hook,
            updatedAt: Date.now(),
            firstSeenAt: preheatFirstSeen.get(key),
            lastAttemptAt: Date.now(),
            attempts: attempt + 1
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
                await withTimeout(
                    callRpc<string>(event.chainId, 'eth_call', [{
                        from: preheatConfig.callerAddress,
                        to: tx.to,
                        data: tx.data,
                        value: ethers.toQuantity(amountInWei)
                    }, 'latest'], { strategy: 'cheap' }),
                    5000,
                    'eth_call(preheat)'
                );

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

        preheatStatus.set(keyNormalized, poolStatus);

        logger.info(LogCode.API_FETCH_SUCCESS, '[Preheat] V4 pool warmed', {
            token,
            chainId: event.chainId,
            hook: pool.poolKey.hooks,
            clanker: isClanker,
            status: poolStatus.status,
            reason: poolStatus.reason?.slice(0, 64),
            sinceFirstSeenMs: Date.now() - (preheatFirstSeen.get(key) || Date.now()),
            attempts: attempt + 1
        });
    } catch (err: any) {
        logger.warn(LogCode.API_FETCH_FAILED, '[Preheat] Error', {
            chainId: event.chainId,
            token: event.tokenAddress,
            error: err?.message?.slice(0, 160)
        });
    }
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
    if (data?.parameters && typeof data.parameters === 'object') {
        candidates.push(...extractAddressesFromObject(data.parameters));
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

function parseTimestampMs(raw?: any): number | null {
    if (!raw) return null;
    if (typeof raw === 'number') {
        if (raw > 1e12) return raw;
        if (raw > 1e9) return raw * 1000;
        return raw;
    }
    if (typeof raw === 'string') {
        if (raw.startsWith('0x')) {
            const num = Number(BigInt(raw));
            return Number.isFinite(num) ? (num > 1e12 ? num : num * 1000) : null;
        }
        const asNum = Number(raw);
        if (Number.isFinite(asNum)) {
            return asNum > 1e12 ? asNum : asNum * 1000;
        }
        const parsed = Date.parse(raw);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return null;
}

export function handleCdpWebhookPayload(payload: any) {
    if (!preheatConfig.enabled) return;

    const type = payload?.type || payload?.event?.type || payload?.data?.type;
    const data = payload?.data || payload?.event?.data || payload?.event || payload;
    const eventName = (
        data?.eventName ||
        data?.event_name ||
        payload?.eventName ||
        payload?.event_name ||
        payload?.event?.eventName ||
        payload?.event?.event_name ||
        ''
    ).toString();

    const debug = (process.env.CDP_DEBUG_PREHEAT || '').toLowerCase() === 'true';

    if (!type && !eventName) {
        if (debug) console.log('[Preheat] Skip: missing type and eventName');
        return;
    }
    if (type && !type.toLowerCase().includes('onchain')) {
        if (debug) console.log('[Preheat] Skip: non-onchain type', { type });
        return;
    }
    if (eventName && !preheatConfig.eventNames.includes(eventName.toLowerCase())) {
        if (debug) console.log('[Preheat] Skip: eventName not allowlisted', { eventName });
        return;
    }

    const chainId = parseChainId(
        data?.networkId ||
        payload?.networkId ||
        data?.chainId ||
        payload?.chainId ||
        data?.network ||
        payload?.network
    );
    if (!chainId) {
        if (debug) console.log('[Preheat] Skip: unknown chainId', { network: data?.network || payload?.network });
        return;
    }

    const factoryAddress = normalizeAddress(
        data?.contractAddress ||
        data?.contract_address ||
        data?.contract ||
        data?.address
    );

    const allowlist = preheatConfig.factoryAllowlist[chainId] || [];
    if (allowlist.length > 0 && factoryAddress && !allowlist.includes(factoryAddress)) {
        if (debug) console.log('[Preheat] Skip: factory not allowlisted', { factoryAddress, chainId });
        return;
    }

    const tokenAddress = extractTokenAddressFromPayload(data, factoryAddress);
    if (!tokenAddress) {
        if (debug) console.log('[Preheat] Skip: tokenAddress not found', { factoryAddress, eventName });
        return;
    }

    const poolId =
        data?.poolId ||
        data?.pool_id ||
        data?.parameters?.poolId ||
        data?.parameters?.pool_id ||
        payload?.poolId ||
        payload?.pool_id;
    const poolHook =
        data?.poolHook ||
        data?.pool_hook ||
        data?.parameters?.poolHook ||
        data?.parameters?.pool_hook ||
        payload?.poolHook ||
        payload?.pool_hook;
    const pairedToken =
        data?.pairedToken ||
        data?.paired_token ||
        data?.parameters?.pairedToken ||
        data?.parameters?.paired_token ||
        payload?.pairedToken ||
        payload?.paired_token;
    const startingTick =
        data?.startingTick ||
        data?.starting_tick ||
        data?.parameters?.startingTick ||
        data?.parameters?.starting_tick ||
        payload?.startingTick ||
        payload?.starting_tick;

    const detectedAt =
        parseTimestampMs(data?.timestamp) ||
        parseTimestampMs(payload?.timestamp) ||
        parseTimestampMs(data?.blockTimestamp) ||
        parseTimestampMs(payload?.blockTimestamp) ||
        Date.now();

    if (debug) {
        console.log('[Preheat] Enqueue', {
            chainId,
            tokenAddress,
            factoryAddress,
            eventName,
            detectedAt
        });
    }

    enqueuePreheat({
        chainId,
        tokenAddress,
        factoryAddress,
        eventName,
        txHash: data?.transactionHash || payload?.transactionHash,
        blockNumber: data?.blockNumber || payload?.blockNumber,
        detectedAt,
        poolId: typeof poolId === 'string' ? poolId : undefined,
        poolHook: typeof poolHook === 'string' ? poolHook : undefined,
        pairedToken: typeof pairedToken === 'string' ? pairedToken : undefined,
        startingTick
    });
}
