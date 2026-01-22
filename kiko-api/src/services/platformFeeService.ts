import { env } from '../config/env.js';

export type FeeContext = 'swap' | 'copyTrade';

export interface PlatformFee {
  bps: number;
  evmRecipient?: string;
  solanaRecipient?: string;
}

export function getPlatformFee(context: FeeContext): PlatformFee {
  if (!env.platformFees?.enabled) return { bps: 0 };

  const bps = context === 'copyTrade' ? env.platformFees.copyTradeBps : env.platformFees.swapBps;
  const safeBps = Number.isFinite(bps) ? Math.max(0, Math.min(1000, Math.floor(bps))) : 0; // hard cap 10%

  return {
    bps: safeBps,
    evmRecipient: env.platformFees.evmRecipient,
    solanaRecipient: env.platformFees.solanaRecipient,
  };
}

export function isValidEvmAddress(address?: string): boolean {
  if (!address) return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}

