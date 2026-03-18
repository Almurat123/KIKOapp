import { buildRecoverablePendingEntryTxHash } from '../buy/pendingProtectionPolicy.js';
import { resolveEntryDeviationCurrentPrice } from '../buy/entryDeviationPriceSelection.js';
import { releaseMirrorSellAfterBuyConfirm } from '../buy/buyConfirmationMirrorSellRelease.js';
import { TRADE_METADATA_PROFILE } from '../../rpc/profile.js';

type SingleUserBuyResult = {
    outcome: 'executed' | 'pending' | 'skipped' | 'failed';
};

export async function processSingleUserBuy(params: {
    config: any;
    userSettings: any;
    targetWallet: string;
    tokenToBuy: string;
    swap: any;
    chainId: number;
    tokenInfo: any;
    targetSwapValueUsd: number;
    strictTargetSwapValueUsd: number;
    strictTargetSwapValueReliable: boolean;
    strictTargetSwapValueSource: string;
    strictMinGuardRequired: boolean;
    isFallbackMode: boolean;
    scalingFactor?: number;
    sharedNativePrice?: number;
    launchpadPromise?: Promise<any>;
    tokenInfoCache?: Map<string, Promise<any>>;
    timing?: any;
    detectedAt?: number;
}, deps: any): Promise<SingleUserBuyResult> {
    const {
        withTradeLock,
        resolveExecutionModeForConfig,
        resolveBuyGuardPolicy,
        getPositionStatusCompat,
        emitCopyTradeBuyGuardAudit,
        logger,
        LogCode,
        getCopyTradeDispatchTimingAnchor,
        isCopyTradeDelayExceeded,
        emitCopyTradeTimingAudit,
        isTokenLockedForUser,
        resolveCopytradeSlippageBps,
        resolveEntryDeviationModePolicy,
        resolveEffectivePositiveThreshold,
        resolveEffectiveMinTargetValueUsd,
        roundGuardNumber,
        shouldEnforceBuyGuard,
        sendNotificationAsync,
        buildCopyTradeNotificationEvidence,
        isBelowMinTargetValue,
        MAX_COPY_TRADE_USD,
        notificationService,
        getNativeTokenPriceUsd,
        describeCooldownMode,
        ethers,
        getReferenceExpectedOutput,
        evaluateBuyPriceDeviationGuard,
        emitEntryDeviationSummary,
        isEntryDeviationPriceUnreliable,
        getDexPriceWithTimeout,
        getNativeBalance,
        getChainConfig,
        prisma,
        buildDuplicateTradeWhere,
        resolveLaunchpad,
        getSolanaEmbeddedWalletAddress,
        executeSwapViaPort,
        SOLANA_CONFIG,
        zoraSniperService,
        env,
        isJudgeEnabledByCopyTradeConfig,
        fourMemeService,
        executeEvmCopytradeBuySubmissionFlow,
        getPendingNonce,
        getTokenInfoOnce,
        getTokenInfo,
        persistCopytradeBuySubmission,
        resolveDisplayTokenSymbol,
        buildOrderAuditFields,
        resolveDisplayTokenSymbolAsync,
        applyBuyConfirmationTransition,
        scheduleCopytradeBuyConfirmationFlow,
        SELL_PREHEAT_DELAY_MS,
        SELL_PREHEAT_CONFIRM_TIMEOUT_MS,
        SELL_PREHEAT_CONFIRM_POLL_MS,
        trackCopyTrade,
        trackSwap,
        getEnabledCopyTradeAiMode,
        runPostBuyAiFlow,
        resolveCopyTradeAiMode,
        compactCopyTradeError,
        inferCopyTradeBugHint,
        cleanupPendingCopytradePosition
    } = deps;

    const {
        config,
        userSettings,
        targetWallet,
        tokenToBuy,
        swap,
        chainId,
        tokenInfo,
        targetSwapValueUsd,
        strictTargetSwapValueUsd,
        strictTargetSwapValueReliable,
        strictTargetSwapValueSource,
        strictMinGuardRequired,
        scalingFactor = 1.0,
        sharedNativePrice = 0,
        launchpadPromise,
        tokenInfoCache,
        timing,
        detectedAt
    } = params;

    return withTradeLock(`${config.userId}:${tokenToBuy.toLowerCase()}`, async () => {
        let judgeDecisionId: string | null = null;
        const executionMode = resolveExecutionModeForConfig(config);
        const turboMode = executionMode === 'turbo';
        const guardPolicy = resolveBuyGuardPolicy(executionMode);
        const positionStatusCompat = await getPositionStatusCompat();
        const leaderTxHash = String(swap?.txHash || '').toLowerCase().trim();
        const guardAudit: Record<string, unknown> = {
            userId: config.userId,
            token: tokenToBuy,
            chainId,
            executionMode,
            guardPolicy: guardPolicy.name,
            turboMode,
            sourceTxHash: swap?.txHash || null,
            minTargetValue: null,
            priceDeviation: null,
            cooldown: null,
            marketCap: null,
            minLiquidity: null,
            liquiditySource: tokenInfo?.guardLiquiditySource || null,
            liquidityPoolCount: tokenInfo?.guardLiquidityPoolCount ?? null,
            liquidityProgram: tokenInfo?.guardLiquidityMeta?.dominantProgramLabel || tokenInfo?.guardLiquidityMeta?.dominantProgram || null,
            liquidityScanSource: tokenInfo?.guardLiquidityMeta?.source || null,
        };
        const emitGuardAudit = (
            decision: 'pass' | 'skip',
            reason: string,
            extra?: Record<string, unknown>
        ) => {
            emitCopyTradeBuyGuardAudit(guardAudit, decision, reason, extra);
        };
        let pendingPositionId: string | null = null;
        let pendingPositionCreatedAt: Date | null = null;
        let pendingPositionSettled = false;
        let preservePendingPosition = false;
        let attributedEntryAmountHuman: string | null = null;
        let txHash = '';
        let txLifecycleStatus: string | undefined;
        let orderRuntimeContext: any = undefined;
        let swapMetadata: any = undefined;

        try {
            const dispatchTimingAnchor = getCopyTradeDispatchTimingAnchor(timing);
            const inboundDelayMs = dispatchTimingAnchor.timestamp ? Math.max(0, Date.now() - dispatchTimingAnchor.timestamp) : null;
            if (inboundDelayMs !== null && inboundDelayMs > 800) {
                logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeTiming] user buy dispatch delay', {
                    userId: config.userId,
                    token: tokenToBuy,
                    chainId,
                    inboundDelayMs,
                    delayFirstSeenMs: timing?.firstSeenAt ? Math.max(0, Date.now() - timing.firstSeenAt) : null,
                    delayAnchor: dispatchTimingAnchor.delayAnchor,
                    executionMode
                });
            }
            const delayCheck = isCopyTradeDelayExceeded(timing || detectedAt, turboMode);
            emitCopyTradeTimingAudit('buy_dispatch_gate', timing, {
                userId: config.userId,
                token: tokenToBuy,
                chainId,
                executionMode,
                turboMode,
                delayMs: delayCheck.delayMs,
                hardDelayMs: delayCheck.hardDelayMs,
                maxDelayMs: delayCheck.maxDelayMs,
                delayAnchor: delayCheck.delayAnchor,
                reasonCode: delayCheck.reasonCode || null,
                skip: delayCheck.skip
            });
            if (delayCheck.skip) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: copytrade delay exceeded', {
                    userId: config.userId,
                    token: tokenToBuy,
                    delayMs: delayCheck.delayMs,
                    hardDelayMs: delayCheck.hardDelayMs,
                    maxDelayMs: delayCheck.maxDelayMs,
                    delayAnchor: delayCheck.delayAnchor,
                    reasonCode: delayCheck.reasonCode,
                    turboMode,
                    hint: 'dispatch delay is from dispatchEligibleAt/swapReadyAt; hard cap still uses firstSeenAt'
                });
                return { outcome: 'skipped' };
            }

            if (isTokenLockedForUser(config.userId, tokenToBuy, swap?.txHash)) {
                logger.throttled(LogCode.WTC_TX_SKIPPED, 'Skipping trade: token lock active', {
                    userId: config.userId,
                    token: tokenToBuy,
                    sourceTxHash: swap?.txHash
                });
                return { outcome: 'skipped' };
            }

            const universalSlippageBps = resolveCopytradeSlippageBps(config, userSettings);
            const entryDeviationPolicy = resolveEntryDeviationModePolicy(config, executionMode);

            const effectiveConfig = {
                ...config,
                minMarketCapUsd: resolveEffectivePositiveThreshold(config.minMarketCapUsd, null),
                minLiquidityUsd: resolveEffectivePositiveThreshold(config.minLiquidityUsd, null),
                minTargetValueUsd: resolveEffectiveMinTargetValueUsd(config, null),
                maxSlippageBps: universalSlippageBps,
                maxEntryDeviationBps: entryDeviationPolicy.maxEntryDeviationBps,
                maxEntryDeviationSource: entryDeviationPolicy.source,
                maxEntryDeviationReasonCode: entryDeviationPolicy.reasonCode,
                maxEntryDeviationThresholdPolicy: entryDeviationPolicy.thresholdPolicy,
                maxEntryDeviationModeFloorBps: entryDeviationPolicy.modeFloorBps,
            };
            const observedMarketCapUsd = Number(tokenInfo?.marketCap || 0);
            const observedLiquidityUsd = Number(
                tokenInfo?.guardLiquidityUsd ?? tokenInfo?.liquidity ?? 0
            );
            const minMarketCapUsd = Number(effectiveConfig.minMarketCapUsd || 0);
            const minLiquidityUsd = Number(effectiveConfig.minLiquidityUsd || 0);
            guardAudit.marketCap = {
                minUsd: roundGuardNumber(minMarketCapUsd),
                observedUsd: roundGuardNumber(observedMarketCapUsd),
                pass: minMarketCapUsd <= 0 ? true : observedMarketCapUsd >= minMarketCapUsd,
                enforced: shouldEnforceBuyGuard(guardPolicy, 'minMarketCap')
            };
            guardAudit.minLiquidity = {
                minUsd: roundGuardNumber(minLiquidityUsd),
                observedUsd: roundGuardNumber(observedLiquidityUsd),
                pass: minLiquidityUsd <= 0 ? true : observedLiquidityUsd >= minLiquidityUsd,
                enforced: shouldEnforceBuyGuard(guardPolicy, 'minLiquidity'),
                source: tokenInfo?.guardLiquiditySource || 'token_info',
                reliable: Boolean(tokenInfo?.guardLiquidityReliable ?? (observedLiquidityUsd > 0)),
                poolCount: Number(tokenInfo?.guardLiquidityPoolCount || 0)
            };

            const minTargetValueUsd = resolveEffectiveMinTargetValueUsd(effectiveConfig, null);
            const normalizedTargetSwapValueUsd = Number.isFinite(targetSwapValueUsd) ? targetSwapValueUsd : 0;
            const normalizedStrictTargetSwapValueUsd = Number.isFinite(strictTargetSwapValueUsd) ? strictTargetSwapValueUsd : 0;
            const effectiveTargetSwapValueUsd = strictTargetSwapValueReliable
                ? normalizedStrictTargetSwapValueUsd
                : normalizedTargetSwapValueUsd;
            guardAudit.minTargetValue = {
                minUsd: roundGuardNumber(minTargetValueUsd),
                broadUsd: roundGuardNumber(normalizedTargetSwapValueUsd),
                strictUsd: roundGuardNumber(normalizedStrictTargetSwapValueUsd),
                effectiveUsd: roundGuardNumber(effectiveTargetSwapValueUsd),
                strictReliable: strictTargetSwapValueReliable,
                strictRequired: strictMinGuardRequired,
                strictSource: strictTargetSwapValueSource
            };

            if (shouldEnforceBuyGuard(guardPolicy, 'minTargetValue') && minTargetValueUsd > 0 && strictMinGuardRequired && !strictTargetSwapValueReliable) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: strict min-target cash guard unavailable', {
                    userId: config.userId,
                    token: tokenToBuy,
                    txHash: swap.txHash,
                    minTargetValueUsd,
                    strictSource: strictTargetSwapValueSource,
                    broadTargetSwapValueUsd: Number(normalizedTargetSwapValueUsd.toFixed(2))
                });
                sendNotificationAsync({
                    userId: config.userId,
                    farcasterFid: config.user.farcasterFid,
                    type: 'COPY_TRADE_SKIPPED',
                    data: {
                        tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                        tokenAddress: tokenToBuy,
                        targetWallet: targetWallet,
                        chainId: chainId,
                        skipReason: `Unable to verify target cash value for strict min gate ($${minTargetValueUsd.toFixed(2)}).`,
                        ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: normalizedTargetSwapValueUsd }),
                    }
                }, 'copytrade_skip_min_target_guard_unavailable');
                emitGuardAudit('skip', 'min_target_guard_unavailable');
                return { outcome: 'skipped' };
            }

            if (shouldEnforceBuyGuard(guardPolicy, 'minTargetValue') && minTargetValueUsd > 0 && isBelowMinTargetValue(effectiveTargetSwapValueUsd, minTargetValueUsd)) {
                logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: target value below user minimum', {
                    userId: config.userId,
                    token: tokenToBuy,
                    txHash: swap.txHash,
                    targetSwapValueUsd: Number(normalizedTargetSwapValueUsd.toFixed(2)),
                    effectiveTargetSwapValueUsd: Number(effectiveTargetSwapValueUsd.toFixed(2)),
                    strictTargetSwapValueUsd: Number(normalizedStrictTargetSwapValueUsd.toFixed(2)),
                    strictSource: strictTargetSwapValueSource,
                    strictReliable: strictTargetSwapValueReliable,
                    minTargetValueUsd,
                });

                sendNotificationAsync({
                    userId: config.userId,
                    farcasterFid: config.user.farcasterFid,
                    type: 'COPY_TRADE_SKIPPED',
                    data: {
                        tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                        tokenAddress: tokenToBuy,
                        targetWallet: targetWallet,
                        chainId: chainId,
                        skipReason: `Target buy value $${effectiveTargetSwapValueUsd.toFixed(2)} < min $${minTargetValueUsd.toFixed(2)}`,
                        ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: effectiveTargetSwapValueUsd }),
                    }
                }, 'copytrade_skip_min_target_value');
                emitGuardAudit('skip', 'min_target_value_below_threshold');
                return { outcome: 'skipped' };
            }

            const isFastMode = config.fastExecutionEnabled !== false;
            if ((!tokenInfo || !tokenInfo.price) && !isFastMode) {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: Token info invalid and Fast Mode disabled', { userId: config.userId, token: tokenToBuy });
                return { outcome: 'skipped' };
            }

            const rawUsdAmount = Number(config.buyAmountUsd);
            if (!Number.isFinite(rawUsdAmount) || rawUsdAmount <= 0 || rawUsdAmount > MAX_COPY_TRADE_USD) {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: Invalid buy amount', {
                    userId: config.userId,
                    buyAmountUsd: config.buyAmountUsd
                });

                await notificationService.sendNotification({
                    userId: config.userId,
                    farcasterFid: config.user.farcasterFid,
                    type: 'COPY_TRADE_SKIPPED',
                    data: {
                        tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                        tokenAddress: tokenToBuy,
                        targetWallet: targetWallet,
                        chainId: chainId,
                        skipReason: `Invalid buy amount ($${String(config.buyAmountUsd)}). Please update your copy trade amount.`,
                        ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                    }
                });

                return { outcome: 'skipped' };
            }

            const usdAmount = rawUsdAmount * scalingFactor;

            if (scalingFactor < 1.0) {
                logger.info(LogCode.EXE_QUOTE_FETCHED, '📉 Trade scaled for liquidity protection', {
                    userId: config.userId,
                    originalAmount: rawUsdAmount.toFixed(2),
                    scaledAmount: usdAmount.toFixed(2),
                    scalingFactor: scalingFactor.toFixed(3)
                });
            }

            let nativePrice = sharedNativePrice;
            if (!Number.isFinite(nativePrice) || nativePrice <= 1) {
                const fallbackNative = await getNativeTokenPriceUsd(chainId);
                if (Number.isFinite(fallbackNative) && fallbackNative > 1) {
                    nativePrice = fallbackNative;
                } else {
                    logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping trade: Native price unavailable', {
                        userId: config.userId,
                        chainId,
                        nativePrice
                    });

                    await notificationService.sendNotification({
                        userId: config.userId,
                        farcasterFid: config.user.farcasterFid,
                        type: 'COPY_TRADE_SKIPPED',
                        data: {
                            tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                            tokenAddress: tokenToBuy,
                            targetWallet: targetWallet,
                            chainId: chainId,
                            skipReason: 'Native token price unavailable. Please retry in a moment.',
                            ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                        }
                    });

                    return { outcome: 'skipped' };
                }
            }

            const cooldownMinutes = config.copyTradeTokenCooldownMinutes ?? userSettings?.copyTradeTokenCooldownMinutes ?? 60;
            guardAudit.cooldown = {
                minutes: cooldownMinutes,
                enabled: cooldownMinutes > 0,
                mode: describeCooldownMode(cooldownMinutes)
            };

            let targetExecutionPrice = 0;
            let entryDeviationReferencePrice = 0;
            let entryDeviationReferenceSource: 'market_oracle_price' | 'local_quote_price' | 'reference_unavailable' = 'reference_unavailable';
            if (targetSwapValueUsd > 0) {
                try {
                    const estimatedOut = Number(ethers.formatUnits(swap.amountOut, tokenInfo.decimals || (chainId === 900 ? 9 : 18)));
                    if (estimatedOut > 0) {
                        let localQuotePriceUsd = 0;
                        let localQuoteProvider: string | undefined;
                        let oraclePriceSource: 'market_oracle_price' | 'local_quote_price' = 'market_oracle_price';
                        if (chainId !== 900) {
                            try {
                                const amountInWei = ethers.parseUnits((usdAmount / nativePrice).toFixed(18), 18);
                                const quotedAmountOutWei = await getReferenceExpectedOutput(
                                    '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                                    tokenToBuy,
                                    amountInWei,
                                    chainId,
                                    effectiveConfig.maxSlippageBps,
                                    effectiveConfig.user.walletAddress,
                                    {
                                        enableZoraRoutes: true,
                                        traceId: `[copytrade-guard:${config.userId}:${tokenToBuy.slice(0, 8)}]`
                                    }
                                ).catch(() => 0n);

                                const quotedAmountOut = quotedAmountOutWei > 0n
                                    ? Number(ethers.formatUnits(quotedAmountOutWei, tokenInfo.decimals || 18))
                                    : 0;
                                if (quotedAmountOut > 0) {
                                    localQuotePriceUsd = usdAmount / quotedAmountOut;
                                    localQuoteProvider = 'direct-reference-quote';
                                    oraclePriceSource = 'local_quote_price';
                                }
                            } catch {
                                localQuotePriceUsd = 0;
                            }
                        }

                        const priceDeviationGuard = evaluateBuyPriceDeviationGuard({
                            chainId,
                            oraclePrice: localQuotePriceUsd > 0 ? localQuotePriceUsd : Number(tokenInfo.price || 0),
                            oraclePriceSource,
                            oracleProvider: localQuotePriceUsd > 0 ? localQuoteProvider : tokenInfo.provider,
                            oracleDexName: tokenInfo.rpcDexName,
                            oracleValidationReason: tokenInfo.priceValidationReason,
                            referencePrice: tokenInfo.referencePrice,
                            referenceProvider: tokenInfo.referenceProvider,
                            oracleFallbackUsed: Boolean(tokenInfo.priceFallbackUsed),
                            estimatedOut,
                            targetSwapValueUsd,
                            strictTargetSwapValueUsd,
                            strictTargetSwapValueReliable,
                            strictTargetSwapValueSource,
                            policy: guardPolicy,
                                maxRatio: 3,
                        });
                        targetExecutionPrice = priceDeviationGuard.targetExecutionPrice;
                        entryDeviationReferencePrice = Number(priceDeviationGuard.metrics.oraclePrice || 0);
                        entryDeviationReferenceSource = priceDeviationGuard.metrics.oraclePriceSource || 'reference_unavailable';
                        guardAudit.priceDeviation = {
                            oraclePriceSource: priceDeviationGuard.metrics.oraclePriceSource,
                            targetExecutionPriceSource: priceDeviationGuard.metrics.targetExecutionPriceSource,
                            targetImpliedPriceSourceCategory: priceDeviationGuard.metrics.targetImpliedPriceSourceCategory,
                            targetImpliedValueSource: priceDeviationGuard.metrics.targetImpliedValueSource,
                            oraclePrice: roundGuardNumber(priceDeviationGuard.metrics.oraclePrice, 8),
                            targetExecutionPrice: roundGuardNumber(targetExecutionPrice, 8),
                            ratio: roundGuardNumber(priceDeviationGuard.ratio, 4),
                            maxRatio: priceDeviationGuard.metrics.maxRatio,
                            pass: priceDeviationGuard.passed,
                            oracleProvider: priceDeviationGuard.metrics.oracleProvider,
                            oracleDexName: priceDeviationGuard.metrics.oracleDexName,
                            oracleValidationReason: priceDeviationGuard.metrics.oracleValidationReason,
                            referencePrice: roundGuardNumber(priceDeviationGuard.metrics.referencePrice, 8),
                            referenceProvider: priceDeviationGuard.metrics.referenceProvider,
                            oracleFallbackUsed: Boolean(priceDeviationGuard.metrics.oracleFallbackUsed),
                            reasonCode: priceDeviationGuard.reasonCode
                        };

                        if (!priceDeviationGuard.passed && priceDeviationGuard.reasonCode === 'PRICE_DEVIATION_TOO_HIGH') {
                            logger.info(LogCode.DEC_PRICE_IMPACT_HIGH, `🚨 Price Deviation too high! Local Quote: $${Number(priceDeviationGuard.metrics.oraclePrice || 0).toFixed(6)}, Target Paid: $${targetExecutionPrice.toFixed(6)} (${Number(priceDeviationGuard.ratio || 0).toFixed(1)}x)`, {
                                userId: config.userId,
                                token: tokenToBuy,
                                targetSwapValueUsd,
                                priceGuardValueUsd: priceDeviationGuard.metrics.priceGuardValueUsd,
                                estimatedOut,
                                oracleProvider: priceDeviationGuard.metrics.oracleProvider,
                                oracleDexName: priceDeviationGuard.metrics.oracleDexName,
                                oracleValidationReason: priceDeviationGuard.metrics.oracleValidationReason,
                                referencePrice: priceDeviationGuard.metrics.referencePrice,
                                referenceProvider: priceDeviationGuard.metrics.referenceProvider,
                                oracleFallbackUsed: Boolean(priceDeviationGuard.metrics.oracleFallbackUsed),
                                reasonCode: priceDeviationGuard.reasonCode
                            });

                            sendNotificationAsync({
                                userId: config.userId,
                                farcasterFid: config.user.farcasterFid,
                                type: 'COPY_TRADE_SKIPPED',
                                data: {
                                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                                    tokenAddress: tokenToBuy,
                                    targetWallet: targetWallet,
                                    chainId: chainId,
                                    skipReason: `Price deviation too high (${Number(priceDeviationGuard.ratio || 0).toFixed(1)}x). Oracle: $${Number(tokenInfo.price || 0).toFixed(6)}, Target paid: $${targetExecutionPrice.toFixed(6)}`,
                                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                                    priceImpact: `${Number(priceDeviationGuard.ratio || 0).toFixed(1)}x deviation`
                                }
                            }, 'copytrade_skip_price_deviation');
                            emitGuardAudit('skip', 'price_deviation_ratio_exceeded');
                            return { outcome: 'skipped' };
                        }
                        if (!priceDeviationGuard.passed && ['PRICE_REFERENCE_UNAVAILABLE', 'PRICE_REFERENCE_ZERO'].includes(priceDeviationGuard.reasonCode)) {
                            logger.warn(LogCode.DEC_PRICE_IMPACT_HIGH, 'Price deviation guard skipped strict enforcement due to unavailable oracle reference', {
                                userId: config.userId,
                                token: tokenToBuy,
                                chainId,
                                reasonCode: priceDeviationGuard.reasonCode,
                                oracleProvider: priceDeviationGuard.metrics.oracleProvider,
                                oracleValidationReason: priceDeviationGuard.metrics.oracleValidationReason,
                                referenceProvider: priceDeviationGuard.metrics.referenceProvider,
                                referencePrice: priceDeviationGuard.metrics.referencePrice,
                            });
                        }
                    }
                } catch {}
            }

            if (targetExecutionPrice > 0) {
                const dexChainId = chainId === 900 ? 'solana' : chainId;
                const fallbackDexPrice = entryDeviationReferencePrice > 0
                    ? 0
                    : await getDexPriceWithTimeout(tokenToBuy, dexChainId);
                const resolvedEntryDeviationPrice = resolveEntryDeviationCurrentPrice({
                    referencePrice: entryDeviationReferencePrice,
                    referencePriceSource: entryDeviationReferenceSource,
                    fallbackDexPrice,
                });
                const currentPrice = resolvedEntryDeviationPrice.currentPrice;
                if (currentPrice > 0) {
                    const deviationBps = Math.abs(targetExecutionPrice - currentPrice) / currentPrice * 10000;
                    guardAudit.priceDeviation = {
                        ...(guardAudit.priceDeviation && typeof guardAudit.priceDeviation === 'object' ? guardAudit.priceDeviation as Record<string, unknown> : {}),
                        ...(fallbackDexPrice > 0 ? { dexPrice: roundGuardNumber(fallbackDexPrice, 8) } : {}),
                        deviationBps: roundGuardNumber(deviationBps, 2),
                        maxEntryDeviationBps: effectiveConfig.maxEntryDeviationBps,
                        entryDeviationSource: effectiveConfig.maxEntryDeviationSource,
                        entryDeviationReasonCode: effectiveConfig.maxEntryDeviationReasonCode,
                        entryDeviationThresholdPolicy: effectiveConfig.maxEntryDeviationThresholdPolicy,
                        entryDeviationModeFloorBps: effectiveConfig.maxEntryDeviationModeFloorBps,
                        maxSlippageBps: effectiveConfig.maxSlippageBps,
                        pass: deviationBps <= effectiveConfig.maxEntryDeviationBps
                    };
                    emitEntryDeviationSummary({
                        action: deviationBps > effectiveConfig.maxEntryDeviationBps ? 'entry_deviation_skip' : 'entry_deviation_pass',
                        userId: config.userId,
                        configId: config.id,
                        tokenAddress: tokenToBuy,
                        targetWallet,
                        chainId,
                        executionMode,
                        currentPriceSource: resolvedEntryDeviationPrice.currentPriceSource,
                        targetExecutionPriceSource: 'target_implied_price',
                        targetImpliedPriceSourceCategory: String((guardAudit.priceDeviation as Record<string, unknown> | undefined)?.targetImpliedPriceSourceCategory || 'target_unknown'),
                        targetImpliedValueSource: String((guardAudit.priceDeviation as Record<string, unknown> | undefined)?.targetImpliedValueSource || 'target_swap_value_usd'),
                        targetExecutionPrice,
                        currentPrice,
                        deviationBps,
                        limitBps: effectiveConfig.maxEntryDeviationBps,
                        thresholdSource: effectiveConfig.maxEntryDeviationSource,
                        thresholdReasonCode: effectiveConfig.maxEntryDeviationReasonCode,
                        thresholdPolicy: effectiveConfig.maxEntryDeviationThresholdPolicy,
                    });
                    if (shouldEnforceBuyGuard(guardPolicy, 'priceDeviationBps') && deviationBps > effectiveConfig.maxEntryDeviationBps) {
                        const unreliableMarketPrice = isEntryDeviationPriceUnreliable(chainId, tokenInfo);
                        if (unreliableMarketPrice) {
                            logger.warn(LogCode.DEC_PRICE_IMPACT_HIGH, 'Entry deviation exceeded but bypassed due unreliable market price source', {
                                userId: config.userId,
                                token: tokenToBuy,
                                chainId,
                                deviationBps: deviationBps.toFixed(0),
                                limitBps: effectiveConfig.maxEntryDeviationBps,
                                targetExecutionPrice,
                                currentPrice,
                                guardLiquidityReliable: tokenInfo?.guardLiquidityReliable ?? null,
                                guardLiquidityPoolCount: tokenInfo?.guardLiquidityPoolCount ?? null,
                                guardLiquiditySource: tokenInfo?.guardLiquiditySource ?? null,
                                reasonCode: 'ENTRY_DEVIATION_UNRELIABLE_PRICE_BYPASS'
                            });
                            emitGuardAudit('pass', 'price_deviation_unreliable_price_bypass');
                        } else {
                            logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping trade: entry deviation exceeds configured threshold', {
                                userId: config.userId,
                                token: tokenToBuy,
                                deviationBps: deviationBps.toFixed(0),
                                limitBps: effectiveConfig.maxEntryDeviationBps,
                                targetExecutionPrice,
                                currentPrice,
                                thresholdSource: effectiveConfig.maxEntryDeviationSource,
                                thresholdPolicy: effectiveConfig.maxEntryDeviationThresholdPolicy,
                                modeFloorBps: effectiveConfig.maxEntryDeviationModeFloorBps,
                                executionMode,
                                reasonCode: effectiveConfig.maxEntryDeviationReasonCode
                            });

                            sendNotificationAsync({
                                userId: config.userId,
                                farcasterFid: config.user.farcasterFid,
                                type: 'COPY_TRADE_SKIPPED',
                                data: {
                                    tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                                    tokenAddress: tokenToBuy,
                                    targetWallet: targetWallet,
                                    chainId: chainId,
                                    skipReason: `Entry deviation ${deviationBps.toFixed(0)} bps > limit ${effectiveConfig.maxEntryDeviationBps} bps`,
                                    ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                                }
                            }, 'copytrade_skip_price_deviation_bps');
                            emitGuardAudit('skip', 'price_deviation_bps_exceeded');
                            return { outcome: 'skipped' };
                        }
                    }
                }
            }

            if (shouldEnforceBuyGuard(guardPolicy, 'gasBuffer') && chainId !== 900) {
                const nativeBalance = await getNativeBalance(effectiveConfig.user.walletAddress, chainId);
                const chainConfig = getChainConfig(chainId);
                const gasReserve = String(chainConfig.gasReserve || '0.003');
                const gasBufferWei = ethers.parseUnits(gasReserve, 18);
                const nativeSymbol = chainConfig.nativeCurrency?.symbol || 'ETH';

                let tradeCostWei = 0n;
                if (nativePrice > 0) {
                    const amountInNative = usdAmount / nativePrice;
                    tradeCostWei = ethers.parseEther(amountInNative.toFixed(18));
                }

                if (nativeBalance === null) {
                    logger.warn(LogCode.API_FETCH_FAILED, 'Skipping strict gas-buffer check due to native balance RPC failure', {
                        userId: config.userId,
                        wallet: effectiveConfig.user.walletAddress,
                        chainId
                    });
                    emitGuardAudit('pass', 'gas_balance_rpc_failed');
                } else if (nativeBalance < (tradeCostWei + gasBufferWei)) {
                    const balanceNative = ethers.formatEther(nativeBalance);
                    const requiredNative = ethers.formatEther(tradeCostWei + gasBufferWei);

                    logger.throttled(LogCode.EXE_INSUFFICIENT_FUNDS, 'Skipping trade: Insufficient gas buffer', {
                        userId: config.userId,
                        chainId,
                        balance: balanceNative,
                        required: requiredNative,
                        buffer: gasReserve,
                        nativeSymbol
                    });

                    await notificationService.sendNotification({
                        userId: config.userId,
                        farcasterFid: config.user.farcasterFid,
                        type: 'COPY_TRADE_SKIPPED',
                        data: {
                            tokenSymbol: tokenInfo.symbol || tokenToBuy.slice(0, 10),
                            tokenAddress: tokenToBuy,
                            targetWallet: targetWallet,
                            chainId: chainId,
                            skipReason: `Insufficient gas. Balance: ${parseFloat(balanceNative).toFixed(4)} ${nativeSymbol}, Required: ${parseFloat(requiredNative).toFixed(4)} ${nativeSymbol}`,
                            ...buildCopyTradeNotificationEvidence(tokenInfo, { targetBuyValueUsd: targetSwapValueUsd }),
                        }
                    });
                    emitGuardAudit('skip', 'insufficient_gas_buffer');
                    return { outcome: 'skipped' };
                }
            }

            emitGuardAudit('pass', 'guards_passed_pre_execution');

            try {
                const pendingPos = await prisma.$transaction(async (tx: any) => {
                    const positionWhere = buildDuplicateTradeWhere({
                        userId: config.userId,
                        tokenAddress: tokenToBuy,
                        cooldownMinutes: shouldEnforceBuyGuard(guardPolicy, 'cooldown') ? cooldownMinutes : 0,
                        positionStatusCompat
                    });
                    const existing = await tx.position.findFirst({
                        where: positionWhere
                    });

                    if (existing) {
                        throw new Error('DUPLICATE_TRADE: Position already exists or pending');
                    }

                    return tx.position.create({
                        data: {
                            userId: config.userId,
                            configId: effectiveConfig.id,
                            tokenAddress: tokenToBuy,
                            tokenSymbol: tokenInfo.symbol || 'UNK',
                            chainId,
                            entryPrice: tokenInfo.price || 0,
                            entryAmount: '0',
                            entryTxHash: `PENDING_${Date.now()}`,
                            leaderTxHash: leaderTxHash || undefined,
                            entryUsdValue: usdAmount,
                            status: positionStatusCompat.pendingCreateStatus as any
                        }
                    });
                });
                pendingPositionId = pendingPos.id;
                pendingPositionCreatedAt = pendingPos.createdAt;
                logger.info(LogCode.EXE_TX_BROADCAST, 'Created PENDING position lock', { userId: config.userId, token: tokenToBuy, positionId: pendingPositionId });
            } catch (err: any) {
                const isUniqueConflict = String(err?.code || '').toUpperCase() === 'P2002'
                    || String(err?.message || '').toLowerCase().includes('unique constraint');
                if (err.message.includes('DUPLICATE_TRADE') || isUniqueConflict) {
                    logger.info(LogCode.WTC_TX_SKIPPED, 'Skipping duplicate trade (DB Lock)', { userId: config.userId, token: tokenToBuy });
                    emitGuardAudit('skip', 'duplicate_trade_lock');
                    return { outcome: 'skipped' };
                } else {
                    logger.error(LogCode.SYS_ERROR, 'Failed to create pending position', { error: err.message });
                    return { outcome: 'failed' };
                }
            }

            logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Executing trade', {
                userId: config.userId,
                wallet: config.user.walletAddress,
                usdAmount
            });

            const launchpad = await deps.resolveLaunchpad(launchpadPromise, chainId);

            if (chainId === 900) {
                let solAddress: string | null = null;
                try {
                    solAddress = await getSolanaEmbeddedWalletAddress(config.user.privyDid);
                } catch (err: any) {
                    logger.error(LogCode.SYS_ERROR, 'Unexpected error in processSingleUserBuy', {
                        userId: config.userId,
                        error: err?.message || String(err)
                    });
                }

                if (!solAddress) {
                    logger.warn(LogCode.API_AUTH_FAILED, 'Skipping Solana trade: No Solana wallet found in Privy', { userId: config.userId });
                    return { outcome: 'skipped' };
                }

                if (nativePrice <= 0) {
                    logger.error(LogCode.API_FETCH_FAILED, 'Failed to fetch SOL price for trade calculation', { userId: config.userId });
                    return { outcome: 'failed' };
                }

                const amountInLamports = Math.floor((usdAmount / nativePrice) * 1e9).toString();
                const amountInSol = Number(amountInLamports) / 1e9;

                const lamportsToSolAmount = (lamports: string): string => {
                    const value = BigInt(lamports);
                    const whole = value / 1000000000n;
                    const frac = value % 1000000000n;
                    const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
                    return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
                };

                const executeSolanaCopytradeAttempt = async (
                    attemptLamports: string,
                    attemptSlippageBps: number,
                    modeForAttempt: any
                ): Promise<any> => {
                    const result = await executeSwapViaPort({
                        userId: effectiveConfig.user.privyDid,
                        walletAddress: solAddress,
                        tokenIn: SOLANA_CONFIG.TOKENS.SOL,
                        tokenOut: tokenToBuy,
                        amountIn: lamportsToSolAmount(attemptLamports),
                        chainId,
                        slippageBps: attemptSlippageBps,
                        mode: 'copytrade',
                        launchpadProvider: launchpad?.provider as any,
                        userSettings: {
                            fastSwapMode: modeForAttempt === 'turbo',
                            copyTradeExecutionMode: modeForAttempt
                        },
                        executionContext: {
                            executionStep: 'copytrade_buy',
                            strictReplica: false,
                            sellRoutePolicy: 'direct_primary',
                            sourceTxHash: leaderTxHash || undefined
                        }
                    });

                    if (!result.success || !result.txHash) {
                        throw new Error(result.error || 'Solana copytrade buy failed');
                    }

                    const provider = String(result.metadata?.provider || 'unknown');
                    const route = provider.includes('fallback') || provider.includes('jupiter') ? 'jupiter' : 'direct';
                    logger.info(
                        LogCode.SYS_INFO,
                        `[CopyTradeRoute][solana_buy] route=${route} provider=${provider} launchpad=${String(launchpad?.provider || 'unknown')} slippageBps=${attemptSlippageBps} lamports=${attemptLamports}`,
                        {
                            userId: config.userId,
                            token: tokenToBuy,
                            launchpadProvider: launchpad?.provider || 'unknown',
                            route,
                            provider,
                            slippageBps: attemptSlippageBps,
                            amountLamports: attemptLamports
                        }
                    );

                    return result;
                };

                logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Solana trade calculation complete', {
                    buyAmountUsd: usdAmount,
                    solPrice: nativePrice,
                    amountInSol: amountInSol.toString(),
                    token: tokenToBuy,
                    wallet: solAddress
                });

                const MIN_TRADE_USD = 0.5;
                if (usdAmount < MIN_TRADE_USD) {
                    logger.throttled(LogCode.EXE_MIN_AMOUNT_NOT_MET, 'Trade amount below minimum threshold', {
                        amountUsd: usdAmount,
                        minUsd: MIN_TRADE_USD
                    });
                    return { outcome: 'skipped' };
                }

                if (turboMode) {
                    const SOLANA_TURBO_MAX_ATTEMPTS = 3;
                    const baseLamports = BigInt(amountInLamports);
                    const baseSlippage = effectiveConfig.maxSlippageBps;
                    let lastSolErr: Error | null = null;

                    for (let attempt = 1; attempt <= SOLANA_TURBO_MAX_ATTEMPTS; attempt++) {
                        const amountMultiplier = attempt === 1 ? 1 : attempt === 2 ? 0.998 : 0.996;
                        const slippageMultiplier = attempt === 1 ? 1 : attempt === 2 ? 1.2 : 1.5;
                        const attemptLamports = (baseLamports * BigInt(Math.floor(amountMultiplier * 1000)) / 1000n).toString();
                        const attemptSlippage = Math.min(Math.floor(baseSlippage * slippageMultiplier), 4900);

                        if (attempt > 1) {
                            logger.info(LogCode.SYS_INFO, `[Solana Turbo] 光速 retry attempt ${attempt}`, {
                                userId: config.userId,
                                token: tokenToBuy,
                                lamports: attemptLamports,
                                slippageBps: attemptSlippage,
                                prevError: lastSolErr?.message?.slice(0, 80)
                            });
                        }
                        try {
                            const result = await executeSolanaCopytradeAttempt(attemptLamports, attemptSlippage, 'turbo');
                            txHash = result.txHash!;
                            txLifecycleStatus = result.txLifecycle?.status || txLifecycleStatus;
                            swapMetadata = {
                                ...(swapMetadata || {}),
                                mainSwapProvider: result.metadata?.provider,
                                mainSwapRouteMode: result.metadata?.launchpad || launchpad?.provider || 'unknown'
                            } as any;
                            break;
                        } catch (solErr: any) {
                            lastSolErr = solErr;
                            logger.warn(LogCode.EXE_TX_REVERTED, `[Solana Turbo] Attempt ${attempt} failed`, {
                                userId: config.userId,
                                token: tokenToBuy,
                                attempt,
                                error: solErr?.message?.slice(0, 120)
                            });
                        }
                    }
                    if (!txHash && lastSolErr) {
                        throw lastSolErr;
                    }
                } else {
                    const solAttempts: Array<{ amountIn: string; slippageBps: number; label: string }> = [
                        {
                            amountIn: amountInLamports,
                            slippageBps: effectiveConfig.maxSlippageBps,
                            label: 'primary'
                        },
                        {
                            amountIn: amountInLamports,
                            slippageBps: Math.min((effectiveConfig.maxSlippageBps || 300) + 500, 4900),
                            label: 'retry_relaxed_slippage'
                        }
                    ];

                    let lastSolErr: any = null;
                    for (let i = 0; i < solAttempts.length; i++) {
                        const attempt = solAttempts[i];
                        try {
                            if (i > 0) {
                                logger.warn(LogCode.EXE_TX_REVERTED, '[Solana Buy] Retrying non-turbo buy after failure', {
                                    userId: config.userId,
                                    token: tokenToBuy,
                                    attempt: attempt.label,
                                    slippageBps: attempt.slippageBps,
                                    prevError: String(lastSolErr?.message || '').slice(0, 160)
                                });
                            }

                            const result = await executeSolanaCopytradeAttempt(attempt.amountIn, attempt.slippageBps, executionMode);
                            txHash = result.txHash!;
                            txLifecycleStatus = result.txLifecycle?.status || txLifecycleStatus;
                            swapMetadata = {
                                ...(swapMetadata || {}),
                                mainSwapProvider: result.metadata?.provider,
                                mainSwapRouteMode: result.metadata?.launchpad || launchpad?.provider || 'unknown'
                            } as any;
                            break;
                        } catch (solErr: any) {
                            lastSolErr = solErr;
                            const msg = String(solErr?.message || '').toLowerCase();
                            const retryable = msg.includes('failed on-chain')
                                || msg.includes('simulation failed')
                                || msg.includes('custom program error')
                                || msg.includes('slippage')
                                || msg.includes('exceedmaxcost')
                                || msg.includes('0x1771')
                                || msg.includes('6001');

                            if (i >= solAttempts.length - 1 || !retryable) {
                                throw solErr;
                            }
                        }
                    }
                }

            } else {
                const isFastExecutionEnabled = userSettings?.fastSwapMode === true;
                let useStandardSwap = true;

                if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Zora token detected with fast execution enabled', { userId: config.userId, token: tokenToBuy });
                    try {
                        const copyTradeFeeBpsOverride =
                            isJudgeEnabledByCopyTradeConfig(config)
                                ? env.platformFees.copyTradeAiBps
                                : undefined;
                        txHash = await zoraSniperService.fastSwap({
                            userId: effectiveConfig.user.privyDid,
                            accessToken: '',
                            walletAddress: effectiveConfig.user.walletAddress,
                            tokenOut: tokenToBuy,
                            amountIn: (usdAmount / nativePrice).toFixed(18),
                            slippage: effectiveConfig.maxSlippageBps / 100,
                            feeContext: 'copyTrade',
                            feeBpsOverride: copyTradeFeeBpsOverride
                        });
                        useStandardSwap = !txHash;
                    } catch (zoraErr: any) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Zora fast swap failed, falling back to standard route', { userId: config.userId, error: zoraErr.message || zoraErr });
                        useStandardSwap = true;
                    }
                } else if (launchpad && launchpad.provider === 'fourmeme' && chainId === 56) {
                    logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Four.meme token detected - attempting specialized contract buy', { userId: config.userId, token: tokenToBuy });
                    try {
                        const bnbAmount = (usdAmount / nativePrice).toFixed(18);
                        txHash = await fourMemeService.buyTokenAMAP({
                            userId: effectiveConfig.user.privyDid,
                            walletAddress: effectiveConfig.user.walletAddress,
                            tokenAddress: tokenToBuy,
                            bnbAmount,
                            slippageBps: effectiveConfig.maxSlippageBps,
                            feeContext: 'copyTrade',
                        });
                        useStandardSwap = !txHash;
                    } catch (fourErr: any) {
                        logger.warn(LogCode.EXE_TX_REVERTED, 'Four.meme specialized buy failed, falling back to standard route (Token might have graduated)', {
                            userId: config.userId,
                            error: fourErr.message || fourErr
                        });
                        useStandardSwap = true;
                    }
                }

                if (useStandardSwap) {
                    if (launchpad && launchpad.provider === 'zora' && !isFastExecutionEnabled) {
                        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Zora token detected but Fast Execution is disabled', { userId: config.userId });
                    }
                    if (launchpad && launchpad.provider === 'zora' && isFastExecutionEnabled) {
                        logger.debug(LogCode.EXE_QUOTE_FETCHED, 'Falling back to standard swap after Zora fast swap failure', { userId: config.userId });
                    }

                    const copyTradeFeeBpsOverride =
                        isJudgeEnabledByCopyTradeConfig(config)
                            ? env.platformFees.copyTradeAiBps
                            : undefined;
                    const submissionResult = await executeEvmCopytradeBuySubmissionFlow({
                        userId: config.userId,
                        privyUserId: effectiveConfig.user.privyDid,
                        walletAddress: effectiveConfig.user.walletAddress,
                        tokenToBuy,
                        chainId,
                        usdAmount,
                        nativePrice,
                        baseSlippageBps: effectiveConfig.maxSlippageBps,
                        executionMode,
                        turboMode,
                        fastSwapMode: userSettings?.fastSwapMode === true,
                        checkTokenBeforeSwap: userSettings?.checkTokenBeforeSwap === true,
                        tokenInfo,
                        swap,
                        feeBpsOverride: copyTradeFeeBpsOverride,
                        directSwapHint: deps.buildDirectSwapHintFromSwap(swap),
                        preWarmedNonce: getPendingNonce(chainId, effectiveConfig.user.walletAddress),
                        targetExecutionPrice,
                        entryDeviationReferencePrice,
                        entryDeviationReferenceSource,
                        maxEntryDeviationBps: effectiveConfig.maxEntryDeviationBps,
                        maxEntryDeviationSource: effectiveConfig.maxEntryDeviationSource,
                        maxEntryDeviationReasonCode: effectiveConfig.maxEntryDeviationReasonCode,
                        maxEntryDeviationThresholdPolicy: effectiveConfig.maxEntryDeviationThresholdPolicy,
                        maxEntryDeviationModeFloorBps: effectiveConfig.maxEntryDeviationModeFloorBps,
                        allowFallbackEntryDeviationBypass: isEntryDeviationPriceUnreliable(chainId, tokenInfo),
                        refreshTokenInfoForRetry: async () => tokenInfoCache
                            ? await getTokenInfoOnce(tokenInfoCache, tokenToBuy, chainId, {
                                verbose: false,
                                forceRefresh: true,
                                rpcStrategy: TRADE_METADATA_PROFILE
                            })
                            : await getTokenInfo(tokenToBuy, chainId, {
                                verbose: false,
                                forceRefresh: true,
                                rpcStrategy: TRADE_METADATA_PROFILE
                            })
                    });
                    if (submissionResult.status === 'aborted') {
                        return { outcome: 'failed' };
                    }
                    if (submissionResult.status === 'submitted_unresolved') {
                        txLifecycleStatus = submissionResult.txLifecycleStatus || txLifecycleStatus;
                        orderRuntimeContext = submissionResult.runtimeContext;
                        swapMetadata = submissionResult.swapMetadata;
                        preservePendingPosition = true;
                        if (pendingPositionId) {
                            const unresolvedMarker = buildRecoverablePendingEntryTxHash(
                                submissionResult.runtimeContext?.canonicalTxHash
                                || submissionResult.runtimeContext?.orderId
                                || pendingPositionId
                            );
                            await prisma.position.updateMany({
                                where: { id: pendingPositionId, status: positionStatusCompat.pendingCreateStatus as any },
                                data: { entryTxHash: unresolvedMarker }
                            }).catch((error: any) => {
                                logger.warn(LogCode.SYS_ERROR, 'Failed to mark pending buy position as unresolved-recoverable', {
                                    userId: config.userId,
                                    token: tokenToBuy,
                                    chainId,
                                    pendingPositionId,
                                    error: error?.message || String(error)
                                });
                            });
                        }
                        logger.warn(LogCode.EXE_TX_BROADCAST, 'Buy submission unresolved; preserving pending position for later confirmation', {
                            userId: config.userId,
                            token: tokenToBuy,
                            chainId,
                            reasonCode: submissionResult.reasonCode,
                            pendingPositionId,
                            ...buildOrderAuditFields(orderRuntimeContext)
                        });
                        return { outcome: 'pending' };
                    }
                    txHash = submissionResult.txHash;
                    attributedEntryAmountHuman = submissionResult.attributedEntryAmountHuman || attributedEntryAmountHuman;
                    txLifecycleStatus = submissionResult.txLifecycleStatus || txLifecycleStatus;
                    orderRuntimeContext = submissionResult.runtimeContext;
                    swapMetadata = submissionResult.swapMetadata;
                }
            }

            if (!txHash) {
                logger.warn(LogCode.EXE_TX_REVERTED, 'No txHash returned for buy. Deleting pending position.', { userId: config.userId, token: tokenToBuy });
                if (pendingPositionId) {
                    await prisma.position.deleteMany({ where: { id: pendingPositionId } }).catch((e: any) => logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending pos', { error: e }));
                }
                return { outcome: 'failed' };
            }

            if (!tokenInfo.price || tokenInfo.price <= 0) {
                logger.error(LogCode.DEC_FAILED_UNKNOWN_DEX, 'Invalid entry price found, cleanup pending position', { token: tokenToBuy, price: tokenInfo.price });
                if (pendingPositionId) {
                    await prisma.position.deleteMany({ where: { id: pendingPositionId } }).catch((e: any) => logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending pos', { error: e }));
                }
                return { outcome: 'failed' };
            }

            const persistenceResult = await persistCopytradeBuySubmission({
                pendingPositionId,
                pendingPositionCreatedAt,
                userId: effectiveConfig.userId,
                configId: effectiveConfig.id,
                tokenAddress: tokenToBuy,
                tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
                chainId,
                tokenPrice: tokenInfo.price,
                entryAmount: (usdAmount / nativePrice).toString(),
                attributedEntryAmountHuman: attributedEntryAmountHuman || undefined,
                attributedEntryAmountExact: swapMetadata?.directFeeSettlement?.amountOutBase || undefined,
                entryTxHash: txHash,
                leaderBuyTxHash: leaderTxHash || undefined,
                entryUsdValue: usdAmount,
                txLifecycleStatus,
                runtimeContext: orderRuntimeContext,
            });
            const nextPositionStatus = persistenceResult.nextPositionStatus;
            let persistedPositionId = persistenceResult.persistedPositionId;
            pendingPositionCreatedAt = persistenceResult.pendingPositionCreatedAt || pendingPositionCreatedAt;
            pendingPositionSettled = persistenceResult.pendingPositionSettled;

            logger.info(LogCode.EXE_TX_CONFIRMED, 'Copy trade buy submitted and position state updated', {
                userId: config.userId,
                token: tokenToBuy,
                txHash,
                txLifecycleStatus: txLifecycleStatus || 'unknown',
                positionStatus: nextPositionStatus,
                positionId: persistedPositionId,
                positionAmountStorageReasonCode: persistenceResult.positionAmountStorageReasonCode,
                ...buildOrderAuditFields(orderRuntimeContext)
            });

            const notifyBuySuccessConfirmed = async () => {
                sendNotificationAsync({
                    userId: config.user.privyDid,
                    farcasterFid: config.user.farcasterFid,
                    type: 'TRADE_SUCCESS_BUY',
                    data: {
                        tokenSymbol: await resolveDisplayTokenSymbolAsync(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy, chainId),
                        usdValue: usdAmount.toFixed(2),
                        targetWallet: targetWallet,
                        txHash: txHash,
                        chainId: chainId
                    }
                }, 'copytrade_buy_success_confirmed');
            };

            const executeMirrorSellAfterBuyConfirm = async (context: any) => {
                const mirrorSellPosition = await prisma.position.findUnique({
                    where: { id: context.positionId }
                });
                if (mirrorSellPosition && mirrorSellPosition.status !== 'closed') {
                    logger.warn(LogCode.SYS_INFO, '[CopyTradeRace] Target already sold while buy was pending; executing mirror sell on confirmation', {
                        userId: config.userId,
                        token: tokenToBuy,
                        chainId,
                        txHash,
                        positionId: context.positionId,
                        targetSellTxHash: context.targetSellTxHash || null,
                        reasonCode: context.reasonCode,
                    });
                    await releaseMirrorSellAfterBuyConfirm({
                        position: mirrorSellPosition,
                        chainId,
                        tokenAddress: tokenToBuy,
                        targetWallet,
                        targetSellTxHash: context.targetSellTxHash,
                        reasonCode: context.reasonCode,
                    });
                }
            };

            const runBuyConfirmationTransition = async (
                confirmation: any,
                recoverySource: 'initial_wait' | 'late_recovery',
            ) => {
                return await applyBuyConfirmationTransition({
                    confirmation,
                    chainId,
                    tokenToBuy,
                    txHash,
                    userId: effectiveConfig.user.privyDid,
                    targetWallet,
                    leaderBuyTxHash: leaderTxHash || undefined,
                    persistedPositionId,
                    pendingPositionCreatedAt,
                    tokenInfo: {
                        symbol: tokenInfo.symbol,
                        price: tokenInfo.price,
                        decimals: tokenInfo.decimals
                    },
                    walletAddress: effectiveConfig.user.walletAddress,
                    positionStatusCompat,
                    directFeeSettlement: swapMetadata?.directFeeSettlement || null,
                    onMirrorSellAfterConfirm: executeMirrorSellAfterBuyConfirm,
                    onNotifySuccess: notifyBuySuccessConfirmed,
                    recoverySource,
                });
            };

            scheduleCopytradeBuyConfirmationFlow({
                chainId,
                txHash,
                tokenAddress: tokenToBuy,
                txHashes: orderRuntimeContext?.relatedTxHashes,
                orderId: orderRuntimeContext?.orderId,
                runtimeContext: orderRuntimeContext,
                delayMs: SELL_PREHEAT_DELAY_MS,
                timeoutMs: SELL_PREHEAT_CONFIRM_TIMEOUT_MS,
                pollMs: SELL_PREHEAT_CONFIRM_POLL_MS,
                onTransition: runBuyConfirmationTransition,
            });

            trackCopyTrade(config.userId);
            trackSwap(config.userId, usdAmount);

            const aiMode = getEnabledCopyTradeAiMode(config);
            const postBuyAiResult = await runPostBuyAiFlow({
                aiMode,
                userId: config.userId,
                privyDid: config.user.privyDid,
                configId: config.id,
                buyAmountUsd: config.buyAmountUsd,
                tokenAddress: tokenToBuy,
                tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
                chainId,
                targetWallet,
                txHash,
                aiModel: env.aiModel,
                resolvedAiModeForLogs: resolveCopyTradeAiMode(config),
            });
            judgeDecisionId = postBuyAiResult.judgeDecisionId;
            void judgeDecisionId;

            if (nextPositionStatus !== 'open') {
                logger.warn(LogCode.SYS_INFO, 'Buy notification deferred until on-chain confirmation', {
                    userId: config.userId,
                    token: tokenToBuy,
                    txHash,
                    txLifecycleStatus: txLifecycleStatus || 'unknown'
                });
            }

            return { outcome: nextPositionStatus === 'open' ? 'executed' : 'pending' };

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Error processing trade configuration', {
                configId: config.id,
                userId: config.userId,
                error: compactCopyTradeError(error),
                bugHint: inferCopyTradeBugHint(error),
                stack: error.stack
            });

            sendNotificationAsync({
                userId: config.userId,
                farcasterFid: config.user.farcasterFid,
                type: 'TRADE_FAILURE',
                data: {
                    tokenSymbol: resolveDisplayTokenSymbol(tokenInfo.symbol || (swap as any)?.tokenSymbol, tokenToBuy),
                    error: compactCopyTradeError(error),
                    targetWallet: targetWallet,
                    chainId: chainId
                }
            }, 'copytrade_buy_failure');
            return { outcome: 'failed' };
        } finally {
            if (pendingPositionId && !pendingPositionSettled && !preservePendingPosition) {
                const cleaned = await cleanupPendingCopytradePosition({
                    pendingPositionId,
                    reasonCode: txHash ? 'buy_unsettled_cleanup' : 'buy_failed_cleanup'
                }).catch((cleanupError: any) => {
                    logger.error(LogCode.SYS_ERROR, 'Failed to cleanup pending copytrade position', {
                        configId: config.id,
                        userId: config.userId,
                        pendingPositionId,
                        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
                    });
                    return false;
                });

                if (cleaned) {
                    logger.warn(LogCode.SYS_INFO, 'Pending copytrade position cleaned up before attribution could be established', {
                        configId: config.id,
                        userId: config.userId,
                        token: tokenToBuy,
                        pendingPositionId,
                        txHash: txHash || undefined
                    });
                }
            }
        }
    });
}

