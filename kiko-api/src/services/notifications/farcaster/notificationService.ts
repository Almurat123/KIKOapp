import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { warpcastService } from './warpcastDmService.js';
import { buildFarcasterNotificationMessage } from './templates.js';
import type { TradeNotificationParams, TradeNotificationType } from './types.js';

const MUST_NOTIFY_TYPES = new Set<TradeNotificationType>([
    'TRADE_SUCCESS_BUY',
    'TRADE_SUCCESS_SELL',
    'TRADE_FAILURE',
    'COPY_TRADE_SKIPPED'
]);

export class NotificationService {
    private static instance: NotificationService;

    private constructor() { }

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    public async sendNotification(params: TradeNotificationParams): Promise<boolean> {
        const { farcasterFid, type, data } = params;

        if (!farcasterFid) {
            if (MUST_NOTIFY_TYPES.has(type)) {
                logger.warn(LogCode.API_NOTIFY_FAILED, 'No Farcaster FID provided, critical notification not sent', {
                    userId: params.userId,
                    type,
                    skipReason: data.skipReason
                });
            } else {
                logger.debug(LogCode.API_NOTIFY_FAILED, 'No Farcaster FID provided, skipping notification', {
                    userId: params.userId,
                    type
                });
            }
            return false;
        }

        if (!warpcastService.isConfigured()) {
            logger.warn(LogCode.API_NOTIFY_FAILED, 'Warpcast service not configured, skipping notification', {
                userId: params.userId,
                type
            });
            return false;
        }

        const message = buildFarcasterNotificationMessage(type, data);

        try {
            return await warpcastService.sendDirectCast({
                recipientFid: farcasterFid,
                message
            });
        } catch (error: any) {
            logger.error(LogCode.API_NOTIFY_FAILED, 'Failed to send Farcaster notification', {
                userId: params.userId,
                type,
                error: error.message
            });
            return false;
        }
    }
}

export const notificationService = NotificationService.getInstance();
