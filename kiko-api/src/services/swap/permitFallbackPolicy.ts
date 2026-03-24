export function shouldRetryPermit2AsAllowanceHolder(params: {
    isPermit2Path: boolean;
    permit2ExecutionFallbackTried?: boolean;
    isSellTx: boolean;
}): boolean {
    return Boolean(
        params.isPermit2Path
        && params.isSellTx
        && !params.permit2ExecutionFallbackTried
    );
}

export function shouldUseSignedPermitForSell(params: {
    dex?: string | null;
    allowSignedPermit?: boolean;
    isSellTx: boolean;
    isNativeIn: boolean;
}): boolean {
    return Boolean(
        params.allowSignedPermit
        && params.isSellTx
        && !params.isNativeIn
        && params.dex === '0x'
    );
}
