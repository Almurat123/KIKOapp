// CONTEXT MEMORY
// Updated: 2026-04-12
// Author: Linh Tran
// Reason: Farcaster signer registration now needs a standalone script that can
//         generate a SignedKeyRequest deeplink from the app's custody mnemonic
//         and the configured signer public key without relying on hidden state.
// Goal: produce a valid `farcaster://signed-key-request?token=...` deeplink and
//       token pair from env-only inputs, so operators can approve signers on a
//       remote host without manual request assembly.
// Owns: app mnemonic loading, EIP-712 signature creation, signed-key-request
//       POST payload assembly, and human-readable deeplink output.
// Does Not Own: signer approval state, app deployment security policy, or the
//               later Hub write path that uses the approved Ed25519 signer.
// Design Language:
// - The app mnemonic must be treated as a secret and loaded only from env or a
//   server secret manager, never hard-coded.
// - The signer private key is only used to derive the public key that is being
//   approved; the script must not persist it or echo it back.
// - The script should print the deeplink first, then a compact machine-readable
//   summary for operators.
// Document Provenance:
// - Source: https://docs.farcaster.xyz/reference/farcaster/signer-requests
// - Kind: official API doc
// - Retrieved: 2026-04-12
// - Applied To: EIP-712 domain, SignedKeyRequest message shape, POST payload,
//   and deeplinkUrl semantics
// - Verification: verified in docs
// - Source: https://github.com/PinataCloud/pinata-fdk
// - Kind: product/demo doc
// - Retrieved: 2026-04-12
// - Applied To: `deep_link_url` response shape and signer approval workflow
// - Verification: verified in docs
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-12-farcaster-signed-key-request-deeplink.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-farcaster-polling-agent-ingress.md
// - /Users/almurat/KiKo/kiko-api/src/services/farcaster-agent/farcasterApiClient.ts
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mnemonicToAccount } from 'viem/accounts';
import { NobleEd25519Signer, hexStringToBytes } from '@farcaster/hub-nodejs';

type SignedKeyRequestResponse = {
    token?: string;
    deeplinkUrl?: string;
    key?: string;
    state?: string;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const FARCASTER_CLIENT_API = 'https://api.farcaster.xyz';
const SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN = {
    name: 'Farcaster SignedKeyRequestValidator',
    version: '1',
    chainId: 10,
    verifyingContract: '0x00000000fc700472606ed4fa22623acf62c60553',
} as const;
const SIGNED_KEY_REQUEST_TYPE = [
    { name: 'requestFid', type: 'uint256' },
    { name: 'key', type: 'bytes' },
    { name: 'deadline', type: 'uint256' },
] as const;

function readRequiredEnv(name: string): string {
    const value = String(process.env[name] || '').trim();
    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

function readAppFid(): number {
    const raw = String(process.env.APP_FID || process.env.FARCASTER_AGENT_BOT_FID || '').trim();
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value) || value <= 0) {
        throw new Error('Missing or invalid APP_FID (or FARCASTER_AGENT_BOT_FID)');
    }
    return value;
}

function readMnemonic(): string {
    const value = String(process.env.APP_MNEMONIC || process.env.FARCASTER_APP_MNEMONIC || '').trim();
    if (!value) {
        throw new Error('Missing required env var: APP_MNEMONIC (or FARCASTER_APP_MNEMONIC)');
    }
    return value;
}

function normalizeHex(value: string): string {
    const trimmed = String(value || '').trim();
    if (!trimmed) throw new Error('Empty hex value');
    return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

async function main(): Promise<void> {
    const appFid = readAppFid();
    const appMnemonic = readMnemonic();
    const signerPrivateKey = normalizeHex(readRequiredEnv('FARCASTER_SIGNER_PRIVATE_KEY'));
    const redirectUrl = String(process.env.FARCASTER_SIGNER_REDIRECT_URL || '').trim();
    const deadline = Math.floor(Date.now() / 1000) + 86400;

    const signerPrivateKeyBytes = hexStringToBytes(signerPrivateKey);
    if (signerPrivateKeyBytes.isErr()) {
        throw new Error('Invalid FARCASTER_SIGNER_PRIVATE_KEY value');
    }

    const signer = new NobleEd25519Signer(signerPrivateKeyBytes.value);
    const signerKeyResult = await signer.getSignerKey();
    if (signerKeyResult.isErr()) {
        throw new Error(`Failed to derive signer public key: ${signerKeyResult.error}`);
    }

    const signerPublicKey = `0x${Buffer.from(signerKeyResult.value).toString('hex')}` as `0x${string}`;
    const account = mnemonicToAccount(appMnemonic);
    const signature = await account.signTypedData({
        domain: SIGNED_KEY_REQUEST_VALIDATOR_EIP_712_DOMAIN,
        types: { SignedKeyRequest: SIGNED_KEY_REQUEST_TYPE },
        primaryType: 'SignedKeyRequest',
        message: {
            requestFid: BigInt(appFid),
            key: signerPublicKey,
            deadline: BigInt(deadline),
        },
    });

    const requestBody: Record<string, string | number> = {
        key: signerPublicKey,
        requestFid: appFid,
        signature,
        deadline,
    };
    if (redirectUrl) {
        requestBody.redirectUrl = redirectUrl;
    }

    const response = await fetch(`${FARCASTER_CLIENT_API}/v2/signed-key-requests`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
        throw new Error(`Failed to create signed-key-request: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { result?: { signedKeyRequest?: SignedKeyRequestResponse } };
    const signedKeyRequest = payload?.result?.signedKeyRequest;

    if (!signedKeyRequest?.deeplinkUrl || !signedKeyRequest?.token) {
        throw new Error('Farcaster response did not include deeplinkUrl or token');
    }

    console.log(signedKeyRequest.deeplinkUrl);
    console.log(
        JSON.stringify(
            {
                token: signedKeyRequest.token,
                deeplinkUrl: signedKeyRequest.deeplinkUrl,
                key: signedKeyRequest.key,
                state: signedKeyRequest.state,
            },
            null,
            2
        )
    );
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
