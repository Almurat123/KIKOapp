import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { notificationService } from '../../notifications/farcaster/index.js';
import { getTokenInfo } from '../../tokenService.js';
import type { CopytradeNotificationEvent } from '../contracts/notifications.js';

const DM_DEDUP_TTL_MS = 6 * 60 * 60 * 1000;
const sentEventAt = new Map<string, number>();

function resolveTokenAddress(event: CopytradeNotificationEvent): string {
  if (event.type === 'EXIT_SUBMITTED' || event.type === 'EXIT_CONFIRMED_CLOSED') {
    return event.order.tokenIn;
  }
  return event.order.tokenOut;
}

function shortAddress(value: string): string {
  if (!value) return 'unknown';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function resolveDedupeKey(event: CopytradeNotificationEvent): string {
  return [
    event.order.id,
    event.type,
    event.reasonCode,
    event.txHash || '',
    event.sourceTxHash || '',
  ].join(':');
}

function shouldSkipEvent(event: CopytradeNotificationEvent): boolean {
  const now = Date.now();
  for (const [key, ts] of sentEventAt.entries()) {
    if (now - ts > DM_DEDUP_TTL_MS) sentEventAt.delete(key);
  }

  const key = resolveDedupeKey(event);
  const prev = sentEventAt.get(key);
  if (prev && now - prev <= DM_DEDUP_TTL_MS) return true;
  sentEventAt.set(key, now);
  return false;
}

export class CopytradeNotificationPublisher {
  async publish(event: CopytradeNotificationEvent): Promise<void> {
    if (!event.order.userId) return;
    if (shouldSkipEvent(event)) return;

    const user = await prisma.user.findUnique({
      where: { privyDid: event.order.userId },
      select: {
        privyDid: true,
        farcasterFid: true,
      },
    });
    if (!user?.privyDid) return;

    const tokenAddress = resolveTokenAddress(event);
    const tokenInfo = await getTokenInfo(tokenAddress, event.order.chainId).catch(() => null);
    const tokenSymbol = String(tokenInfo?.symbol || shortAddress(tokenAddress));
    const targetWallet = event.order.targetWallet;
    const txHash = String(event.txHash || '').trim() || null;

    if (event.type === 'BUY_ACCEPTED') {
      await notificationService.sendNotification({
        userId: user.privyDid,
        farcasterFid: user.farcasterFid,
        type: 'SYSTEM_ALERT',
        data: {
          alertTitle: 'Buy Accepted',
          alertMessage: `${tokenSymbol} accepted on-chain and waiting confirmation`,
          tokenSymbol,
          txHash: txHash || undefined,
          targetWallet,
          chainId: event.order.chainId,
        },
      });
      return;
    }

    if (event.type === 'BUY_CONFIRMED_OPEN') {
      const usdValue = String(event.order.metadata?.amountIn || event.order.metadata?.amountOut || '0');
      await notificationService.sendNotification({
        userId: user.privyDid,
        farcasterFid: user.farcasterFid,
        type: 'TRADE_SUCCESS_BUY',
        data: {
          tokenSymbol,
          usdValue,
          txHash: txHash || undefined,
          targetWallet,
          chainId: event.order.chainId,
        },
      });
      return;
    }

    if (event.type === 'EXIT_SUBMITTED') {
      await notificationService.sendNotification({
        userId: user.privyDid,
        farcasterFid: user.farcasterFid,
        type: 'SYSTEM_ALERT',
        data: {
          alertTitle: 'Exit Submitted',
          alertMessage: `${tokenSymbol} exit submitted, waiting confirmation`,
          tokenSymbol,
          txHash: txHash || undefined,
          targetWallet,
          chainId: event.order.chainId,
        },
      });
      return;
    }

    if (event.type === 'EXIT_CONFIRMED_CLOSED') {
      const usdValue = String(event.order.metadata?.amountOut || event.order.metadata?.amountIn || '0');
      await notificationService.sendNotification({
        userId: user.privyDid,
        farcasterFid: user.farcasterFid,
        type: 'TRADE_SUCCESS_SELL',
        data: {
          tokenSymbol,
          usdValue,
          txHash: txHash || undefined,
          targetWallet,
          chainId: event.order.chainId,
        },
      });
      return;
    }

    if (event.type === 'EXECUTION_FAILED') {
      await notificationService.sendNotification({
        userId: user.privyDid,
        farcasterFid: user.farcasterFid,
        type: 'TRADE_FAILURE',
        data: {
          tokenSymbol,
          error: event.error || event.reasonCode,
          targetWallet,
          chainId: event.order.chainId,
        },
      });
      return;
    }

    await notificationService.sendNotification({
      userId: user.privyDid,
      farcasterFid: user.farcasterFid,
      type: 'COPY_TRADE_SKIPPED',
      data: {
        tokenSymbol,
        targetWallet,
        chainId: event.order.chainId,
        skipReason: event.reasonCode,
      },
    });
  }
}

export function logNotificationPublishFailure(error: unknown, event: CopytradeNotificationEvent): void {
  logger.warn(LogCode.API_NOTIFY_FAILED, '[CopyTradeV2][DM] publish failed', {
    orderId: event.order.id,
    type: event.type,
    reasonCode: event.reasonCode,
    error: String((error as any)?.message || error || 'unknown_error').slice(0, 240),
  });
}
