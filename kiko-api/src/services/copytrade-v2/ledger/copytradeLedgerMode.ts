export type CopytradeLedgerMode = 'v1_compat' | 'v2_primary';
export type CopytradeEngineMode = 'v1_legacy' | 'v2_primary';

export function resolveCopytradeLedgerMode(): CopytradeLedgerMode {
  const raw = String(process.env.COPYTRADE_LEDGER_MODE || 'v2_primary').trim().toLowerCase();
  return raw === 'v1_compat' ? 'v1_compat' : 'v2_primary';
}

export function resolveCopytradeEngineMode(): CopytradeEngineMode {
  const raw = String(process.env.COPYTRADE_ENGINE_MODE || 'v2_primary').trim().toLowerCase();
  return raw === 'v1_legacy' ? 'v1_legacy' : 'v2_primary';
}
