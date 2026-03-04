export class CopytradeDomainError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly statusCode: number;
  readonly context?: Record<string, unknown>;

  constructor(params: {
    code: string;
    message: string;
    retryable?: boolean;
    statusCode?: number;
    context?: Record<string, unknown>;
  }) {
    super(params.message);
    this.name = 'CopytradeDomainError';
    this.code = params.code;
    this.retryable = Boolean(params.retryable);
    this.statusCode = params.statusCode ?? 500;
    this.context = params.context;
  }
}

export function toCopytradeError(error: unknown, fallbackCode = 'COPYTRADE_UNKNOWN'): CopytradeDomainError {
  if (error instanceof CopytradeDomainError) {
    return error;
  }
  const message = String((error as any)?.message || error || 'unknown_error');
  return new CopytradeDomainError({
    code: fallbackCode,
    message,
    retryable: true,
  });
}
