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

export function isP2PlannerEnabled(): boolean {
  return parseBoolean(process.env.P2_PLANNER_ENABLED, false);
}

export function isP2ExecutorEnabled(): boolean {
  return parseBoolean(process.env.P2_EXECUTOR_ENABLED, false);
}

export function isP2SampleLearningEnabled(): boolean {
  return parseBoolean(process.env.P2_SAMPLE_LEARNING_ENABLED, true);
}

export function isP2ShadowRunEnabled(): boolean {
  return parseBoolean(process.env.P2_SHADOW_RUN_ENABLED, true);
}

export function getP2CanaryPercent(): number {
  const raw = parseIntSafe(process.env.P2_CANARY_PERCENT, 0);
  return Math.max(0, Math.min(100, raw));
}

export function getP2AllowedChains(): number[] {
  const input = String(process.env.P2_ALLOWED_CHAINS || '8453');
  return input
    .split(',')
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((x) => Number.isFinite(x));
}

export function getP2TemplateMinSuccessRate(): number {
  const parsed = Number.parseFloat(String(process.env.P2_TEMPLATE_MIN_SUCCESS_RATE || '0.65'));
  if (!Number.isFinite(parsed)) return 0.65;
  return Math.max(0, Math.min(1, parsed));
}

export function getP2TemplateMinSampleCount(): number {
  return Math.max(1, parseIntSafe(process.env.P2_TEMPLATE_MIN_SAMPLE_COUNT, 20));
}
