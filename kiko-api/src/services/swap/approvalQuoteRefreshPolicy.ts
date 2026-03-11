const INITIAL_PROPAGATION_DELAY_MS = Math.max(0, Number(process.env.APPROVAL_QUOTE_PROPAGATION_DELAY_MS || '350'));
const RETRY_PROPAGATION_DELAY_MS = Math.max(
  INITIAL_PROPAGATION_DELAY_MS,
  Number(process.env.APPROVAL_QUOTE_PROPAGATION_RETRY_DELAY_MS || '1600')
);
const MAX_ATTEMPTS = Math.max(1, Number(process.env.APPROVAL_QUOTE_REFRESH_MAX_ATTEMPTS || '2'));

export function getApprovalQuoteRefreshDelayMs(attempt: number): number {
  return attempt <= 1 ? INITIAL_PROPAGATION_DELAY_MS : RETRY_PROPAGATION_DELAY_MS;
}

export function shouldRetryApprovalQuoteRefresh(params: {
  attempt: number;
  quoteFound: boolean;
  allowanceChanged: boolean;
}): boolean {
  if (params.attempt >= MAX_ATTEMPTS) return false;
  return !params.quoteFound || params.allowanceChanged;
}
