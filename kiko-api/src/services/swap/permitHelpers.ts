import { ethers } from 'ethers';
import { callRpc } from '../rpcManager.js';
import { sendTransaction, signTypedData } from '../privyWallet.js';
import { waitForReceipt } from './confirmationCoordinator.js';

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

async function readPermitNonce(chainId: number, token: string, owner: string): Promise<bigint | null> {
    try {
        const iface = new ethers.Interface(['function nonces(address) view returns (uint256)']);
        const raw = await callRpc<string>(chainId, 'eth_call', [{
            to: token,
            data: iface.encodeFunctionData('nonces', [owner])
        }, 'latest']);
        if (!raw || raw === '0x') return null;
        const [nonce] = iface.decodeFunctionResult('nonces', raw);
        return BigInt(nonce);
    } catch {
        return null;
    }
}

async function readTokenName(chainId: number, token: string): Promise<string | null> {
    try {
        const iface = new ethers.Interface(['function name() view returns (string)']);
        const raw = await callRpc<string>(chainId, 'eth_call', [{
            to: token,
            data: iface.encodeFunctionData('name', [])
        }, 'latest']);
        if (!raw || raw === '0x') return null;
        const [name] = iface.decodeFunctionResult('name', raw);
        const value = String(name || '').trim();
        return value || null;
    } catch {
        return null;
    }
}

async function readTokenVersion(chainId: number, token: string): Promise<string | null> {
    try {
        const iface = new ethers.Interface(['function version() view returns (string)']);
        const raw = await callRpc<string>(chainId, 'eth_call', [{
            to: token,
            data: iface.encodeFunctionData('version', [])
        }, 'latest']);
        if (!raw || raw === '0x') return null;
        const [version] = iface.decodeFunctionResult('version', raw);
        const value = String(version || '').trim();
        return value || null;
    } catch {
        return null;
    }
}

export async function tryBuildKyberPermit(params: {
    userId: string;
    chainId: number;
    token: string;
    owner: string;
    spender: string;
    amountInBase: string;
}): Promise<{ permit: string; deadline: number } | null> {
    const token = ethers.getAddress(params.token);
    const owner = ethers.getAddress(params.owner);
    const spender = ethers.getAddress(params.spender);
    const nonce = await readPermitNonce(params.chainId, token, owner);
    if (nonce === null) return null;
    const tokenName = await readTokenName(params.chainId, token);
    if (!tokenName) return null;
    const tokenVersion = (await readTokenVersion(params.chainId, token)) || '1';
    const deadline = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    const typedData = {
        domain: {
            name: tokenName,
            version: tokenVersion,
            chainId: params.chainId,
            verifyingContract: token
        },
        types: {
            Permit: [
                { name: 'owner', type: 'address' },
                { name: 'spender', type: 'address' },
                { name: 'value', type: 'uint256' },
                { name: 'nonce', type: 'uint256' },
                { name: 'deadline', type: 'uint256' }
            ]
        },
        primaryType: 'Permit',
        message: {
            owner,
            spender,
            value: params.amountInBase,
            nonce: nonce.toString(),
            deadline
        }
    };
    const signature = await signTypedData(params.userId, typedData as any, params.chainId);
    const split = ethers.Signature.from(signature);
    const permit = ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'address', 'uint256', 'uint256', 'uint8', 'bytes32', 'bytes32'],
        [owner, spender, params.amountInBase, deadline, split.v, split.r, split.s]
    );
    return { permit, deadline };
}

export async function executeApproval(params: {
    userId: string;
    token: string;
    spender: string;
    requiredAmountBase: string;
    chainId: number;
    accessToken?: string;
}): Promise<string> {
    const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    const exactApproval = (BigInt(params.requiredAmountBase || '0') + 1n).toString();
    const data = iface.encodeFunctionData('approve', [params.spender, exactApproval]);

    const txHash = await sendTransaction(params.userId, params.accessToken || '', {
        to: params.token,
        data,
        value: '0',
        chainId: params.chainId,
        txPurpose: 'approval'
    });

    await waitForReceipt(params.chainId, txHash, 60000);
    return txHash;
}
