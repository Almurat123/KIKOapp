import { encodeFunctionData, isAddress, parseEther, parseEventLogs } from 'viem';
import { buildFourMemeTokenUrl, buildTransactionExplorerUrl } from '../utils/executionLinks.js';
import { AppError } from '../middleware/errorHandler.js';
import { getEmbeddedWalletInfo, sendTransaction, signMessage } from './privyWallet.js';
import { getTransactionReceipt } from './rpcManager.js';

type Address = `0x${string}`;

export type FourMemeCategory =
    | 'Meme'
    | 'AI'
    | 'Defi'
    | 'Games'
    | 'Infra'
    | 'De-Sci'
    | 'Social'
    | 'Depin'
    | 'Charity'
    | 'Others';

export interface DeployFourMemeTokenInput {
    name: string;
    symbol: string;
    description?: string;
    image: string;
    chainId?: number;
    bnbAmount: number;
    launchTimeFromNow?: number;
    category?: FourMemeCategory;
    websiteUrl?: string;
    twitterUrl?: string;
    telegramUrl?: string;
}

export interface DeployFourMemeTokenOptions {
    confirmDeploy?: boolean;
    userId?: string;
    accessToken?: string;
}

const FOUR_MEME_CHAIN_ID = 56;
const FOUR_MEME_CHAIN_NAME = 'BNB Chain';
const FOUR_MEME_TOKEN_MANAGER = '0x5c952063c7fc8610FFDB798152D69F0B9550762b' as Address;
const FOUR_MEME_API_BASE_URL = 'https://four.meme/meme-api/v1';
const BSC_RAISED_TOKEN = {
    symbol: 'BNB',
    nativeSymbol: 'BNB',
    symbolAddress: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    deployCost: '0',
    buyFee: '0.01',
    sellFee: '0.01',
    minTradeFee: '0',
    b0Amount: '8',
    totalBAmount: '24',
    totalAmount: '1000000000',
    logoUrl: 'https://static.four.meme/market/68b871b6-96f7-408c-b8d0-388d804b34275092658264263839640.png',
    tradeLevel: ['0.1', '0.5', '1'],
    status: 'PUBLISH',
    buyTokenLink: 'https://pancakeswap.finance/swap',
    reservedNumber: 10,
    saleRate: '0.8',
    networkCode: 'BSC',
    platform: 'MEME',
} as const;

const FOUR_MEME_TOKEN_MANAGER_ABI = [
    {
        anonymous: false,
        inputs: [
            { indexed: false, internalType: 'address', name: 'creator', type: 'address' },
            { indexed: false, internalType: 'address', name: 'token', type: 'address' },
            { indexed: false, internalType: 'uint256', name: 'requestId', type: 'uint256' },
            { indexed: false, internalType: 'string', name: 'name', type: 'string' },
            { indexed: false, internalType: 'string', name: 'symbol', type: 'string' },
            { indexed: false, internalType: 'uint256', name: 'totalSupply', type: 'uint256' },
            { indexed: false, internalType: 'uint256', name: 'launchTime', type: 'uint256' },
            { indexed: false, internalType: 'uint256', name: 'launchFee', type: 'uint256' },
        ],
        name: 'TokenCreate',
        type: 'event',
    },
    {
        inputs: [
            { internalType: 'bytes', name: 'args', type: 'bytes' },
            { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        name: 'createToken',
        outputs: [],
        stateMutability: 'payable',
        type: 'function',
    },
] as const;

function assertFinitePositiveNumber(value: unknown, field: string): asserts value is number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`${field} must be a positive number`);
    }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`${field} is required`);
    }
}

function assertHttpishUrl(value: string, field: string) {
    const normalized = value.trim();
    if (!/^https?:\/\//i.test(normalized) && !/^ipfs:\/\//i.test(normalized)) {
        throw new Error(`${field} must be an https URL or ipfs URI`);
    }
}

function normalizeImageFetchUrl(rawUrl: string): string {
    const value = rawUrl.trim();
    if (value.startsWith('ipfs://')) {
        return `https://ipfs.io/ipfs/${value.slice('ipfs://'.length).replace(/^ipfs\//, '')}`;
    }
    return value;
}

