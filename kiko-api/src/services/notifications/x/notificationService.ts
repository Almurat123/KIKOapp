import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import { buildFarcasterNotificationMessage } from '../farcaster/templates.js';
import type { TradeNotificationParams, TradeNotificationType } from '../farcaster/types.js';
import { xReplyService } from '../../x/xReplyService.js';

const MUST_NOTIFY_TYPES = new Set<TradeNotificationType>([
  'TRADE_SUCCESS_BUY',
  'TRADE_SUCCESS_SELL',
  'TRADE_FAILURE',
  'COPY_TRADE_SKIPPED',
]);

export class XNotificationService {
  async sendNotification(params: TradeNotificationParams): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { privyDid: params.userId },
      select: {
        xUserId: true,
        xDmOptInAt: true,
        xNotificationsMutedAt: true,
      },
    });

    if (!user?.xUserId || !user?.xDmOptInAt || user?.xNotificationsMutedAt) {
      if (MUST_NOTIFY_TYPES.has(params.type)) {
        logger.info(LogCode.API_NOTIFY_FAILED, '[X] Notification skipped: no DM-capable X binding', {
          userId: params.userId,
          type: params.type,
        });
      }
      return false;
    }

    return xReplyService.sendDirectMessage({
      userId: params.userId,
      xUserId: user.xUserId,
      text: buildFarcasterNotificationMessage(params.type, params.data),
      idempotencyKey: `x-notify:${params.userId}:${params.type}:${JSON.stringify(params.data)}`,
      messageType: 'notification',
      incrementRoundTrip: false,
    });
  }
}

export const xNotificationService = new XNotificationService();
