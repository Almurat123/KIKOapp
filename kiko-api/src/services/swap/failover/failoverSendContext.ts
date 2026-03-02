export interface FailoverSendContext {
  previousDex?: string;
  previousDexName?: string;
  previousReasonCode?: string;
  acceptedTxHash?: string;
}

export function extendFailoverSendContext(
  current: FailoverSendContext | undefined,
  update: Partial<FailoverSendContext>
): FailoverSendContext {
  return {
    ...(current || {}),
    ...update
  };
}
