import React from 'react';

export interface SwapCardData {
    tokenIn?: any;
    tokenOut?: any;
    quote?: any;
    rate?: string;
    slippage?: any;
    [key: string]: any;
}

export const SwapCard: React.FC<any> = () => {
    return <div>Swap Card</div>;
};
