import { ethers } from 'ethers';
import { callRpc } from '../rpcManager.js';
import { sendTransaction } from '../privyWallet.js';
import { waitForReceipt } from './confirmationCoordinator.js';
import type { OrderRuntimeContext } from '../order-runtime/types.js';

export function validatePermit2Payload(
    payload: {
        domain?: Record<string, any>;
        message?: Record<string, any>;
    },
    chainId: number,
    quotePermitExpiry?: number | null
): void {
    const domain = payload?.domain || {};
    const message = payload?.message || {};
    const domainChainIdRaw = domain.chainId;
    if (domainChainIdRaw !== undefined && domainChainIdRaw !== null) {
        const domainChainId = Number(domainChainIdRaw);
        if (Number.isFinite(domainChainId) && domainChainId > 0 && domainChainId !== chainId) {
            throw new Error(`permit2_chain_mismatch:${domainChainId}!=${chainId}`);
        }
    }
    const nowSec = Math.floor(Date.now() / 1000);
    const sigDeadlineRaw = message.sigDeadline ?? quotePermitExpiry ?? null;
    if (sigDeadlineRaw !== null && sigDeadlineRaw !== undefined) {
        const sigDeadline = Number(sigDeadlineRaw);
        if (!Number.isFinite(sigDeadline) || sigDeadline <= nowSec) {
            throw new Error('permit2_deadline_expired');
        }
        const maxTtl = nowSec + 24 * 60 * 60 + 5 * 60;
        if (sigDeadline > maxTtl) {
            throw new Error('permit2_deadline_exceeds_24h');
        }
    }
}

export function appendPermit2SignatureToCalldata(calldata: string, signature: string): string {
    const data = String(calldata || '');
    if (!data.startsWith('0x')) {
        throw new Error('invalid_calldata_for_permit2');
    }
    const sig = String(signature || '');
    if (!sig.startsWith('0x') || sig.length < 4 || sig.length % 2 !== 0) {
        throw new Error('invalid_permit2_signature');
    }
    const sigNoPrefix = sig.slice(2);
    const sigLenBytes = sigNoPrefix.length / 2;
    const sigLenHex = sigLenBytes.toString(16).padStart(64, '0');
    return `${data}${sigLenHex}${sigNoPrefix}`;
}

export async function executeApproval(params: {
    userId: string;
    token: string;
    spender: string;
    requiredAmountBase: string;
    chainId: number;
    accessToken?: string;
    runtimeContext?: OrderRuntimeContext;
}): Promise<string> {
    const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    const exactApproval = (BigInt(params.requiredAmountBase || '0') + 1n).toString();
    const data = iface.encodeFunctionData('approve', [params.spender, exactApproval]);

    const txHash = await sendTransaction(params.userId, params.accessToken || '', {
        to: params.token,
        data,
        value: '0',
        chainId: params.chainId,
        txPurpose: 'approval',
        runtimeContext: params.runtimeContext
    });

    await waitForReceipt(params.chainId, txHash, 60000);
    return txHash;
}
