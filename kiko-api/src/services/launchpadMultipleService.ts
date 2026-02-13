type LaunchpadPriceKey = `${string}:${string}` | string;

const GLOBAL_FIXED_START_USD = Number(process.env.LAUNCHPAD_FIXED_START_USD || '0');
let fileOverridesLoaded = false;
const fileOverrides = new Map<string, number>();

function toFinitePositive(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizedLaunchpad(value?: string): string {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'pumpfun') return 'pump.fun';
  if (v === 'bonkfun') return 'bonk.fun';
  if (v === 'fourmeme') return 'four.meme';
  if (v === 'four') return 'four.meme';
  if (v === 'virtual') return 'virtuals';
  if (v === 'doppler finance') return 'doppler';
  return v;
}

async function loadOverridesOnce(): Promise<void> {
  if (fileOverridesLoaded) return;
  fileOverridesLoaded = true;
  try {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const raw = await readFile(resolve(process.cwd(), 'data/launchpad-start-price-overrides.json'), 'utf8');
    const parsed = JSON.parse(raw) as any;
    const summary = parsed?.summary || {};
    for (const [key, value] of Object.entries(summary)) {
      const px = Number((value as any)?.median || 0);
      if (Number.isFinite(px) && px > 0) fileOverrides.set(String(key).toLowerCase(), px);
    }
  } catch {
    // optional local override file
  }
}

function getFixedStartUsd(chain: string, launchpad: string): number | null {
  const chainId = String(chain || '').trim().toLowerCase();
  const lp = normalizedLaunchpad(launchpad);
  if (!lp) return null;
  const fromFile = fileOverrides.get(`${chainId}:${lp}`);
  if (fromFile) return fromFile;

  const envKey = `LAUNCHPAD_FIXED_START_USD_${chainId.toUpperCase()}_${lp.replace(/[^a-z0-9]/gi, '_').toUpperCase()}`;
  const fromEnv = toFinitePositive(process.env[envKey]);
  if (fromEnv) return fromEnv;

  const defaults: Record<LaunchpadPriceKey, number> = {
    // User-calibrated launchpad start prices (USD)
    'base:clanker': 0.00000025,
    'base:doppler': 0.00000025,
    'base:zora': 0.00001,
    'base:virtuals': 0.0001,
    'solana:pump.fun': 0.00003,
    'solana:bonk.fun': 0.00003,
    'bsc:four.meme': 0.000035,
    'bsc:flap': 0.000035,
  };

  return defaults[`${chainId}:${lp}`] || toFinitePositive(GLOBAL_FIXED_START_USD);
}

export function computeLaunchpadMultiple(
  chain: string,
  launchpad: string | undefined,
  currentPriceUsd: unknown
): number | null {
  // Fire-and-forget lazy load; first calls still use defaults/env.
  void loadOverridesOnce();
  const lp = normalizedLaunchpad(launchpad);
  if (!lp) return null;
  const current = toFinitePositive(currentPriceUsd);
  if (!current) return null;
  const startUsd = getFixedStartUsd(chain, lp);
  if (!startUsd) return null;
  const multiple = current / startUsd;
  if (!Number.isFinite(multiple) || multiple <= 0) return null;
  return Math.min(multiple, 200_000);
}