function normalizeFourMemeDeployInput(input: DeployFourMemeTokenInput): DeployFourMemeTokenInput {
    assertNonEmptyString(input.name, 'name');
    assertNonEmptyString(input.symbol, 'symbol');
    assertNonEmptyString(input.image, 'image');
    assertHttpishUrl(input.image, 'image');
    assertFinitePositiveNumber(input.bnbAmount, 'bnbAmount');

    const chainId = Number(input.chainId || FOUR_MEME_CHAIN_ID);
    if (chainId !== FOUR_MEME_CHAIN_ID) {
        throw new Error(`Four.meme deploy is only supported on BNB Chain (chainId ${FOUR_MEME_CHAIN_ID})`);
    }

    const launchTimeFromNow = Number.isFinite(input.launchTimeFromNow as number)
        ? Math.max(0, Math.trunc(Number(input.launchTimeFromNow)))
        : 0;

    return {
        name: input.name.trim(),
        symbol: input.symbol.trim(),
        description: String(input.description || '').trim() || `${input.name.trim()} token on Four.meme`,
        image: input.image.trim(),
        chainId,
        bnbAmount: Number(input.bnbAmount),
        launchTimeFromNow,
        category: input.category || 'Meme',
        websiteUrl: String(input.websiteUrl || '').trim() || undefined,
        twitterUrl: String(input.twitterUrl || '').trim() || undefined,
        telegramUrl: String(input.telegramUrl || '').trim() || undefined,
    };
}

function stripUndefinedFields<T extends Record<string, any>>(value: T): T {
    return Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined),
    ) as T;
}

async function waitForFourMemeTokenAddress(txHash: string, timeoutMs = 12_000): Promise<string | undefined> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const receipt = await getTransactionReceipt(FOUR_MEME_CHAIN_ID, txHash).catch(() => null);
        const logs = Array.isArray(receipt?.logs) ? receipt.logs : [];
        if (logs.length > 0) {
            const parsed = parseEventLogs({
                abi: FOUR_MEME_TOKEN_MANAGER_ABI,
                logs: logs as any,
                eventName: 'TokenCreate',
                strict: false,
            });
            const match = parsed.find((entry: any) => {
                const logAddress = String(entry?.address || '').toLowerCase();
                return logAddress === FOUR_MEME_TOKEN_MANAGER.toLowerCase();
            });
            const tokenAddress = String(match?.args?.token || '').trim();
            if (tokenAddress && isAddress(tokenAddress)) {
                return tokenAddress;
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return undefined;
}

async function fetchJson(url: string, init: RequestInit = {}) {
    const response = await fetch(url, init);
    const text = await response.text();
    let json: any = null;
    if (text) {
        try {
            json = JSON.parse(text);
        } catch {
            json = { raw: text };
        }
    }
    if (!response.ok) {
        const message = typeof json?.message === 'string' && json.message.trim()
            ? json.message.trim()
            : typeof json?.msg === 'string' && json.msg.trim()
                ? json.msg.trim()
                : `Four.meme API request failed with ${response.status}`;
        throw new Error(message);
    }
    return json;
}

async function getFourMemeNonce(walletAddress: string): Promise<string> {
    const result = await fetchJson(`${FOUR_MEME_API_BASE_URL}/private/user/nonce/generate`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            accountAddress: walletAddress,
            verifyType: 'LOGIN',
            networkCode: 'BSC',
        }),
    });
    const nonce = String(result?.data || '').trim();
    if (!nonce) throw new Error('Four.meme nonce generation failed');
    return nonce;
}

async function getFourMemeAccessToken(params: {
    walletAddress: string;
    userId: string;
    nonce: string;
}): Promise<string> {
    const signature = await signMessage(params.userId, `You are sign in Meme ${params.nonce}`);
    const result = await fetchJson(`${FOUR_MEME_API_BASE_URL}/private/user/login/dex`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            region: 'WEB',
            langType: 'EN',
            loginIp: '',
            inviteCode: '',
            verifyInfo: {
                address: params.walletAddress,
                networkCode: 'BSC',
                signature,
                verifyType: 'LOGIN',
            },
            walletName: 'KiKo',
        }),
    });
    const accessToken = String(result?.data || '').trim();
    if (!accessToken) throw new Error('Four.meme login failed');
    return accessToken;
}

async function uploadFourMemeImage(accessToken: string, imageUrl: string): Promise<string> {
    const imageFetchUrl = normalizeImageFetchUrl(imageUrl);
    const imageResponse = await fetch(imageFetchUrl);
    if (!imageResponse.ok) {
        throw new Error(`Failed to fetch token image: ${imageResponse.status}`);
    }
    const imageBlob = await imageResponse.blob();
    const formData = new FormData();
    formData.append('file', imageBlob, 'token-image.png');

    const result = await fetchJson(`${FOUR_MEME_API_BASE_URL}/private/token/upload`, {
        method: 'POST',
        headers: {
            'meme-web-access': accessToken,
        },
        body: formData,
    });
    const uploaded = String(result?.data || '').trim();
    if (!uploaded) throw new Error('Four.meme image upload failed');
    return uploaded;
}

