export interface TradeSendNoncePolicyInput {
    preWarmedNonce?: string;
    approvalExecutedOnChain: boolean;
}

export function resolveTradeSendNonce(input: TradeSendNoncePolicyInput): string | undefined {
    if (input.approvalExecutedOnChain) {
        return undefined;
    }
    return input.preWarmedNonce;
}
