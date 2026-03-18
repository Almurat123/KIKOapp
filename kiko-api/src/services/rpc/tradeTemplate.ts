import { getRpcEndpointsForLane } from '../../config/apiEndpoints.js';
import { reserveProjectedEndpointUsage } from './reservation.js';
import type { RpcLane } from './types.js';

type TradeReservationTemplate = 'copytrade_buy' | 'direct_swap_quote' | 'tx_visibility';

const recentReservations = new Map<string, number>();
const RECENT_RESERVATION_TTL_MS = 1500;

const CHAIN_ID_TO_RPC_SLUG: Record<number, string> = {
  1: 'eth',
  10: 'optimism',
  56: 'bsc',
  137: 'polygon',
  8453: 'base',
  42161: 'arbitrum',
  900: 'solana',
};

function reserveEndpoints(urls: string[], lane: RpcLane, units: number[]): void {
  urls.forEach((url, index) => {
    if (!url) return;
    const secondUnits = Math.max(0, units[index] ?? 0);
    if (secondUnits <= 0) return;
    reserveProjectedEndpointUsage({
      url,
      lane,
      secondUnits,
      minuteUnits: secondUnits,
    });
  });
}

function getTemplateReservationUnits(template: TradeReservationTemplate): {
  lane: RpcLane;
  criticalUnits: number[];
  cheapUnits: number[];
} {
  switch (template) {
    case 'copytrade_buy':
      return {
        lane: 'route_read',
        criticalUnits: [4, 2],
        cheapUnits: [1, 1],
      };
    case 'direct_swap_quote':
      return {
        lane: 'route_read',
        criticalUnits: [3, 2],
        cheapUnits: [1, 0],
      };
    case 'tx_visibility':
      return {
        lane: 'confirm',
        criticalUnits: [2, 1],
        cheapUnits: [1, 0],
      };
  }
}

export function reserveTradePathTemplate(params: {
  chainId: number;
  template: TradeReservationTemplate;
  traceKey?: string;
}): void {
  const chainSlug = CHAIN_ID_TO_RPC_SLUG[params.chainId];
  if (!chainSlug) return;

  const dedupeKey = `${params.chainId}:${params.template}:${params.traceKey || 'global'}`;
  const now = Date.now();
  const recentUntil = recentReservations.get(dedupeKey) || 0;
  if (recentUntil > now) return;
  recentReservations.set(dedupeKey, now + RECENT_RESERVATION_TTL_MS);

  const templateUnits = getTemplateReservationUnits(params.template);
  const criticalEndpoints = getRpcEndpointsForLane(chainSlug, 'critical')
    .slice(0, templateUnits.criticalUnits.length)
    .map((endpoint) => endpoint.url);
  const cheapEndpoints = getRpcEndpointsForLane(chainSlug, 'cheap')
    .slice(0, templateUnits.cheapUnits.length)
    .map((endpoint) => endpoint.url);

  reserveEndpoints(criticalEndpoints, templateUnits.lane, templateUnits.criticalUnits);
  reserveEndpoints(cheapEndpoints, templateUnits.lane, templateUnits.cheapUnits);
}

export const __tradeTemplateTest = {
  clearRecentReservations(): void {
    recentReservations.clear();
  },
};