async function createFourMemeMetadata(params: {
    accessToken: string;
    input: DeployFourMemeTokenInput;
    uploadedImageUrl: string;
}) {
    const result = await fetchJson(`${FOUR_MEME_API_BASE_URL}/private/token/create`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'meme-web-access': params.accessToken,
        },
        body: JSON.stringify({
            name: params.input.name,
            shortName: params.input.symbol,
            desc: params.input.description,
            imgUrl: params.uploadedImageUrl,
            launchTime: Date.now() + Number(params.input.launchTimeFromNow || 0) * 1000,
            label: params.input.category,
            lpTradingFee: 0.0025,
            webUrl: params.input.websiteUrl || undefined,
            twitterUrl: params.input.twitterUrl || undefined,
            telegramUrl: params.input.telegramUrl || undefined,
            preSale: params.input.bnbAmount,
            totalSupply: 1000000000,
            raisedAmount: 24,
            saleRate: 0.8,
            reserveRate: 0,
            funGroup: false,
            clickFun: false,
            symbol: 'BNB',
            raisedToken: BSC_RAISED_TOKEN,
        }),
    });
    const createArg = result?.data?.createArg;
    const signature = result?.data?.signature;
    if (!createArg || !signature) {
        throw new Error('Four.meme did not return createArg/signature');
    }
    return {
        createArg,
        signature,
    };
}

export async function deployFourMemeToken(
    input: DeployFourMemeTokenInput,
    options: DeployFourMemeTokenOptions = {},
) {
    const normalized = normalizeFourMemeDeployInput(input);
    const payload = stripUndefinedFields({
        ...normalized,
        chainName: FOUR_MEME_CHAIN_NAME,
        tokenManagerAddress: FOUR_MEME_TOKEN_MANAGER,
    });

    if (!options.confirmDeploy) {
        return {
            success: true,
            dryRun: true,
            endpoint: `${FOUR_MEME_API_BASE_URL}/private/token/create`,
            payload,
            warning: 'No request was sent. Pass confirmDeploy=true only after the user explicitly confirms the launch.',
        };
    }

    const userId = String(options.userId || '').trim();
    const accessToken = String(options.accessToken || '').trim();
    if (!userId) {
        throw new AppError(401, 'User authentication required for Four.meme deploy', 'AUTH_REQUIRED');
    }
    if (!accessToken) {
        throw new AppError(401, 'Privy access token required for Four.meme deploy', 'ACCESS_TOKEN_REQUIRED');
    }

    const walletInfo = await getEmbeddedWalletInfo(userId, { chainType: 'ethereum' });
    const walletAddress = String(walletInfo?.address || '').trim();
    if (!walletInfo || !walletAddress || !isAddress(walletAddress)) {
        throw new AppError(400, 'User has no BSC-compatible embedded wallet', 'NO_EVM_WALLET');
    }

    const nonce = await getFourMemeNonce(walletAddress);
    const memeAccessToken = await getFourMemeAccessToken({
        walletAddress,
        userId,
        nonce,
    });
    const uploadedImageUrl = await uploadFourMemeImage(memeAccessToken, normalized.image);
    const { createArg, signature } = await createFourMemeMetadata({
        accessToken: memeAccessToken,
        input: normalized,
        uploadedImageUrl,
    });

    const data = encodeFunctionData({
        abi: FOUR_MEME_TOKEN_MANAGER_ABI,
        functionName: 'createToken',
        args: [createArg, signature],
    });

    const txHash = await sendTransaction(userId, accessToken, {
        to: FOUR_MEME_TOKEN_MANAGER,
        data,
        value: parseEther(normalized.bnbAmount.toString()).toString(),
        chainId: FOUR_MEME_CHAIN_ID,
        txPurpose: 'other',
    });
    const tokenAddress = await waitForFourMemeTokenAddress(txHash);

    return {
        success: true,
        dryRun: false,
        chainId: FOUR_MEME_CHAIN_ID,
        tokenManagerAddress: FOUR_MEME_TOKEN_MANAGER,
        tokenAddress,
        tokenUrl: buildFourMemeTokenUrl(tokenAddress),
        txHash,
        txUrl: buildTransactionExplorerUrl(FOUR_MEME_CHAIN_ID, txHash),
        explorerUrl: buildTransactionExplorerUrl(FOUR_MEME_CHAIN_ID, txHash),
        uploadedImageUrl,
    };
}
