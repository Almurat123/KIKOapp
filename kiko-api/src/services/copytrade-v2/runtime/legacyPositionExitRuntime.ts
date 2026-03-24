import { PublicKey } from '@solana/web3.js';
import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { DynamicTakeProfitService } from '../../dynamicTakeProfitService.js';
import { getSolanaConnection, SOLANA_CONFIG } from '../../../config/solanaConfig.js';
import { executeSolanaSwap } from '../../solanaExecutor.js';
import { getSolanaEmbeddedWalletAddress } from '../../privyWallet.js';
import { cacheHub } from '../../../cache/DataCacheHub.js';
import { trackCopyTrade, trackSwap } from '../../userActivityService.js';
import { notificationService } from '../../notificationService.js';
import { buildEvmExitPlan } from '../exit/planner.js';
import { executePlannedEvmExitFlow } from '../exit/evmExitExecutionFlow.js';
import {
    persistFailedExitState,
    persistDeferredExitRetryState,
    persistSuccessfulExit,
    reconcileNoopExitPosition
} from '../exit/persistence.js';
import { getExitInflightRetryGraceMs, hasRecentInflightExitRetryGuard } from '../exit/retryGuard.js';
import { resolveAttributedPositionExitAmount } from '../positions/positionAttribution.js';
import { shouldDeferStrongRpcMonitoring } from '../buy/preConfirmationRpcPolicy.js';
import { buildOrderAuditFields } from '../../order-runtime/sinks/persistence.js';
import type { OrderRuntimeContext } from '../../order-runtime/types.js';
import { repairCopytradePositionAttribution } from '../jobs/copytradeAttributionRepairJob.js';
import { evaluateAutoExitPriceGuard } from './autoExitPriceGuard.js';
import { TRADE_METADATA_PROFILE } from '../../rpc/profile.js';
import { getGuardPriceSnapshot } from './guardPrice.js';

const EXIT_INFLIGHT_RETRY_GRACE_MS = getExitInflightRetryGraceMs();
const MIN_POSITION_AGE_FOR_TPSL_MS = Math.max(0, Number(process.env.MIN_POSITION_AGE_FOR_TPSL_MS || '90000'));
const TPSL_CONSECUTIVE_HITS_REQUIRED = Math.max(1, Number(process.env.TPSL_CONSECUTIVE_HITS_REQUIRED || '2'));
const NO_OPEN_POSITIONS_LOG_WINDOW_MS = Number(process.env.NO_OPEN_POSITIONS_LOG_WINDOW_MS || '180000');
const COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP = (process.env.COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP || 'true') === 'true';
const MAX_EXIT_RETRIES = Math.max(1, Number(process.env.COPYTRADE_MAX_EXIT_RETRIES || '3'));
const EXIT_RETRY_COOLDOWN_MS = Math.max(5_000, Number(process.env.COPYTRADE_EXIT_RETRY_COOLDOWN_MS || '12000'));

type PositionStatusCompat = {
    lockStatuses: string[];
    activeOrLockedStatuses: string[];
    pendingCreateStatus: string;
    failedFinalStatus: string;
};

export type LegacyPositionExitRuntimeDeps = {
    positionsBeingExited: Set<string>;
    getPositionStatusCompat: () => Promise<PositionStatusCompat>;
    recordTpslHit: (positionId: string, side: 'tp' | 'sl', pnlPct: number) => number;
    clearTpslHit: (positionId: string) => void;
    pruneTpslTracker: () => void;
    resolveCopytradeSlippageBps: (config: any, userSettings: any) => number;
    resolveExecutionModeForConfig: (config: any) => any;
    resolveDisplayTokenSymbolAsync: (symbol: unknown, tokenAddress: string, chainId: number) => Promise<string>;
    formatTokenAmount: (amount: bigint, decimals: number) => number;
};

export type ExecutePositionExitParams = {
    userId: string;
    tokenAddress: string;
    chainId: number;
    exitReason: 'mirror_sell' | 'take_profit' | 'stop_loss' | 'manual' | 'dynamic_take_profit';
    tokenInfo?: any;
    config: any;
    userSettings?: any;
    positions?: Array<any>;
    pendingAttributedLots?: Array<any>;
    desiredSellRawOverride?: bigint;
    intentContext?: {
        intentId?: string;
        sourceEventId?: string;
        targetSellTxHash?: string;
        targetFullExitVerified?: boolean;
        targetSellRatioBps?: number | null;
    };
};

