import type { CopyTradeConfig, CreateConfigParams } from './copyTradeApi';

export const COPYTRADE_INTENT_VERSION = 'copytrade_config_intent_v1';

export type CopyTradeIntentAction = 'create' | 'update';

export interface CopyTradeSignedPayload {
  version: string;
  action: CopyTradeIntentAction;
  configId: string;
  userId: string;
  signerAddress: string;
  nonce: number;
  expiresAtMs: number;
  chainId: number;
  targetWallet: string;
  buyAmountUsd: string;
  maxSlippageBps: string;
  minMarketCapUsd: string;
  minLiquidityUsd: string;
  minTargetValueUsd: string;
  copyTradeTokenCooldownMinutes: string;
  executionMode: string;
  disableTokenInfo: boolean;
  takeProfitPct: string;
  stopLossPct: string;
  mirrorSell: boolean;
  aiAnalysisMode: string;
  enableDynamicTP: boolean;
  dynamicTPMinProfitPct: string;
}

const typedDataDomain = {
  name: 'KiKo CopyTrade Config',
  version: '1',
  chainId: 1,
};

const typedDataTypes = {
  CopyTradeConfigIntentV1: [
    { name: 'version', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'configId', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'signerAddress', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAtMs', type: 'uint256' },
    { name: 'chainId', type: 'uint256' },
    { name: 'targetWallet', type: 'string' },
    { name: 'buyAmountUsd', type: 'string' },
    { name: 'maxSlippageBps', type: 'string' },
    { name: 'minMarketCapUsd', type: 'string' },
    { name: 'minLiquidityUsd', type: 'string' },
    { name: 'minTargetValueUsd', type: 'string' },
    { name: 'copyTradeTokenCooldownMinutes', type: 'string' },
    { name: 'executionMode', type: 'string' },
    { name: 'disableTokenInfo', type: 'bool' },
    { name: 'takeProfitPct', type: 'string' },
    { name: 'stopLossPct', type: 'string' },
    { name: 'mirrorSell', type: 'bool' },
    { name: 'aiAnalysisMode', type: 'string' },
    { name: 'enableDynamicTP', type: 'bool' },
    { name: 'dynamicTPMinProfitPct', type: 'string' },
  ],
};

function toNumericString(value: unknown, fallback = '0'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return String(num);
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function buildPayloadFromSource(source: Partial<CreateConfigParams | CopyTradeConfig>) {
  const requestedMode = String(source.executionMode || 'normal').toLowerCase();
  const executionMode =
    requestedMode === 'safe' || requestedMode === 'normal' || requestedMode === 'turbo'
      ? requestedMode
      : 'normal';
  return {
    chainId: Number(source.chainId || 8453),
    targetWallet: String(source.targetWallet || ''),
    buyAmountUsd: toNumericString(source.buyAmountUsd),
    maxSlippageBps: toNumericString(source.maxSlippageBps, '300'),
    minMarketCapUsd: toNumericString(source.minMarketCapUsd),
    minLiquidityUsd: toNumericString(source.minLiquidityUsd),
    minTargetValueUsd: toNumericString(source.minTargetValueUsd),
    copyTradeTokenCooldownMinutes: toNumericString(source.copyTradeTokenCooldownMinutes),
    executionMode,
    disableTokenInfo: toBoolean(source.disableTokenInfo, false),
    takeProfitPct: toNumericString(source.takeProfitPct),
    stopLossPct: toNumericString(source.stopLossPct),
    mirrorSell: toBoolean(source.mirrorSell, true),
    aiAnalysisMode: String(source.aiAnalysisMode || 'disabled').toLowerCase(),
    enableDynamicTP: toBoolean(source.enableDynamicTP, false),
    dynamicTPMinProfitPct: toNumericString(source.dynamicTPMinProfitPct, '100'),
  };
}

export function createCopyTradeSignedPayload(args: {
  action: CopyTradeIntentAction;
  userId: string;
  signerAddress: string;
  nonce: number;
  configId?: string;
  expiresInMs?: number;
  source: Partial<CreateConfigParams | CopyTradeConfig>;
}): CopyTradeSignedPayload {
  const expiresAtMs = Date.now() + (args.expiresInMs || 5 * 60 * 1000);
  const normalized = buildPayloadFromSource(args.source);

  return {
    version: COPYTRADE_INTENT_VERSION,
    action: args.action,
    configId: args.configId || '',
    userId: args.userId,
    signerAddress: args.signerAddress,
    nonce: args.nonce,
    expiresAtMs,
    chainId: normalized.chainId,
    targetWallet: normalized.targetWallet,
    buyAmountUsd: normalized.buyAmountUsd,
    maxSlippageBps: normalized.maxSlippageBps,
    minMarketCapUsd: normalized.minMarketCapUsd,
    minLiquidityUsd: normalized.minLiquidityUsd,
    minTargetValueUsd: normalized.minTargetValueUsd,
    copyTradeTokenCooldownMinutes: normalized.copyTradeTokenCooldownMinutes,
    executionMode: normalized.executionMode,
    disableTokenInfo: normalized.disableTokenInfo,
    takeProfitPct: normalized.takeProfitPct,
    stopLossPct: normalized.stopLossPct,
    mirrorSell: normalized.mirrorSell,
    aiAnalysisMode: normalized.aiAnalysisMode,
    enableDynamicTP: normalized.enableDynamicTP,
    dynamicTPMinProfitPct: normalized.dynamicTPMinProfitPct,
  };
}

async function signWithEip1193Provider(provider: any, signerAddress: string, payload: CopyTradeSignedPayload): Promise<string> {
  const typedData = {
    domain: typedDataDomain,
    types: {
      ...typedDataTypes,
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
    },
    primaryType: 'CopyTradeConfigIntentV1',
    message: payload,
  };

  return provider.request({
    method: 'eth_signTypedData_v4',
    params: [signerAddress, JSON.stringify(typedData)],
  });
}

export async function signCopyTradeConfigIntent(args: {
  wallet: any;
  signerAddress: string;
  payload: CopyTradeSignedPayload;
}): Promise<string> {
  const wallet = args.wallet;

  if (wallet?.signTypedData && typeof wallet.signTypedData === 'function') {
    return wallet.signTypedData({
      domain: typedDataDomain,
      types: typedDataTypes,
      primaryType: 'CopyTradeConfigIntentV1',
      message: args.payload,
    });
  }

  if (wallet?.getEthereumProvider && typeof wallet.getEthereumProvider === 'function') {
    const provider = await wallet.getEthereumProvider();
    if (provider?.request) {
      return signWithEip1193Provider(provider, args.signerAddress, args.payload);
    }
  }

  if (wallet?.provider?.request) {
    return signWithEip1193Provider(wallet.provider, args.signerAddress, args.payload);
  }

  throw new Error('SIGNATURE_REQUIRED: wallet does not support EIP-712 signing');
}
