import crypto from 'crypto';
import { ethers } from 'ethers';
import { AppError } from '../middleware/errorHandler.js';
import { normalizeAddress } from '../utils/address.js';
import {
  parseExecutionModeStrict,
  type CopyTradeExecutionMode
} from './copyTradeExecutionMode.js';

export const COPYTRADE_SIGNATURE_SCHEME = 'eip712_v1';
export const COPYTRADE_INTENT_VERSION = 'copytrade_config_intent_v1';
export const COPYTRADE_INTENT_VERSION_V2 = 'copytrade_config_intent_v2';

const DOMAIN = {
  name: 'KiKo CopyTrade Config',
  version: '1',
  chainId: 1,
};

const TYPES = {
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
  CopyTradeConfigIntentV2: [
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
    { name: 'maxEntryDeviationBps', type: 'string' },
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

const CANONICAL_KEYS = [
  'version',
  'action',
  'configId',
  'userId',
  'signerAddress',
  'nonce',
  'expiresAtMs',
  'chainId',
  'targetWallet',
  'buyAmountUsd',
  'maxSlippageBps',
  'minMarketCapUsd',
  'minLiquidityUsd',
  'minTargetValueUsd',
  'copyTradeTokenCooldownMinutes',
  'executionMode',
  'disableTokenInfo',
  'takeProfitPct',
  'stopLossPct',
  'mirrorSell',
  'aiAnalysisMode',
  'enableDynamicTP',
  'dynamicTPMinProfitPct',
] as const;

const CANONICAL_KEYS_V2 = [
  'version',
  'action',
  'configId',
  'userId',
  'signerAddress',
  'nonce',
  'expiresAtMs',
  'chainId',
  'targetWallet',
  'buyAmountUsd',
  'maxSlippageBps',
  'maxEntryDeviationBps',
  'minMarketCapUsd',
  'minLiquidityUsd',
  'minTargetValueUsd',
  'copyTradeTokenCooldownMinutes',
  'executionMode',
  'disableTokenInfo',
  'takeProfitPct',
  'stopLossPct',
  'mirrorSell',
  'aiAnalysisMode',
  'enableDynamicTP',
  'dynamicTPMinProfitPct',
] as const;

type Action = 'create' | 'update' | 'delete';

export interface CopyTradeSignedPayload {
  version: string;
  action: Action;
  configId: string;
  userId: string;
  signerAddress: string;
  nonce: number;
  expiresAtMs: number;
  chainId: number;
  targetWallet: string;
  buyAmountUsd: string;
  maxSlippageBps: string;
  maxEntryDeviationBps?: string;
  minMarketCapUsd: string;
  minLiquidityUsd: string;
  minTargetValueUsd: string;
  copyTradeTokenCooldownMinutes: string;
  executionMode: CopyTradeExecutionMode;
  disableTokenInfo: boolean;
  takeProfitPct: string;
  stopLossPct: string;
  mirrorSell: boolean;
  aiAnalysisMode: string;
  enableDynamicTP: boolean;
  dynamicTPMinProfitPct: string;
}

function strNum(value: unknown, fallback = '0'): string {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return String(n);
}

function boolVal(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function parsePayload(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new AppError(400, 'signedPayload must be a JSON object', 'SIGNATURE_REQUIRED');
    }
    return parsed as Record<string, unknown>;
  }
  if (!raw || typeof raw !== 'object') {
    throw new AppError(400, 'signedPayload must be a JSON object', 'SIGNATURE_REQUIRED');
  }
  return raw as Record<string, unknown>;
}

export function normalizeSignedPayload(raw: unknown, opts?: { enforceNotExpired?: boolean }): CopyTradeSignedPayload {
  const payload = parsePayload(raw);
  const version = String(payload.version || COPYTRADE_INTENT_VERSION).trim();
  const nonce = Number(payload.nonce);
  const expiresAtMs = Number(payload.expiresAtMs ?? payload.expiresAt);
  const chainId = Number(payload.chainId);
  const enforceNotExpired = opts?.enforceNotExpired !== false;

  if (!Number.isInteger(nonce) || nonce <= 0) {
    throw new AppError(400, 'nonce must be a positive integer', 'SIGNATURE_INVALID');
  }
  if (!Number.isInteger(expiresAtMs)) {
    throw new AppError(400, 'signed payload is expired', 'CONFIG_EXPIRED');
  }
  if (enforceNotExpired && expiresAtMs <= Date.now()) {
    throw new AppError(400, 'signed payload is expired', 'CONFIG_EXPIRED');
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new AppError(400, 'chainId must be a positive integer', 'SIGNATURE_INVALID');
  }

  const action = String(payload.action || '').trim().toLowerCase() as Action;
  if (action !== 'create' && action !== 'update' && action !== 'delete') {
    throw new AppError(400, 'action must be create, update or delete', 'SIGNATURE_INVALID');
  }
  if (version !== COPYTRADE_INTENT_VERSION && version !== COPYTRADE_INTENT_VERSION_V2) {
    throw new AppError(400, 'unsupported signature payload version', 'SIGNATURE_INVALID');
  }

  const targetWallet = String(payload.targetWallet || '').trim();
  const signerAddress = normalizeAddress(String(payload.signerAddress || '').trim());
  const userId = String(payload.userId || '').trim();

  if (!targetWallet || !userId || !signerAddress) {
    throw new AppError(400, 'signedPayload missing required identity fields', 'SIGNATURE_REQUIRED');
  }
  const executionMode = parseExecutionModeStrict(payload.executionMode ?? 'normal');
  if (!executionMode) {
    throw new AppError(400, 'executionMode must be one of: safe, normal, turbo', 'SIGNATURE_INVALID');
  }

  return {
    version,
    action,
    configId: String(payload.configId || ''),
    userId,
    signerAddress,
    nonce,
    expiresAtMs,
    chainId,
    targetWallet,
    buyAmountUsd: strNum(payload.buyAmountUsd),
    maxSlippageBps: strNum(payload.maxSlippageBps, '300'),
    maxEntryDeviationBps: version === COPYTRADE_INTENT_VERSION_V2
      ? strNum(payload.maxEntryDeviationBps, '1500')
      : undefined,
    minMarketCapUsd: strNum(payload.minMarketCapUsd),
    minLiquidityUsd: strNum(payload.minLiquidityUsd),
    minTargetValueUsd: strNum(payload.minTargetValueUsd),
    copyTradeTokenCooldownMinutes: strNum(payload.copyTradeTokenCooldownMinutes),
    executionMode,
    disableTokenInfo: boolVal(payload.disableTokenInfo, false),
    takeProfitPct: strNum(payload.takeProfitPct),
    stopLossPct: strNum(payload.stopLossPct),
    mirrorSell: boolVal(payload.mirrorSell, true),
    aiAnalysisMode: String(payload.aiAnalysisMode || 'disabled').trim().toLowerCase(),
    enableDynamicTP: boolVal(payload.enableDynamicTP, false),
    dynamicTPMinProfitPct: strNum(payload.dynamicTPMinProfitPct, '100'),
  };
}

function canonicalPayload(payload: CopyTradeSignedPayload): string {
  const canonical: Record<string, unknown> = {};
  const keys = payload.version === COPYTRADE_INTENT_VERSION_V2
    ? CANONICAL_KEYS_V2
    : CANONICAL_KEYS;
  for (const key of keys) {
    canonical[key] = payload[key];
  }
  return JSON.stringify(canonical);
}

export function computeCopyTradeConfigHash(payload: CopyTradeSignedPayload): string {
  return crypto.createHash('sha256').update(canonicalPayload(payload), 'utf8').digest('hex');
}

function typedDataMessage(payload: CopyTradeSignedPayload) {
  return {
    ...payload,
    signerAddress: ethers.getAddress(payload.signerAddress),
  };
}

function getTypedDataTypes(payload: CopyTradeSignedPayload) {
  const typed: Record<string, typeof TYPES.CopyTradeConfigIntentV1> = {};
  if (payload.version === COPYTRADE_INTENT_VERSION_V2) {
    typed.CopyTradeConfigIntentV2 = TYPES.CopyTradeConfigIntentV2;
    return typed;
  }
  typed.CopyTradeConfigIntentV1 = TYPES.CopyTradeConfigIntentV1;
  return typed;
}

export function verifyCopyTradeConfigSignature(args: {
  signedPayload: unknown;
  signature: string;
  signerAddress: string;
  userId: string;
  expectedAction: Action;
  expectedConfigId?: string;
  currentNonce: number;
  userWalletAddress: string;
}) {
  const normalized = normalizeSignedPayload(args.signedPayload);
  const signature = String(args.signature || '').trim();
  const signerAddress = normalizeAddress(String(args.signerAddress || '').trim());
  const userWalletAddress = normalizeAddress(String(args.userWalletAddress || '').trim());

  if (!signature || !signature.startsWith('0x')) {
    throw new AppError(400, 'signature is required', 'SIGNATURE_REQUIRED');
  }
  if (!userWalletAddress || !userWalletAddress.startsWith('0x')) {
    throw new AppError(400, 'user does not have a valid EVM wallet for signature verification', 'SIGNATURE_INVALID');
  }
  if (normalized.version !== COPYTRADE_INTENT_VERSION && normalized.version !== COPYTRADE_INTENT_VERSION_V2) {
    throw new AppError(400, 'unsupported signature payload version', 'SIGNATURE_INVALID');
  }
  if (normalized.userId !== args.userId) {
    throw new AppError(403, 'signed payload userId mismatch', 'SIGNATURE_INVALID');
  }
  if (normalized.action !== args.expectedAction) {
    throw new AppError(403, 'signed payload action mismatch', 'SIGNATURE_INVALID');
  }
  if (args.expectedConfigId && normalized.configId !== args.expectedConfigId) {
    throw new AppError(403, 'signed payload configId mismatch', 'SIGNATURE_INVALID');
  }
  if (normalized.nonce !== args.currentNonce + 1) {
    throw new AppError(409, 'stale or invalid nonce', 'CONFIG_STALE_NONCE');
  }
  if (normalized.signerAddress !== signerAddress) {
    throw new AppError(403, 'signerAddress mismatch', 'SIGNATURE_INVALID');
  }
  if (signerAddress !== userWalletAddress) {
    throw new AppError(403, 'signerAddress does not match user wallet', 'SIGNATURE_INVALID');
  }

  let recoveredAddress = '';
  try {
    recoveredAddress = normalizeAddress(
      ethers.verifyTypedData(DOMAIN, getTypedDataTypes(normalized), typedDataMessage(normalized), signature)
    );
  } catch {
    throw new AppError(403, 'signature verification failed', 'SIGNATURE_INVALID');
  }
  if (recoveredAddress !== signerAddress) {
    throw new AppError(403, 'signature signer mismatch', 'SIGNATURE_INVALID');
  }

  return {
    payload: normalized,
    configHash: computeCopyTradeConfigHash(normalized),
  };
}

export function assertConfigExecutable(config: any, userWalletAddress: string): { ok: boolean; reason?: string } {
  if (String(config?.signatureScheme || '') === 'legacy_unsigned') {
    if (config?.requiresResign) return { ok: false, reason: 'requires_resign' };
    return { ok: true };
  }

  if (config?.requiresResign) return { ok: false, reason: 'requires_resign' };
  if (!config?.configPayload || !config?.configHash || !config?.configSignature || !config?.signerAddress) {
    return { ok: false, reason: 'missing_signature_fields' };
  }
  if (String(config.signatureScheme || COPYTRADE_SIGNATURE_SCHEME) !== COPYTRADE_SIGNATURE_SCHEME) {
    return { ok: false, reason: 'unsupported_signature_scheme' };
  }
  if (!userWalletAddress || !String(userWalletAddress).startsWith('0x')) {
    return { ok: false, reason: 'missing_user_wallet' };
  }

  const payload = normalizeSignedPayload(config.configPayload, { enforceNotExpired: false });
  if (payload.userId !== config.userId) return { ok: false, reason: 'payload_user_mismatch' };
  if (normalizeAddress(payload.signerAddress) !== normalizeAddress(config.signerAddress)) {
    return { ok: false, reason: 'payload_signer_mismatch' };
  }
  if (normalizeAddress(config.signerAddress) !== normalizeAddress(userWalletAddress)) {
    return { ok: false, reason: 'signer_not_user_wallet' };
  }

  const recomputedHash = computeCopyTradeConfigHash(payload);
  if (recomputedHash !== config.configHash) return { ok: false, reason: 'config_hash_mismatch' };

  // Detect direct DB tampering of executable parameters.
  if (String(config.targetWallet) !== String(payload.targetWallet)) return { ok: false, reason: 'target_wallet_mismatch' };
  if (Number(config.chainId) !== Number(payload.chainId)) return { ok: false, reason: 'chain_mismatch' };
  if (Number(config.buyAmountUsd) !== Number(payload.buyAmountUsd)) return { ok: false, reason: 'buy_amount_mismatch' };
  if (Number(config.maxSlippageBps) !== Number(payload.maxSlippageBps)) return { ok: false, reason: 'slippage_mismatch' };

  try {
    const recovered = normalizeAddress(
      ethers.verifyTypedData(DOMAIN, getTypedDataTypes(payload), typedDataMessage(payload), config.configSignature)
    );
    if (recovered !== normalizeAddress(config.signerAddress)) {
      return { ok: false, reason: 'signature_recover_mismatch' };
    }
  } catch {
    return { ok: false, reason: 'signature_verify_failed' };
  }

  return { ok: true };
}
