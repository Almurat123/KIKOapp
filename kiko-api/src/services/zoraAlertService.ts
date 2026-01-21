import { zoraService } from './zoraService.js';
import { notificationService } from './notificationService.js';
import { prisma } from '../db/prisma.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

const GLOBAL_FOLLOWER_THRESHOLD = 1_000_000;
const POLLING_INTERVAL_MS = 60000; // Poll every 60 seconds to respect API limits

/**
 * Global Zora Alpha Alert Service
 * Monitors for high-profile creator coin launches (>1M followers on ANY platform)
 * by polling the Zora API (instead of contract events)
 */
export class ZoraAlertService {
    private isRunning: boolean = false;
    private timer: NodeJS.Timeout | null = null;
    private seenCoins: Set<string> = new Set();
    private isFirstRun: boolean = true;

    /**
     * Start the Global Alpha Detector
     */
    public start() {
        if (this.isRunning) return;

        this.isRunning = true;
        logger.info(LogCode.SYS_STARTUP, 'Starting Global Zora Alpha Detector (API Polling)', {
            threshold: GLOBAL_FOLLOWER_THRESHOLD,
            interval: POLLING_INTERVAL_MS
        });

        // Start the polling loop
        this.poll();
    }

    /**
     * Stop the service
     */
    public stop() {
        this.isRunning = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        logger.info(LogCode.SYS_SHUTDOWN, 'Global Zora Alpha Detector stopped');
    }

    /**
     * Main polling function
     */
    private async poll() {
        if (!this.isRunning) return;

        try {
            await this.checkNewCoins();
        } catch (error: any) {
            logger.error(LogCode.API_FETCH_FAILED, 'Alpha Detector: Polling error', { error: error.message });
        } finally {
            // Schedule next poll
            if (this.isRunning) {
                this.timer = setTimeout(() => this.poll(), POLLING_INTERVAL_MS);
            }
        }
    }

    /**
     * Fetch new coins from API and check for high-value creators
     */
    private async checkNewCoins() {
        // Fetch latest 20 coins
        const coins = await zoraService.getNewCoins(20);

        if (!coins || coins.length === 0) return;

        // On first run, just populate the seen cache to avoid alerting on old coins
        if (this.isFirstRun) {
            coins.forEach(c => c.address && this.seenCoins.add(c.address.toLowerCase()));
            this.isFirstRun = false;
            logger.debug(LogCode.SYS_INFO, 'Alpha Detector: Initialized cache', { count: coins.length });
            return;
        }

        // Filter for truly new coins we hasn't seen yet
        const newCoins = coins.filter(c => c.address && !this.seenCoins.has(c.address.toLowerCase()));

        for (const coin of newCoins) {
            const coinAddress = coin.address.toLowerCase();
            this.seenCoins.add(coinAddress);

            // Keep set size manageable
            if (this.seenCoins.size > 1000) {
                const first = this.seenCoins.values().next().value;
                if (first) this.seenCoins.delete(first);
            }

            if (!coin.creatorAddress) continue;

            await this.processCoin(coin);
        }
    }

    /**
     * Process a single coin to check follower count and alert
     */
    private async processCoin(coin: any) {
        logger.info(LogCode.SYS_INFO, 'Alpha Detector: Checking new coin', { symbol: coin.symbol, creator: coin.creatorAddress });

        try {
            // 1. Fetch creator profile and social stats
            // Note: SDK getNewCoins might returning shallow profile, so we fetch full profile
            const profile = await zoraService.getUserProfile(coin.creatorAddress);

            const followers = {
                twitter: profile?.socialAccounts?.twitter?.followerCount || 0,
                farcaster: profile?.socialAccounts?.farcaster?.followerCount || 0,
                instagram: profile?.socialAccounts?.instagram?.followerCount || 0,
                tiktok: profile?.socialAccounts?.tiktok?.followerCount || 0
            };

            const maxFollowers = Math.max(...Object.values(followers));
            const platform = Object.entries(followers).reduce((a, b) => a[1] > b[1] ? a : b)[0];

            logger.debug(LogCode.SYS_INFO, 'Alpha Detector: Creator social check', {
                symbol: coin.symbol,
                creator: coin.creatorAddress,
                stats: followers,
                max: maxFollowers
            });

            // 2. Check Global Threshold
            if (maxFollowers >= GLOBAL_FOLLOWER_THRESHOLD) {
                logger.info(LogCode.SYS_INFO, 'Alpha Detector: 🚨 ALPHA DETECTED 🚨', {
                    symbol: coin.symbol,
                    maxFollowers,
                    platform
                });

                // 3. Broadcast to ALL users
                await this.broadcastAlphaAlert({
                    symbol: coin.symbol,
                    coinAddress: coin.address,
                    creatorName: profile?.displayName || profile?.handle || coin.creatorAddress.slice(0, 8),
                    followerCount: maxFollowers,
                    platform,
                    zoraUrl: `https://zora.co/coin/base:${coin.address}`
                });
            }

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Alpha Detector: Processing coin failed', { symbol: coin.symbol, error: error.message });
        }
    }

    /**
     * Broadcast the alert to all applicable users
     */
    private async broadcastAlphaAlert(data: {
        symbol: string;
        coinAddress: string;
        creatorName: string;
        followerCount: number;
        platform: string;
        zoraUrl: string;
    }) {
        try {
            // Find all users who have a Farcaster FID connected
            const interestedUsers = await prisma.user.findMany({
                where: {
                    farcasterFid: { not: null }
                },
                select: {
                    id: true,
                    farcasterFid: true
                }
            });

            logger.info(LogCode.SYS_INFO, 'Alpha Detector: Broadcasting alert', {
                recipientCount: interestedUsers.length,
                symbol: data.symbol
            });

            // Format aesthetic follower count (e.g. "1.2M")
            const formattedFollowers = this.formatFollowerCount(data.followerCount);
            const followerDisplay = `${formattedFollowers} (${this.capitalize(data.platform)})`;

            // Send notifications (fire and forget to speed up)
            for (const user of interestedUsers) {
                if (!user.farcasterFid) continue;

                notificationService.sendNotification({
                    userId: user.id,
                    farcasterFid: user.farcasterFid,
                    type: 'ALPHA_CANDIDATE',
                    data: {
                        tokenSymbol: data.symbol,
                        tokenAddress: data.coinAddress,
                        creatorName: data.creatorName,
                        followerCount: followerDisplay,
                        zoraUrl: data.zoraUrl
                    }
                }).catch(err => {
                    logger.warn(LogCode.API_NOTIFY_FAILED, 'Failed to send broadcast', { userId: user.id, error: err.message });
                });
            }

        } catch (error: any) {
            logger.error(LogCode.SYS_ERROR, 'Alpha Detector: Broadcast failed', { error: error.message });
        }
    }

    // Helper: 1200000 -> 1.2M
    private formatFollowerCount(num: number): string {
        if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
        if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
        return num.toString();
    }

    private capitalize(s: string) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
}

export const zoraAlertService = new ZoraAlertService();
