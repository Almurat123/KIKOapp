const MAX_DECIMAL_38_18_INTEGER_DIGITS = 20;
const MAX_DECIMAL_38_18_FRACTION_DIGITS = 18;

export type PositionAmountStorageReasonCode =
  | 'POSITION_DECIMAL_SAFE'
  | 'POSITION_DECIMAL_OVERFLOW_PREVENTED'
  | 'POSITION_AMOUNT_UNAVAILABLE';

function normalizeDecimalString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) return null;

  const negative = trimmed.startsWith('-');
  const unsigned = negative || trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  const [integerRaw, fractionRaw = ''] = unsigned.split('.');
  const integerPart = integerRaw.replace(/^0+(?=\d)/, '') || '0';
  const fractionPart = fractionRaw.replace(/0+$/, '');
  const normalized = fractionPart ? `${integerPart}.${fractionPart}` : integerPart;
  if (normalized === '0') return '0';
  return negative ? `-${normalized}` : normalized;
}

export function canStoreDecimal3818(value: string | null | undefined): boolean {
  const normalized = normalizeDecimalString(value);
  if (!normalized) return false;
  const unsigned = normalized.startsWith('-') ? normalized.slice(1) : normalized;
  const [integerPart, fractionPart = ''] = unsigned.split('.');
  if (integerPart.length >= MAX_DECIMAL_38_18_INTEGER_DIGITS) return false;
  if (fractionPart.length > MAX_DECIMAL_38_18_FRACTION_DIGITS) return false;
  return true;
}

export function encodePositionTokenAmount(params: {
  exactAmount?: string | null;
}): {
  exactAmount?: string;
  decimalAmount?: string;
  reasonCode: PositionAmountStorageReasonCode;
} {
  const exactAmount = normalizeDecimalString(params.exactAmount);
  if (!exactAmount) {
    return { reasonCode: 'POSITION_AMOUNT_UNAVAILABLE' };
  }

  if (canStoreDecimal3818(exactAmount)) {
    return {
      exactAmount,
      decimalAmount: exactAmount,
      reasonCode: 'POSITION_DECIMAL_SAFE',
    };
  }

  return {
    exactAmount,
    reasonCode: 'POSITION_DECIMAL_OVERFLOW_PREVENTED',
  };
}
