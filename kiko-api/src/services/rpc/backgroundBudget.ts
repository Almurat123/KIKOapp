const ACTIVE_HOLD_MS = Math.max(500, Number(process.env.RPC_BACKGROUND_HOLD_MS || '6000'));

const activeCriticalContexts = new Map<string, number>();
let lastCriticalAt = 0;

export function beginCriticalRpcWindow(label: string): () => void {
  const current = (activeCriticalContexts.get(label) || 0) + 1;
  activeCriticalContexts.set(label, current);
  lastCriticalAt = Date.now();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = Math.max(0, (activeCriticalContexts.get(label) || 1) - 1);
    if (next === 0) activeCriticalContexts.delete(label);
    else activeCriticalContexts.set(label, next);
    lastCriticalAt = Date.now();
  };
}

export function hasCriticalRpcPressure(): boolean {
  if (activeCriticalContexts.size > 0) return true;
  return Date.now() - lastCriticalAt < ACTIVE_HOLD_MS;
}

export function getCriticalRpcPressureSnapshot(): { activeContexts: number; lastCriticalAt: number; active: boolean } {
  return {
    activeContexts: activeCriticalContexts.size,
    lastCriticalAt,
    active: hasCriticalRpcPressure()
  };
}
