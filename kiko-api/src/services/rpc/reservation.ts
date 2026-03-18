import type { RpcLane } from './types.js';

interface ReservationEntry {
  secondUnits: number;
  minuteUnits: number;
  expiresAt: number;
}

const reservations = new Map<string, ReservationEntry[]>();

function prune(url: string, now = Date.now()): ReservationEntry[] {
  const active = (reservations.get(url) || []).filter((entry) => entry.expiresAt > now);
  if (active.length > 0) {
    reservations.set(url, active);
  } else {
    reservations.delete(url);
  }
  return active;
}

function reservationTtlMs(lane: RpcLane): number {
  if (lane === 'write' || lane === 'confirm') return 1400;
  if (lane === 'route_read') return 900;
  return 500;
}

export function reserveProjectedEndpointUsage(params: {
  url: string;
  lane: RpcLane;
  secondUnits: number;
  minuteUnits?: number;
}): void {
  const now = Date.now();
  const active = prune(params.url, now);
  active.push({
    secondUnits: Math.max(0, params.secondUnits),
    minuteUnits: Math.max(0, params.minuteUnits ?? params.secondUnits),
    expiresAt: now + reservationTtlMs(params.lane),
  });
  reservations.set(params.url, active);
}

export function getProjectedEndpointUsage(url: string): {
  reservedSecondCount: number;
  reservedMinuteCount: number;
} {
  const active = prune(url);
  return active.reduce(
    (acc, entry) => {
      acc.reservedSecondCount += entry.secondUnits;
      acc.reservedMinuteCount += entry.minuteUnits;
      return acc;
    },
    { reservedSecondCount: 0, reservedMinuteCount: 0 }
  );
}

export function resetProjectedEndpointUsage(): void {
  reservations.clear();
}
