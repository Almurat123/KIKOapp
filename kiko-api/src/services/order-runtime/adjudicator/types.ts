export type TxEvidenceSource = 'privy_sendtx' | 'raw_broadcast' | 'rpc_tx' | 'rpc_receipt' | 'alchemy_webhook' | 'pending_prefetch' | 'unknown';

export type AdjudicatedTxState =
  | 'unknown'
  | 'send_accepted'
  | 'rpc_visible'
  | 'chain_observed'
  | 'confirmed_success'
  | 'confirmed_failed'
  | 'rpc_uncertain';

export interface TxEvidenceSnapshot {
  orderId?: string;
  chainId: number;
  canonicalTxHash?: string;
  allTxHashes: string[];
  send: {
    accepted: boolean;
    source?: TxEvidenceSource;
    acceptedAt?: number;
  };
  txByHash: {
    seen: boolean;
    from?: string;
    blockNumber?: string;
    seenAt?: number;
    source?: TxEvidenceSource;
    rpcError?: string;
  };
  receipt: {
    seen: boolean;
    success?: boolean;
    blockNumber?: string;
    seenAt?: number;
    source?: TxEvidenceSource;
    rpcError?: string;
  };
  webhook: {
    seen: boolean;
    source?: TxEvidenceSource;
    seenAt?: number;
    matchedWallet?: string;
  };
  adjudicated: {
    state: AdjudicatedTxState;
    reasonCode: string;
    decidedAt: number;
    final: boolean;
  };
}