export async function executePositionExit(
    params: ExecutePositionExitParams,
    deps: LegacyPositionExitRuntimeDeps
): Promise<string | null> {
    const { userId, tokenAddress, chainId, exitReason, config } = params;
    const tokenInfo = params.tokenInfo ?? { price: 0, symbol: 'UNKNOWN' };
    const hasValidPrice = Number.isFinite(tokenInfo?.price) && tokenInfo.price > 0;

    logger.info(LogCode.EXE_TX_BROADCAST, 'Executing position exit', {
        userId,
        token: tokenAddress,
        reason: exitReason,
        chainId
    });

    let balance = 0n;
    let decimals = 18;
    let txHash = '';
    let exitRuntimeContext: OrderRuntimeContext | undefined;
    const user = config.user;
    let exitPositions: any[] = [];
    let persistedExitPositions: any[] = [];
    let persistedExitBalance = balance;

    const settings = params.userSettings || await prisma.userSettings.findUnique({ where: { userId } });
    const universalSlippageBps = deps.resolveCopytradeSlippageBps(config, settings);

    try {
        exitPositions = params.positions && params.positions.length > 0
            ? params.positions
            : await prisma.position.findMany({
                where: { userId, tokenAddress, chainId, status: { in: ['open', 'pending'] } }
            });

        if (exitPositions.length === 0) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping position exit: no attributed open positions supplied', {
                userId,
                token: tokenAddress,
                chainId,
                reason: exitReason
            });
            return null;
        }
        persistedExitPositions = exitPositions;
        persistedExitBalance = balance;

        if (chainId === 900) {
            let solAddress: string | null = null;
            try {
                solAddress = await getSolanaEmbeddedWalletAddress(user.privyDid);
            } catch (e: any) {
                logger.error(LogCode.API_AUTH_FAILED, 'Error fetching Solana wallet for exit', { userId, error: e.message });
            }

            if (!solAddress) {
                logger.warn(LogCode.API_AUTH_FAILED, 'Skipping Solana sell: No Solana wallet found in Privy', { userId });
                return null;
            }

            const BALANCE_FETCH_STRATEGIES: Array<['fast'|'cheap', 'critical'|'normal']> = [
                ['fast', 'critical'],
                ['cheap', 'critical'],
                ['fast', 'normal'],
            ];
            let accounts: any = { value: [] };
            let fetchSuccess = false;
            for (let i = 0; i < BALANCE_FETCH_STRATEGIES.length; i++) {
                const [strategy, importance] = BALANCE_FETCH_STRATEGIES[i];
                try {
                    const connection = getSolanaConnection(strategy, importance);
                    accounts = await connection.getParsedTokenAccountsByOwner(
                        new PublicKey(solAddress),
                        { mint: new PublicKey(tokenAddress) }
                    );
                    fetchSuccess = true;
                    if (accounts.value.length > 0) break;
                    if (i < BALANCE_FETCH_STRATEGIES.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                } catch (err) {
                    const isLast = i === BALANCE_FETCH_STRATEGIES.length - 1;
                    logger[isLast ? 'error' : 'warn'](
                        LogCode.API_FETCH_FAILED,
                        `Solana balance fetch failed [${strategy}/${importance}]${isLast ? ' after all strategies' : ', trying next strategy'}`,
                        { userId, token: tokenAddress, attempt: i, error: (err as Error).message }
                    );
                    if (!isLast) await new Promise(resolve => setTimeout(resolve, 400));
                }
            }

            let usedDbBalanceFallback = false;
            if (!fetchSuccess) {
                if (exitReason === 'mirror_sell' && exitPositions.length > 0) {
                    for (const pos of exitPositions) {
                        const rawExact = pos.entryAmountExact != null ? String(pos.entryAmountExact).trim() : '';
                        if (rawExact && rawExact !== '0') {
                            try { balance += BigInt(rawExact); } catch {}
                        }
                        if (balance === 0n) {
                            const dec = tokenInfo?.decimals ?? null;
                            const rawDecStr = pos.entryAmountDec != null ? String(pos.entryAmountDec).trim() : '';
                            if (dec != null && rawDecStr && rawDecStr !== '0') {
                                try { balance += BigInt(Math.trunc(Number(rawDecStr) * Math.pow(10, dec))); } catch {}
                            }
                        }
                        decimals = tokenInfo?.decimals ?? 6;
                    }
                    if (balance > 0n) {
                        usedDbBalanceFallback = true;
                        logger.warn(LogCode.API_FETCH_FAILED, 'Solana RPC exhausted during mirror sell — using DB position amount as balance fallback', {
                            userId, token: tokenAddress, balanceFallback: balance.toString(), decimals,
                            positionCount: exitPositions.length
                        });
                    } else {
                        logger.warn(LogCode.API_FETCH_FAILED, 'Skipping Solana sell: RPC exhausted and no usable amount in DB positions', { userId, token: tokenAddress });
                        return null;
                    }
                } else {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Skipping Solana sell: All RPC strategies exhausted, keeping position open', { userId, token: tokenAddress });
                    return null;
                }
            }

            if (!usedDbBalanceFallback) {
                for (const acc of accounts.value) {
                    const amount = BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                    balance += amount;
                    decimals = acc.account.data.parsed.info.tokenAmount.decimals;
                }
            }

            const attribution = resolveAttributedPositionExitAmount({
                positions: exitPositions,
                decimals,
                onChainBalanceRaw: balance,
                allowFullBalanceFallback: exitReason === 'mirror_sell',
            });

            const balanceUsd = deps.formatTokenAmount(balance, decimals) * (hasValidPrice ? tokenInfo.price : 0);

            if (balance <= 1000n) {
                const treatAsEmptyOrDust = balance <= 0n || balance <= 1000n || (hasValidPrice && balanceUsd < 0.1);
                if (treatAsEmptyOrDust) {
                    logger.throttled(LogCode.WTC_TX_SKIPPED, 'Closing database record for empty or negligible balance', {
                        userId,
                        token: tokenAddress,
                        balanceUsd,
                        reason: exitReason
                    });
                    await reconcileNoopExitPosition({
                        positions: exitPositions,
                        action: 'close_position',
                        closeReason: balance <= 0n ? 'balance_empty' : 'balance_dust'
                    });
                    return null;
                }
            }

            if (attribution.sellAmountRaw <= 0n) {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping Solana auto-exit: attributed position amount unavailable', {
                    userId,
                    token: tokenAddress,
                    chainId,
                    reason: exitReason,
                    reasonCode: attribution.reasonCode,
                    ...attribution.metrics
                });
                return null;
            }

            logger.info(LogCode.EXE_TX_BROADCAST, 'Selling token on Solana', {
                userId,
                balance: attribution.sellAmountRaw.toString(),
                valueUsd: balanceUsd.toFixed(2)
            });
            balance = attribution.sellAmountRaw;
            persistedExitPositions = attribution.eligiblePositions as any;
            persistedExitBalance = attribution.sellAmountRaw;

            let isPartialSell = false;
            try {
                txHash = await executeSolanaSwap({
                    userId: user.privyDid,
                    tokenInMint: tokenAddress,
                    tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                    amountIn: attribution.sellAmountRaw.toString(),
                    slippageBps: universalSlippageBps
                });
            } catch (e: any) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Solana 100% sell failed, retrying with AGGRESSIVE slippage', { userId, error: e.message });
                try {
                    const aggressiveSlippage = Math.min(Math.floor(universalSlippageBps * 1.25), 2000);
                    txHash = await executeSolanaSwap({
                        userId: user.privyDid,
                        tokenInMint: tokenAddress,
                        tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                        amountIn: attribution.sellAmountRaw.toString(),
                        slippageBps: aggressiveSlippage
                    });
                } catch (e2: any) {
                    try {
                        // Legacy survival retries follow the same rule as the new runtime:
                        // keep sell size constant and escalate slippage instead of shrinking amount.
                        const survivalSlippage = Math.min(Math.floor(universalSlippageBps * 1.5), 2500);
                        txHash = await executeSolanaSwap({
                            userId: user.privyDid,
                            tokenInMint: tokenAddress,
                            tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                            amountIn: attribution.sellAmountRaw.toString(),
                            slippageBps: survivalSlippage
                        });
                    } catch (e3: any) {
                        logger.error(LogCode.EXE_TX_REVERTED, 'All Solana sell attempts failed', { userId, token: tokenAddress, error: e3.message });
                        throw e3;
                    }
                }
            }

            if (txHash && attribution.metrics.hasExternalBalance) {
                logger.info(LogCode.SYS_INFO, 'Skipping Solana dust sweep due to external holdings detected', {
                    userId,
                    token: tokenAddress,
                    chainId,
                    ...attribution.metrics
                });
            } else if (txHash) {
                try {
                    const connection = getSolanaConnection();
                    const postSellAccounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(solAddress), { mint: new PublicKey(tokenAddress) });
                    let remainingBalance = 0n;
                    for (const acc of postSellAccounts.value) {
                        remainingBalance += BigInt(acc.account.data.parsed.info.tokenAmount.amount);
                    }
                    if (remainingBalance > 0n && !attribution.metrics.hasExternalBalance) {
                        const dustUsd = deps.formatTokenAmount(remainingBalance, decimals) * (tokenInfo?.price || 0);
                        if (dustUsd >= 0.05 || isPartialSell) {
                            await executeSolanaSwap({
                                userId: user.privyDid,
                                tokenInMint: tokenAddress,
                                tokenOutMint: SOLANA_CONFIG.TOKENS.SOL,
                                amountIn: remainingBalance.toString(),
                                slippageBps: 2000
                            });
                        }
                    }
                } catch (sweepErr: any) {
                    logger.debug(LogCode.EXE_TX_REVERTED, 'Solana dust sweep failed', { error: sweepErr.message });
                }
            }
        } else {
            const executionMode = deps.resolveExecutionModeForConfig(config);
            const exitPlan = await buildEvmExitPlan({
                userId: user.privyDid,
                walletAddress: user.walletAddress,
                tokenAddress,
                chainId,
                exitReason,
                tokenInfo,
                universalSlippageBps,
                executionMode,
                targetWallet: config.targetWallet,
                positions: exitPositions,
                pendingLots: params.pendingAttributedLots
            });

            balance = exitPlan.balance;
            decimals = exitPlan.decimals;
            persistedExitPositions = exitPlan.positions as any;
            persistedExitBalance = exitPlan.kind === 'swap' ? exitPlan.attributedBalance : balance;

            if (exitPlan.kind === 'noop') {
                if (exitPlan.action === 'keep_open') {
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Automatic exit skipped: attributed position amount unavailable or wallet balance not safely attributable', {
                        userId,
                        tokenAddress,
                        chainId,
                        reasonCode: exitPlan.attributedReasonCode || 'UNKNOWN',
                        attributionMetrics: exitPlan.attributionMetrics || null
                    });
                    const repairReasonCodes = new Set([
                        'ATTRIBUTED_AMOUNT_UNAVAILABLE',
                        'NO_CONFIRMED_POSITIONS',
                        'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
                    ]);
                    const exitKeepOpenReasonCode = String(exitPlan.attributedReasonCode || '');
                    if (repairReasonCodes.has(exitKeepOpenReasonCode)) {
                        const repairedPositionIds: string[] = [];
                        for (const position of exitPlan.positions) {
                            const positionId = String((position as any)?.id || '').trim();
                            if (!positionId) continue;
                            const repairOutcome = await repairCopytradePositionAttribution({
                                positionId,
                                chainId,
                                tokenAddress,
                                targetWallet: config?.targetWallet || null,
                            }).catch(() => 'repair_required' as const);
                            if (repairOutcome === 'repaired') {
                                repairedPositionIds.push(positionId);
                            }
                        }
                        if (repairedPositionIds.length > 0) {
                            await prisma.position.updateMany({
                                where: {
                                    id: { in: repairedPositionIds },
                                    status: 'open',
                                },
                                data: {
                                    lastExitAttempt: null,
                                    exitRetryCount: 1,
                                },
                            }).catch(() => null);
                            logger.info(LogCode.SYS_INFO, 'Inline attribution repair applied; scheduled immediate exit retry', {
                                userId,
                                tokenAddress,
                                chainId,
                                exitReason,
                                repairedPositionCount: repairedPositionIds.length,
                                repairedPositionIds,
                            });
                        }
                    }
                    const retryableKeepOpenReasonCodes = new Set([
                        'ATTRIBUTED_AMOUNT_UNAVAILABLE',
                        'NO_CONFIRMED_POSITIONS',
                        'PENDING_EXPECTED_AMOUNT_UNAVAILABLE',
                        'PENDING_BALANCE_NOT_VISIBLE_YET',
                    ]);
                    if (exitReason === 'mirror_sell' && retryableKeepOpenReasonCodes.has(exitKeepOpenReasonCode)) {
                        const retryPositionIds = exitPlan.positions
                            .map((position: any) => String(position?.id || '').trim())
                            .filter(Boolean);
                        if (retryPositionIds.length > 0) {
                            await prisma.position.updateMany({
                                where: {
                                    id: { in: retryPositionIds },
                                    status: { in: ['open', 'pending'] },
                                },
                                data: {
                                    exitReason: 'mirror_sell',
                                    exitRetryCount: 1,
                                    lastExitAttempt: null,
                                },
                            }).catch(() => null);
                            logger.info(LogCode.SYS_INFO, 'Mirror sell keep_open scheduled for retry', {
                                userId,
                                tokenAddress,
                                chainId,
                                reasonCode: exitKeepOpenReasonCode,
                                retryPositionIds,
                            });
                        }
                    }
                    return null;
                }

                if (exitPlan.action === 'retry_later') {
                    const retryMetrics = exitPlan.attributionMetrics || null;
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Exit deferred: balance oracle returned uncertain result', {
                        userId,
                        tokenAddress,
                        chainId,
                        exitReason,
                        reasonCode: exitPlan.attributedReasonCode || 'EXIT_BALANCE_RPC_UNCERTAIN',
                        balanceRaw: exitPlan.balance.toString(),
                        balanceUsd: exitPlan.balanceUsd,
                        oracleStatus: retryMetrics?.oracleStatus || null,
                        oracleReasonCode: retryMetrics?.oracleReasonCode || null,
                        oracleAttemptCount: retryMetrics?.oracleAttemptCount || null,
                        newestPositionAgeMs: retryMetrics?.newestPositionAgeMs || null,
                        pendingLotCount: retryMetrics?.pendingLotCount || null,
                        recentOwnershipEvidence: retryMetrics?.recentOwnershipEvidence || null,
                        mirrorSellDustCloseDeferred: retryMetrics?.mirrorSellDustCloseDeferred || null,
                        attributionMetrics: retryMetrics
                    });
                    await persistDeferredExitRetryState({
                        positions: exitPlan.positions as any,
                        targetWallet: config.targetWallet,
                        exitReason,
                        reasonCode: exitPlan.attributedReasonCode || 'EXIT_BALANCE_RPC_UNCERTAIN'
                    });
                    return null;
                }

                logger.throttled(LogCode.WTC_TX_SKIPPED, 'Negligible EVM balance, closing database records', {
                    userId,
                    tokenAddress,
                    balanceUsd: exitPlan.balanceUsd,
                    reason: exitReason,
                    isMirrorSell: exitPlan.isMirrorSell
                });
                await reconcileNoopExitPosition({
                    positions: exitPlan.positions as any,
                    action: exitPlan.action,
                    closeReason: exitPlan.closeReason
                });
                return null;
            }

            const evmExitResult = await executePlannedEvmExitFlow({
                exitPlan,
                exitReason,
                userId,
                walletAddress: user.walletAddress,
                chainId,
                tokenAddress,
                tokenInfo,
                targetWallet: config.targetWallet,
                persistedExitPositions: persistedExitPositions as any,
                copyTradeDisableMirrorSellDustSweep: COPYTRADE_DISABLE_MIRROR_SELL_DUST_SWEEP,
            });
            exitRuntimeContext = evmExitResult.runtimeContext;
            if (evmExitResult.status === 'pending') {
                return null;
            }
            txHash = evmExitResult.txHash || '';
        }

        if (txHash) {
            const exitPrice = hasValidPrice ? tokenInfo.price : 0;
            if (!hasValidPrice) {
                logger.warn(LogCode.API_FETCH_FAILED, 'Exit price missing from live data; persisting exit with unresolved USD valuation', {
                    userId,
                    token: tokenAddress,
                    fallbackSuppressed: true
                });
            }
            const { sellVolUsd } = await persistSuccessfulExit({
                positions: persistedExitPositions as any,
                txHash,
                exitReason,
                balance: persistedExitBalance,
                decimals,
                exitPrice
            });

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Position exit executed successfully', {
                userId,
                token: tokenAddress,
                reason: exitReason,
                txHash,
                ...buildOrderAuditFields(exitRuntimeContext)
            });

            trackCopyTrade(userId);
            trackSwap(userId, sellVolUsd);

            const reasonMap: Record<string, string> = {
                'mirror_sell': 'Mirror Sell',
                'take_profit': 'Take Profit',
                'stop_loss': 'Stop Loss',
                'manual': 'Manual Exit',
                'dynamic_take_profit': '🎯 Dynamic Take Profit'
            };

            const totalEntryUsd = persistedExitPositions.reduce(
                (sum: number, p: any) => sum + (Number(p.entryUsdValue) || 0),
                0
            );
            const displaySellValue = hasValidPrice && sellVolUsd > 0
                ? sellVolUsd.toFixed(2)
                : totalEntryUsd > 0
                    ? `~${totalEntryUsd.toFixed(2)}`
                    : '—';

            await notificationService.sendNotification({
                userId: user.privyDid,
                farcasterFid: user.farcasterFid,
                type: 'TRADE_SUCCESS_SELL',
                data: {
                    tokenSymbol: await deps.resolveDisplayTokenSymbolAsync(tokenInfo.symbol, tokenAddress, chainId),
                    usdValue: displaySellValue,
                    targetWallet: config.targetWallet,
                    txHash: txHash,
                    chainId: chainId,
                    alertTitle: reasonMap[exitReason] || exitReason
                }
            });
        }

        return txHash;

    } catch (error: any) {
        logger.error(LogCode.SYS_ERROR, 'Critical error during position exit', {
            userId,
            token: tokenAddress,
            error: error.message,
            stack: error.stack,
            ...buildOrderAuditFields(exitRuntimeContext)
        });

        try {
            const { retryCount, terminal } = await persistFailedExitState({
                positions: exitPositions as any,
                exitReason,
                maxRetries: MAX_EXIT_RETRIES
            });

            if (!terminal) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'Mirror sell failed, will retry via PositionMonitor', {
                    userId,
                    token: tokenAddress,
                    retryCount,
                    nextRetryIn: `${Math.max(1, EXIT_RETRY_COOLDOWN_MS / 1000)}s`,
                    reason: exitReason,
                    ...buildOrderAuditFields(exitRuntimeContext)
                });
            } else {
                logger.error(LogCode.EXE_TX_REVERTED, 'Mirror sell failed after max retries, marking as failed', {
                    userId,
                    token: tokenAddress,
                    retries: MAX_EXIT_RETRIES,
                    ...buildOrderAuditFields(exitRuntimeContext)
                });

                if (user.farcasterFid) {
                    await notificationService.sendNotification({
                        userId: user.privyDid,
                        farcasterFid: user.farcasterFid,
                        type: 'TRADE_FAILURE',
                        data: {
                            tokenSymbol: tokenInfo?.symbol || 'Unknown',
                            error: `Failed to exit after ${MAX_EXIT_RETRIES} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
                            targetWallet: config.targetWallet,
                            chainId: chainId
                        }
                    });
                }
            }
        } catch (dbErr: any) {
            logger.error(LogCode.SYS_ERROR, 'Failed to update position retry counter', { error: dbErr.message });
        }

        return null;
    }
}

export async function checkPositionsForExits(
    deps: LegacyPositionExitRuntimeDeps
): Promise<void> {
    deps.pruneTpslTracker();
    const positionStatusCompat = await deps.getPositionStatusCompat();
    void positionStatusCompat;

    const positionsNeedingRetry = await prisma.position.findMany({
        where: {
            status: 'open',
            exitRetryCount: { gt: 0, lte: MAX_EXIT_RETRIES },
            OR: [
                { lastExitAttempt: null },
                { lastExitAttempt: { lt: new Date(Date.now() - EXIT_RETRY_COOLDOWN_MS) } }
            ],
            NOT: {
                AND: [
                    { exitTxHash: { not: null } },
                    { lastExitAttempt: { gte: new Date(Date.now() - EXIT_INFLIGHT_RETRY_GRACE_MS) } }
                ]
            }
        },
        include: {
            user: { include: { settings: true } }
        }
    });

    const retryablePositions = positionsNeedingRetry.filter((position) => {
        const exitReason = String((position as any).exitReason || '').toLowerCase();
        if (exitReason === 'take_profit' || exitReason === 'stop_loss' || exitReason === 'dynamic_take_profit') {
            return false;
        }
        return !hasRecentInflightExitRetryGuard({
            exitTxHash: position.exitTxHash,
            lastExitAttempt: position.lastExitAttempt,
            graceMs: EXIT_INFLIGHT_RETRY_GRACE_MS,
        });
    });

    if (retryablePositions.length > 0) {
        logger.info(LogCode.SYS_STARTUP, `Found ${retryablePositions.length} positions needing exit retry`);

        for (const position of retryablePositions) {
            try {
                const config = await prisma.copyTradeConfig.findUnique({
                    where: { id: position.configId }
                });

                if (!config) {
                    logger.warn(LogCode.SYS_ERROR, 'Config not found for position retry', { positionId: position.id });
                    continue;
                }

                const tokenInfo = await getGuardPriceSnapshot(position.tokenAddress, position.chainId, {
                    priority: 'high',
                    rpcStrategy: TRADE_METADATA_PROFILE,
                });
                if (!tokenInfo) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Token info not available for retry', { token: position.tokenAddress });
                    continue;
                }

                logger.info(LogCode.EXE_TX_BROADCAST, `Retrying position exit (attempt ${position.exitRetryCount + 1})`, {
                    userId: position.userId,
                    token: position.tokenAddress,
                    retryCount: position.exitRetryCount
                });

                await executePositionExit({
                    userId: position.userId,
                    tokenAddress: position.tokenAddress,
                    chainId: position.chainId,
                    exitReason: (position.exitReason as any) || 'mirror_sell',
                    tokenInfo,
                    config: { ...config, user: position.user },
                    positions: [position]
                }, deps);
            } catch (err: any) {
                logger.error(LogCode.SYS_ERROR, 'Error during position exit retry', {
                    positionId: position.id,
                    error: err.message
                });
            }
        }
    }

    const positions = await prisma.position.findMany({
        where: { status: 'open' },
        include: { user: { include: { settings: true } } },
    });

    if (positions.length === 0) {
        logger.throttled(LogCode.SYS_STARTUP, 'No open positions to monitor', undefined, NO_OPEN_POSITIONS_LOG_WINDOW_MS);
        return;
    }

    logger.debug(LogCode.SYS_STARTUP, 'Monitoring open positions', { count: positions.length });

    const configIds = [...new Set(positions.map(p => p.configId))];
    const configs = await prisma.copyTradeConfig.findMany({
        where: { id: { in: configIds } }
    });
    const configMap = new Map(configs.map(c => [c.id, c]));

    const uniqueTokens = new Map<string, { address: string, chainId: number }>();
    positions.forEach(p => {
        const key = `${p.tokenAddress.toLowerCase()}_${p.chainId}`;
        if (!uniqueTokens.has(key)) {
            uniqueTokens.set(key, { address: p.tokenAddress, chainId: p.chainId });
        }
    });

    const tokenPriceMap = new Map<string, any>();
    for (const { address, chainId } of uniqueTokens.values()) {
        const snapshot = cacheHub.getTokenPriceSnapshot(address, chainId);
        if (snapshot) {
            tokenPriceMap.set(`${address.toLowerCase()}_${chainId}`, snapshot);
        }
    }

    const POSITION_BATCH_SIZE = 20;
    for (let i = 0; i < positions.length; i += POSITION_BATCH_SIZE) {
        const batch = positions.slice(i, i + POSITION_BATCH_SIZE);

        await Promise.all(batch.map(async (position) => {
            if (deps.positionsBeingExited.has(position.id)) return;

            try {
                const tokenKey = `${position.tokenAddress.toLowerCase()}_${position.chainId}`;
                const tokenInfo = tokenPriceMap.get(tokenKey);

                if (!tokenInfo) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'TP/SL check skipped: Price not available', {
                        positionId: position.id,
                        token: position.tokenSymbol || position.tokenAddress,
                        chainId: position.chainId,
                        configId: position.configId
                    });
                    return;
                }

                const currentPrice = tokenInfo.price;
                const profitLossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
                const positionAgeMs = Date.now() - new Date(position.createdAt).getTime();

                if (Number.isFinite(currentPrice) && currentPrice > 0 && Number.isFinite(profitLossPct)) {
                    void prisma.position.update({
                        where: { id: position.id },
                        data: { currentPrice, profitLossPct },
                    }).catch(() => undefined);
                }

                const config = configMap.get(position.configId);
                if (!config) {
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Orphaned position: Config not found', { positionId: position.id, configId: position.configId });
                    deps.clearTpslHit(position.id);
                    return;
                }

                const positionAgeMinutes = Math.floor((Date.now() - new Date(position.createdAt).getTime()) / 60000);
                if (positionAgeMinutes % 5 === 0 && positionAgeMinutes > 0) {
                    logger.info(LogCode.EXE_TX_BROADCAST, '📊 Position P/L check', {
                        token: position.tokenSymbol || 'Unknown',
                        entryPrice: position.entryPrice,
                        currentPrice: currentPrice,
                        profitLossPct: profitLossPct.toFixed(2) + '%',
                        takeProfitPct: config.takeProfitPct ? config.takeProfitPct + '%' : 'not set',
                        stopLossPct: config.stopLossPct ? config.stopLossPct + '%' : 'not set'
                    });
                }

                if (positionAgeMs < MIN_POSITION_AGE_FOR_TPSL_MS) {
                    deps.clearTpslHit(position.id);
                    logger.debug(LogCode.SYS_INFO, 'TP/SL guard: position too new', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        ageMs: positionAgeMs,
                        minAgeMs: MIN_POSITION_AGE_FOR_TPSL_MS,
                        pnlPct: Number.isFinite(profitLossPct) ? profitLossPct.toFixed(2) : 'NaN'
                    });
                    return;
                }

                if (shouldDeferStrongRpcMonitoring(position.createdAt)) {
                    deps.clearTpslHit(position.id);
                    logger.debug(LogCode.SYS_INFO, 'TP/SL guard: deferred until confirmation settles', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        ageMs: positionAgeMs,
                        pnlPct: Number.isFinite(profitLossPct) ? profitLossPct.toFixed(2) : 'NaN'
                    });
                    return;
                }

                const autoExitPriceGuard = evaluateAutoExitPriceGuard({ tokenInfo });
                if (!autoExitPriceGuard.allowed) {
                    deps.clearTpslHit(position.id);
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'TP/SL guard: anomalous price feed blocked auto-exit', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        chainId: position.chainId,
                        reasonCode: autoExitPriceGuard.reasonCode,
                        ...autoExitPriceGuard.metrics,
                    });
                    return;
                }

                if (config.takeProfitPct && profitLossPct >= config.takeProfitPct) {
                    const hitCount = deps.recordTpslHit(position.id, 'tp', profitLossPct);
                    if (hitCount < TPSL_CONSECUTIVE_HITS_REQUIRED) {
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Take Profit armed (awaiting confirmation tick)', {
                            positionId: position.id,
                            token: position.tokenSymbol || 'Unknown',
                            profitLossPct: profitLossPct.toFixed(2),
                            hitCount,
                            requiredHits: TPSL_CONSECUTIVE_HITS_REQUIRED
                        });
                        return;
                    }
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Take Profit triggered', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        profitLossPct: profitLossPct.toFixed(2)
                    });

                    deps.positionsBeingExited.add(position.id);
                    try {
                        await executePositionExit({
                            userId: position.userId,
                            tokenAddress: position.tokenAddress,
                            chainId: position.chainId,
                            exitReason: 'take_profit',
                            tokenInfo: tokenInfo,
                            config: { ...config, user: position.user },
                            positions: [position]
                        }, deps);
                    } finally {
                        deps.clearTpslHit(position.id);
                        deps.positionsBeingExited.delete(position.id);
                    }
                } else if (config.stopLossPct && profitLossPct <= -config.stopLossPct) {
                    const hitCount = deps.recordTpslHit(position.id, 'sl', profitLossPct);
                    if (hitCount < TPSL_CONSECUTIVE_HITS_REQUIRED) {
                        logger.info(LogCode.EXE_TX_BROADCAST, 'Stop Loss armed (awaiting confirmation tick)', {
                            positionId: position.id,
                            token: position.tokenSymbol || 'Unknown',
                            profitLossPct: profitLossPct.toFixed(2),
                            hitCount,
                            requiredHits: TPSL_CONSECUTIVE_HITS_REQUIRED
                        });
                        return;
                    }
                    logger.info(LogCode.EXE_TX_BROADCAST, 'Stop Loss triggered', {
                        positionId: position.id,
                        token: position.tokenSymbol || 'Unknown',
                        profitLossPct: profitLossPct.toFixed(2)
                    });

                    deps.positionsBeingExited.add(position.id);
                    try {
                        await executePositionExit({
                            userId: position.userId,
                            tokenAddress: position.tokenAddress,
                            chainId: position.chainId,
                            exitReason: 'stop_loss',
                            tokenInfo: tokenInfo,
                            config: { ...config, user: position.user },
                            positions: [position]
                        }, deps);
                    } finally {
                        deps.clearTpslHit(position.id);
                        deps.positionsBeingExited.delete(position.id);
                    }
                } else {
                    deps.clearTpslHit(position.id);
                    const fullConfig = config as any;
                    if (fullConfig.enableDynamicTP) {
                        const positionWithConfig = {
                            ...position,
                            config: fullConfig
                        };

                        const dtpResult = await DynamicTakeProfitService.checkDynamicTP(
                            positionWithConfig as any,
                            currentPrice
                        );

                        if (dtpResult.shouldSell) {
                            logger.info(LogCode.EXE_TX_BROADCAST, '🎯 Dynamic Take Profit triggered', {
                                positionId: position.id,
                                token: position.tokenSymbol || 'Unknown',
                                reason: dtpResult.reason,
                                urgency: dtpResult.urgency,
                                profitLossPct: profitLossPct.toFixed(2)
                            });

                            const dynamicSlippage = dtpResult.urgency === 'emergency'
                                ? 5000
                                : deps.resolveCopytradeSlippageBps(config, position.user.settings);

                            if (dtpResult.urgency === 'emergency') {
                                logger.warn(LogCode.EXE_TX_BROADCAST, `⚠️  [DynamicTP] Applying EMERGENCY slippage: ${dynamicSlippage} bps`, {
                                    positionId: position.id,
                                    token: position.tokenSymbol ?? undefined
                                });
                            }

                            deps.positionsBeingExited.add(position.id);
                            try {
                                await executePositionExit({
                                    userId: position.userId,
                                    tokenAddress: position.tokenAddress,
                                    chainId: position.chainId,
                                    exitReason: 'dynamic_take_profit',
                                    tokenInfo: tokenInfo,
                                    config: { ...config, user: position.user },
                                    positions: [position],
                                }, deps);
                            } finally {
                                deps.positionsBeingExited.delete(position.id);
                            }
                        }
                    }
                }

            } catch (error: any) {
                logger.error(LogCode.SYS_ERROR, 'Error monitoring position', {
                    positionId: position.id,
                    token: position.tokenAddress,
                    error: error.message
                });
            }
        }));
    }
}
