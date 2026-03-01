import type { DecodedSwap } from '../../txDecoder.js';

export type SolanaInstructionLike = {
    parsed?: {
        type?: string;
        info?: Record<string, any>;
    };
    program?: string;
    programId?: string | { toBase58?: () => string };
    accounts?: any[];
    stackHeight?: number | null;
};

export type SolanaDecodeContext = {
    walletAddress: string;
    txHash: string;
};

export type SolanaDecodedSwap = DecodedSwap;
