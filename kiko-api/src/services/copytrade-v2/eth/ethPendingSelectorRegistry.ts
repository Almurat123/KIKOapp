export type EthPendingSelectorCapabilityKind =
  | 'native_buy_padded_tokenout'
  | 'unsupported';

export type EthPendingSelectorCapability = {
  selector: string;
  kind: EthPendingSelectorCapabilityKind;
  reasonCode:
    | 'PENDING_PREDECODE_SELECTOR_SUPPORTED'
    | 'PENDING_PREDECODE_UNSUPPORTED_SELECTOR';
};

const NATIVE_BUY_PADDED_TOKENOUT_SELECTORS = new Set([
  '0x0f27c5c1',
  '0xd1ee211d',
  '0x2213bc0b',
  '0x784e2685',
  '0x0490a7f3',
  '0xb6f9de95',
  '0x04e45aaf',
]);

export function resolveEthPendingSelectorCapability(selector?: string): EthPendingSelectorCapability {
  const normalized = String(selector || '').toLowerCase();
  if (NATIVE_BUY_PADDED_TOKENOUT_SELECTORS.has(normalized)) {
    return {
      selector: normalized,
      kind: 'native_buy_padded_tokenout',
      reasonCode: 'PENDING_PREDECODE_SELECTOR_SUPPORTED',
    };
  }
  return {
    selector: normalized,
    kind: 'unsupported',
    reasonCode: 'PENDING_PREDECODE_UNSUPPORTED_SELECTOR',
  };
}
