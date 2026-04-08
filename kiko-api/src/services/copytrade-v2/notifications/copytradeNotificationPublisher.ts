import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { notificationService } from '../../notifications/farcaster/index.js';
import { xNotificationService } from '../../notifications/x/index.js';
import type { TradeNotificationData, TradeNotificationType } from '../../notifications/farcaster/types.js';
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

const REASON_COPY_MAP: Record<string, string> = {
  ok_buy_confirmed_open: 'Buy confirmed on-chain',
  ok_exit_submitted: 'Sell submitted to chain',
  ok_exit_confirmed_closed: 'Sell confirmed on-chain',
  deferred_retry_later: 'Execution delayed and scheduled to retry',
  deferred_confirmation_pending: 'Transaction confirmation still pending',
  validation_unroutable: 'Trading context unavailable',
  validation_low_confidence: 'Signal confidence below threshold',
  trading_execution_failed: 'Execution failed and will retry if possible',
  trading_execution_uncertain: 'Execution result uncertain',
  failed_retry_budget_exhausted: 'Retry budget exhausted',
  failed_terminal: 'Execution failed terminally',
  ingress_deduped: 'Duplicate signal ignored',
};

function mapReasonCodeToUserCopy(reasonCode: string): string {
  return REASON_COPY_MAP[reasonCode] || reasonCode;
}

export function resolveDedupeKey(event: CopytradeNotificationEvent): string {
  return [
    event.order.id,
    event.type,
    event.reasonCode,
    event.txHash || '',
    event.sourceTxHash || '',
  ].join(':');
}

export function shouldSkipByDedupeKey(dedupeKey: string): boolean {
  const now = Date.now();
  for (const [key, ts] of sentEventAt.entries()) {
    if (now - ts > DM_DEDUP_TTL_MS) sentEventAt.delete(key);
  }

  const prev = sentEventAt.get(dedupeKey);
  if (prev && now - prev <= DM_DEDUP_TTL_MS) return true;
  sentEventAt.set(dedupeKey, now);
  return false;
}

export async function publishCopytradeRawNotification(params: {
  dedupeKey: string;
  userId: string;
  farcasterFid?: number | null;
  type: TradeNotificationType;
  data: TradeNotificationData;
}): Promise<void> {
  if (!params.userId) return;
  if (shouldSkipByDedupeKey(params.dedupeKey)) return;
  await Promise.allSettled([
    notificationService.sendNotification({
      userId: params.userId,
      farcasterFid: params.farcasterFid,
      type: params.type,
      data: params.data,
    }),
    xNotificationService.sendNotification({
      userId: params.userId,
      type: params.type,
      data: params.data,
    }),
  ]);
}

export function resolveUserNotificationPayload(params: {
  event: CopytradeNotificationEvent;
  tokenSymbol: string;
  targetWallet: string;
  txHash: string | null;
}): { type: TradeNotificationType; data: TradeNotificationData } | null {
  const { event, tokenSymbol, targetWallet, txHash } = params;
  const reasonCopy = mapReasonCodeToUserCopy(event.reasonCode);

  if (event.type === 'BUY_ACCEPTED') {
    return null;
  }

  if (event.type === 'BUY_CONFIRMED_OPEN') {
    const usdValue = String(event.order.metadata?.amountIn || event.order.metadata?.amountOut || '0');
    return {
      type: 'TRADE_SUCCESS_BUY',
      data: {
        tokenSymbol,
        usdValue,
        txHash: txHash || undefined,
        targetWallet,
        chainId: event.order.chainId,
      },
    };
  }

  if (event.type === 'EXIT_SUBMITTED') {
    return {
      type: 'SYSTEM_ALERT',
      data: {
        alertTitle: 'Exit Submitted',
        alertMessage: `${tokenSymbol} exit submitted, waiting confirmation`,
        tokenSymbol,
        txHash: txHash || undefined,
        targetWallet,
        chainId: event.order.chainId,
      },
    };
  }

  if (event.type === 'EXIT_CONFIRMED_CLOSED') {
    const usdValue = String(event.order.metadata?.amountOut || event.order.metadata?.amountIn || '0');
    return {
      type: 'TRADE_SUCCESS_SELL',
      data: {
        tokenSymbol,
        usdValue,
        txHash: txHash || undefined,
        targetWallet,
        chainId: event.order.chainId,
      },
    };
  }

  if (event.type === 'EXECUTION_FAILED') {
    const error = event.error || `${reasonCopy} (${event.reasonCode})`;
    return {
      type: 'TRADE_FAILURE',
      data: {
        tokenSymbol,
        error,
        targetWallet,
        chainId: event.order.chainId,
      },
    };
  }

  return {
    type: 'COPY_TRADE_SKIPPED',
    data: {
      tokenSymbol,
      targetWallet,
      chainId: event.order.chainId,
      skipReason: `${reasonCopy} (${event.reasonCode})`,
    },
  };
}

export class CopytradeNotificationPublisher {
  async publish(event: CopytradeNotificationEvent): Promise<void> {
    if (!event.order.userId) return;
    const dedupeKey = resolveDedupeKey(event);
    if (shouldSkipByDedupeKey(dedupeKey)) return;

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

    const payload = resolveUserNotificationPayload({
      event,
      tokenSymbol,
      targetWallet,
      txHash,
    });
    if (!payload) {
      logger.debug(LogCode.API_NOTIFY_FAILED, '[CopyTradeV2][DM] notification suppressed by policy', {
        orderId: event.order.id,
        type: event.type,
        reasonCode: event.reasonCode,
      });
      return;
    }

    await publishCopytradeRawNotification({
      dedupeKey,
      userId: user.privyDid,
      farcasterFid: user.farcasterFid,
      type: payload.type,
      data: payload.data,
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
