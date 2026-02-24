const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
};

const parseIntSafe = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function isContextBusEnabled(): boolean {
  return parseBoolean(process.env.CTX_BUS_ENABLED, true);
}

export function isContextPersistEnabled(): boolean {
  return parseBoolean(process.env.CTX_PERSIST_ENABLED, true);
}

export function isContextLearningEnabled(): boolean {
  return parseBoolean(process.env.CTX_LEARNING_ENABLED, true);
}

export function isContextLearningShadowOnly(): boolean {
  return parseBoolean(process.env.CTX_LEARNING_SHADOW_ONLY, true);
}

export function getContextRedisTtlSec(): number {
  return Math.max(60, parseIntSafe(process.env.CTX_REDIS_TTL_SEC, 3600));
}

