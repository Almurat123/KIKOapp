import prisma from '../../../db/prisma.js';
import type { CopytradeMode } from '../contracts/modePolicy.js';
import type { CopytradeOrderAggregate } from '../contracts/aggregate.js';

export interface ResolvedTradingContext {
  userId: string;
  walletAddress: string;
  configId: string;
  chainId: number;
  mode: CopytradeMode;
  executionMode: 'safe' | 'normal' | 'turbo';
  maxSlippageBps: number;
  buyAmountUsd: number;
  targetWallet: string;
  userSettings: {
    swapMethod?: 'allowance_trade' | 'wallet_sign';
    fastSwapMode?: boolean;
    copyTradeExecutionMode?: 'safe' | 'normal' | 'turbo';
    mevProtection?: boolean;
  };
}

function toExecutionMode(mode: string | null | undefined): 'safe' | 'normal' | 'turbo' {
  const normalized = String(mode || '').trim().toLowerCase();
  if (normalized === 'safe' || normalized === 'safety') return 'safe';
  if (normalized === 'turbo') return 'turbo';
  return 'normal';
}

function toModeExecution(mode: CopytradeMode): 'safe' | 'normal' | 'turbo' {
  if (mode === 'safety') return 'safe';
  if (mode === 'turbo') return 'turbo';
  return 'normal';
}

export async function resolveTradingContext(order: CopytradeOrderAggregate): Promise<ResolvedTradingContext | null> {
  const normalizedTargetWallet = String(order.targetWallet || '').trim().toLowerCase();

  const config = order.configId
    ? await prisma.copyTradeConfig.findUnique({
        where: { id: order.configId },
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
      })
    : await prisma.copyTradeConfig.findFirst({
        where: {
          targetWallet: normalizedTargetWallet,
          chainId: order.chainId,
          status: 'active',
        },
        include: {
          user: {
            include: {
              settings: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

  if (!config || config.status !== 'active') {
    return null;
  }

  const user = config.user;
  if (!user) {
    return null;
  }

  const walletAddress = order.chainId === 900
    ? String(user.solanaWalletAddress || '').trim()
    : String(user.walletAddress || '').trim();

  const modeExecution = config.executionMode
    ? toExecutionMode(config.executionMode)
    : toModeExecution(order.mode);

  return {
    userId: user.privyDid,
    walletAddress,
    configId: config.id,
    chainId: config.chainId,
    mode: order.mode,
    executionMode: modeExecution,
    maxSlippageBps: Math.max(50, Math.min(5000, Number(config.maxSlippageBps || 300))),
    buyAmountUsd: Number(config.buyAmountUsd || 0),
    targetWallet: String(config.targetWallet || '').trim().toLowerCase(),
    userSettings: {
      swapMethod: (user.settings?.swapMethod as any) || 'wallet_sign',
      fastSwapMode: modeExecution === 'turbo',
      copyTradeExecutionMode: modeExecution,
      mevProtection: user.settings?.mevProtection !== false,
    },
  };
}