export async function handleTargetSell(params: {
    targetWallet: string;
    swap: any;
    chainId: number;
}, deps: any): Promise<void> {
    const {
        normalizeAddress,
        logger,
        LogCode,
        withRetry,
        prisma,
        filterExecutableCopyTradeConfigs,
        dedupeConfigsByUser,
        upsertTargetSellEvent,
        buildTargetSellEventPayload,
        persistTargetSellEventAndSchedulePositions,
        syncCopytradeLedgerFromLegacy,
        armPendingAttributedPositionsForMirrorSell,
        recordNewTrade
    } = deps;
    const { targetWallet, swap, chainId } = params;
    const tokenToSell = swap.tokenIn;
    const normalizedWallet = normalizeAddress(targetWallet);
    logger.info(LogCode.EXE_QUOTE_FETCHED, '[CopyTradeTiming] target sell start', {
        targetWallet: normalizedWallet,
        token: tokenToSell,
        chainId,
        txHash: swap.txHash
    });

    const rawConfigsFound = await withRetry(() => prisma.copyTradeConfig.findMany({
        where: {
            targetWallet: { mode: 'insensitive', equals: normalizedWallet },
            chainId,
            status: 'active',
            mirrorSell: true,
        },
    }));

    const rawConfigs = rawConfigsFound.filter((config: any) =>
        normalizeAddress(config?.targetWallet || '') === normalizedWallet
    );

    if (rawConfigs.length === 0) return;
    if (rawConfigsFound.length !== rawConfigs.length) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Filtered mismatched target wallet configs on sell path', {
            targetWallet: normalizedWallet,
            chainId,
            found: rawConfigsFound.length,
            matched: rawConfigs.length
        });
    }

    const userIds = [...new Set(rawConfigs.map((c: any) => c.userId))];
    const users = await prisma.user.findMany({
        where: { privyDid: { in: userIds } }
    });
    const userMap = new Map(users.map((u: any) => [u.privyDid, u]));
    const allowSelfTarget = (process.env.COPYTRADE_ALLOW_SELF_TARGET || 'false') === 'true';
    const configs = rawConfigs
        .map((c: any) => ({ ...c, user: userMap.get(c.userId) }))
        .filter((c: any) => Boolean(c.user))
        .filter((c: any) => {
            if (allowSelfTarget) return true;
            const userWallet = normalizeAddress(c.user?.walletAddress || '');
            const isSelfTarget = userWallet !== '' && userWallet === normalizedWallet;
            if (isSelfTarget) {
                logger.warn(LogCode.WTC_TX_SKIPPED, 'Skipping self-target mirror sell config (safety)', {
                    configId: c.id,
                    userId: c.userId,
                    targetWallet: normalizedWallet
                });
                return false;
            }
            return true;
        });

    if (configs.length === 0) return;

    const executableConfigs = filterExecutableCopyTradeConfigs(configs, {
        chainId,
        targetWallet: normalizedWallet,
        token: tokenToSell,
    });
    if (executableConfigs.length === 0) return;

    const uniqueExecutableConfigs = dedupeConfigsByUser(executableConfigs);
    if (uniqueExecutableConfigs.length !== executableConfigs.length) {
        logger.warn(LogCode.WTC_TX_SKIPPED, 'Mirror sell deduped duplicate configs for same user', {
            targetWallet: normalizedWallet,
            chainId,
            txHash: swap.txHash,
            originalConfigs: executableConfigs.length,
            dedupedConfigs: uniqueExecutableConfigs.length
        });
    }

    logger.info(LogCode.EXE_TX_BROADCAST, 'Mirror sell: Processing open positions for token', { token: tokenToSell, configCount: uniqueExecutableConfigs.length, targetWallet });

    const persistedEvent = swap.txHash
        ? await upsertTargetSellEvent({
            chainId,
            targetWallet: normalizedWallet,
            tokenAddress: tokenToSell,
            targetSellTxHash: swap.txHash,
            source: 'webhook',
            detectedAt: new Date(),
            metadata: {
                persistedBy: 'legacy_mirror_sell_runtime',
                configCount: uniqueExecutableConfigs.length
            }
        }).catch((error: any) => {
            logger.warn(LogCode.SYS_ERROR, 'Mirror sell: failed to persist durable target sell event', {
                chainId,
                targetWallet: normalizedWallet,
                token: tokenToSell,
                txHash: swap.txHash,
                error: error?.message || String(error)
            });
            return null;
        })
        : null;

    await Promise.all(uniqueExecutableConfigs.map(async (config: any) => {
        const ledgerRows = await prisma.copytradePositionLedger.findMany({
            where: {
                userId: config.userId,
                configId: config.id,
                chainId,
                tokenAddress: tokenToSell,
                targetWallet: normalizedWallet,
                closedAt: null,
                positionIdLegacy: { not: null },
                lifecycleState: {
                    in: [
                        'FOLLOWER_OPEN',
                        'FOLLOWER_OPEN_REPAIR_REQUIRED',
                        'FOLLOWER_EXIT_FAILED_RETRYABLE',
                        'FOLLOWER_EXIT_ARMED',
                        'FOLLOWER_BUY_AWAITING_CONFIRMATION',
                    ],
                },
            },
            select: {
                positionIdLegacy: true,
            },
        });
        const positionIds = ledgerRows
            .map((row: { positionIdLegacy: string | null }) => String(row.positionIdLegacy || '').trim())
            .filter(Boolean);
        let matchedPositions = positionIds.length > 0
            ? await prisma.position.findMany({
                where: {
                    id: { in: positionIds },
                    userId: config.userId,
                    configId: config.id,
                    chainId,
                    tokenAddress: tokenToSell,
                    status: { in: ['open', 'pending'] },
                },
            })
            : [];
        let executionPolicyReasonCode = 'MIRROR_SELL_LEDGER_MATCHED';

        if (positionIds.length === 0) {
            const repairCandidates = await prisma.position.findMany({
                where: {
                    userId: config.userId,
                    configId: config.id,
                    chainId,
                    tokenAddress: {
                        equals: tokenToSell,
                        mode: 'insensitive',
                    },
                    status: { in: ['open', 'pending'] },
                    leaderTxHash: { not: null },
                },
            });

            if (repairCandidates.length === 0) {
                logger.info(
                    LogCode.WTC_TX_SKIPPED,
                    'Mirror sell skipped: no ledger-backed follower exposure for target sell',
                    {
                        userId: config.userId,
                        token: tokenToSell,
                        chainId,
                        targetWallet: normalizedWallet,
                        configId: config.id,
                        ledgerCandidateCount: 0,
                        repairCandidateCount: 0,
                        reasonCode: 'MIRROR_SELL_NO_LEDGER_CANDIDATES',
                    }
                );
                return;
            }

            await Promise.all(repairCandidates.map((position: any) =>
                syncCopytradeLedgerFromLegacy({
                    positionId: position.id,
                    targetWallet: normalizedWallet,
                    targetSellTxHash: swap.txHash || undefined,
                    targetFullExitVerified: false,
                    lastExecutionState: 'mirror_sell_webhook_repair',
                    lastExecutionReasonCode: 'ledger_repair_candidate',
                }).catch(() => null)
            ));

            matchedPositions = repairCandidates;
            executionPolicyReasonCode = 'MIRROR_SELL_LEDGER_REPAIRED_FROM_POSITION';
            logger.warn(LogCode.SYS_INFO, 'Mirror sell repaired missing ledger candidates from canonical positions', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                targetWallet: normalizedWallet,
                configId: config.id,
                repairCandidateCount: repairCandidates.length,
                reasonCode: executionPolicyReasonCode,
            });
        }
        if (matchedPositions.length === 0) {
            logger.info(LogCode.WTC_TX_SKIPPED, 'Mirror sell skipped: ledger candidates had no active positions', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                targetWallet: normalizedWallet,
                configId: config.id,
                ledgerCandidateCount: positionIds.length,
                executionPolicyReasonCode,
                reasonCode: 'MIRROR_SELL_LEDGER_ACTIVE_POSITION_MISSING',
            });
            return;
        }
        const pendingMatchedPositionIds = matchedPositions
            .filter((position: any) => String(position.status || '') !== 'open')
            .map((position: any) => position.id);
        if (pendingMatchedPositionIds.length > 0) {
            const armedCount = await armPendingAttributedPositionsForMirrorSell({
                userId: config.userId,
                chainId,
                tokenAddress: tokenToSell,
                positionIds: pendingMatchedPositionIds,
                targetSellTxHash: swap.txHash || undefined,
                reasonCode: 'target_sell_detected'
            }).catch(() => 0);
            logger.info(LogCode.SYS_INFO, 'Mirror sell armed pending attributed lots', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                pendingPositionIds: pendingMatchedPositionIds,
                armedCount,
                targetSellTxHash: swap.txHash || undefined
            });
        }
        logger.info(LogCode.SYS_INFO, 'Mirror sell ledger gate passed', {
            userId: config.userId,
            token: tokenToSell,
            chainId,
            targetWallet: normalizedWallet,
            targetSellTxHash: swap.txHash,
            configId: config.id,
            ledgerCandidateCount: positionIds.length,
            matchedPositionCount: matchedPositions.length,
            pendingPositionCount: pendingMatchedPositionIds.length,
            openPositionCount: matchedPositions.length - pendingMatchedPositionIds.length,
            reasonCode: executionPolicyReasonCode,
        });
        const balanceUsdForStats = matchedPositions.reduce((sum: number, p: any) => sum + (p.entryUsdValue || 0), 0);
        recordNewTrade(targetWallet, chainId, 'sell', balanceUsdForStats);
        const scheduled = await persistTargetSellEventAndSchedulePositions({
            event: persistedEvent || buildTargetSellEventPayload({
                chainId,
                targetWallet: normalizedWallet,
                tokenAddress: tokenToSell,
                targetSellTxHash: swap.txHash,
                source: 'webhook',
                metadata: {
                    persistedBy: 'legacy_mirror_sell_runtime',
                    configId: config.id,
                }
            }),
            positions: matchedPositions.map((position: any) => ({
                id: position.id,
                userId: position.userId,
                configId: position.configId,
                chainId: position.chainId,
                tokenAddress: position.tokenAddress,
                entryAmountExact: position.entryAmountExact,
                entryAmountDec: position.entryAmountDec,
            })),
            priority: 220,
            metadata: {
                sourceRuntime: 'legacy_mirror_sell_runtime',
                pendingPositionCount: pendingMatchedPositionIds.length,
                executionPolicyReasonCode,
            }
        }).catch((error: any) => {
            logger.warn(LogCode.SYS_ERROR, 'Mirror sell: failed to schedule canonical exit intents', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                targetWallet: normalizedWallet,
                txHash: swap.txHash,
                error: error?.message || String(error),
            });
            return null;
        });
        if (scheduled) {
            logger.info(LogCode.SYS_INFO, 'Mirror sell scheduled canonical exit intents', {
                userId: config.userId,
                token: tokenToSell,
                chainId,
                targetWallet: normalizedWallet,
                targetSellTxHash: swap.txHash,
                scheduled: scheduled.scheduled,
                skipped: scheduled.skipped,
                reasonCode: executionPolicyReasonCode,
            });
        }
    }));
}
