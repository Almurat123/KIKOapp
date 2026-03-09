import { ethers } from 'ethers';

import { getNativeAliasSetForChain } from '../evmCanonicalAsset.js';
import { resolveV4HookProfile, type V4HookFamily } from './v4Hooks.js';

export type V4HookCapabilityStatus =
  | 'supported_safe'
  | 'supported_with_adapter'
  | 'probe_only'
  | 'unsupported';

export interface V4HookCapabilityProfile {
  chainId: number;
  hookAddress: string;
  hookFamily: V4HookFamily;
  codeHash: string | null;
  supportsEmptyHookData: boolean;
  supportsPathSwap: boolean;
  supportsSweepOut: boolean;
  requiresCustomHookData: boolean;
  customAccountingRisk: boolean;
  nativeAliasSet: string[];
  routerCompatibility: 'uniswap_v4' | 'adapter_only' | 'unknown';
  status: V4HookCapabilityStatus;
  reasonCode: string;
  resolvedAtMs: number;
}

export interface V4HookProbeResult {
  profile: V4HookCapabilityProfile;
  probeReasonCode:
    | 'PROBE_SUCCESS_EMPTY_HOOKDATA'
    | 'PROBE_REVERT'
    | 'PROBE_TRANSIENT_FAILURE'
    | 'PROBE_NO_CODE';
  supportsEmptyHookData: boolean;
}

interface ResolveCapabilityParams {
  chainId: number;
  hookAddress?: string;
  callRpc?: <T = any>(chainId: number, method: string, params: any[], options?: any) => Promise<T>;
  allowProbe?: boolean;
}

interface ProbeCapabilityParams {
  chainId: number;
  hookAddress?: string;
  callRpc: <T = any>(chainId: number, method: string, params: any[], options?: any) => Promise<T>;
  tx: { from?: string; to?: string; data?: string; value?: string };
}

const ZERO_HOOK = '0x0000000000000000000000000000000000000000';
const PROFILE_CACHE_TTL_MS = 5 * 60_000;
const capabilityCache = new Map<string, V4HookCapabilityProfile>();

function normalizeHookAddress(hookAddress?: string): string {
  const value = String(hookAddress || '').trim().toLowerCase();
  if (!value || value === '0x') return ZERO_HOOK;
  return value;
}

function buildCacheKey(chainId: number, hookAddress: string, codeHash?: string | null): string {
  return `${chainId}:${hookAddress}:${String(codeHash || 'no-code').toLowerCase()}`;
}

function buildKnownProfile(params: {
  chainId: number;
  hookAddress: string;
  hookFamily: V4HookFamily;
  codeHash?: string | null;
}): V4HookCapabilityProfile {
  const { chainId, hookAddress, hookFamily } = params;
  const base = {
    chainId,
    hookAddress,
    hookFamily,
    codeHash: params.codeHash || null,
    nativeAliasSet: getNativeAliasSetForChain(chainId),
    resolvedAtMs: Date.now(),
  };

  if (hookFamily === 'none') {
    return {
      ...base,
      supportsEmptyHookData: true,
      supportsPathSwap: true,
      supportsSweepOut: false,
      requiresCustomHookData: false,
      customAccountingRisk: false,
      routerCompatibility: 'uniswap_v4',
      status: 'supported_safe',
      reasonCode: 'KNOWN_NO_HOOK',
    };
  }

  if (hookFamily === 'flaunch' || hookFamily === 'clanker') {
    return {
      ...base,
      supportsEmptyHookData: false,
      supportsPathSwap: hookFamily === 'flaunch',
      supportsSweepOut: hookFamily === 'flaunch',
      requiresCustomHookData: true,
      customAccountingRisk: false,
      routerCompatibility: 'adapter_only',
      status: 'supported_with_adapter',
      reasonCode: hookFamily === 'flaunch' ? 'KNOWN_FLAUNCH_ADAPTER' : 'KNOWN_CLANKER_ADAPTER',
    };
  }

  if (hookFamily === 'zora' || hookFamily === 'doppler' || hookFamily === 'custom') {
    return {
      ...base,
      supportsEmptyHookData: true,
      supportsPathSwap: false,
      supportsSweepOut: false,
      requiresCustomHookData: false,
      customAccountingRisk: hookFamily === 'doppler',
      routerCompatibility: 'uniswap_v4',
      status: 'supported_safe',
      reasonCode: `KNOWN_${hookFamily.toUpperCase()}_SAFE`,
    };
  }

  return {
    ...base,
    supportsEmptyHookData: false,
    supportsPathSwap: false,
    supportsSweepOut: false,
    requiresCustomHookData: false,
    customAccountingRisk: true,
    routerCompatibility: 'unknown',
    status: 'probe_only',
    reasonCode: 'UNKNOWN_HOOK_PROBE_REQUIRED',
  };
}

function summarizeProbeError(err: any): string {
  const reason = String(
    err?.reason || err?.shortMessage || err?.message || err?.code || 'unknown_probe_failure',
  ).toLowerCase();
  if (reason.includes('execution reverted') || reason.includes('revert')) return 'PROBE_REVERT';
  return 'PROBE_TRANSIENT_FAILURE';
}

export async function resolveV4HookCapabilityProfile(
  params: ResolveCapabilityParams,
): Promise<V4HookCapabilityProfile> {
  const hookAddress = normalizeHookAddress(params.hookAddress);
  const hookProfile = resolveV4HookProfile(params.chainId, hookAddress);

  let codeHash: string | null = null;
  if (params.callRpc && params.allowProbe !== false && hookAddress !== ZERO_HOOK) {
    try {
      const code = await params.callRpc<string>(params.chainId, 'eth_getCode', [hookAddress, 'latest'], {
        strategy: 'fast',
        importance: 'critical',
      });
      if (code && code !== '0x') {
        codeHash = ethers.keccak256(code as `0x${string}`);
      } else if (hookProfile.family === 'unknown') {
        const unsupported = {
          ...buildKnownProfile({
            chainId: params.chainId,
            hookAddress,
            hookFamily: 'unknown',
            codeHash: null,
          }),
          status: 'unsupported' as const,
          reasonCode: 'UNKNOWN_HOOK_NO_CODE',
        };
        capabilityCache.set(buildCacheKey(params.chainId, hookAddress, unsupported.codeHash), unsupported);
        return unsupported;
      }
    } catch {
      codeHash = null;
    }
  }

  const cacheKey = buildCacheKey(params.chainId, hookAddress, codeHash);
  const cached = capabilityCache.get(cacheKey);
  if (cached && Date.now() - cached.resolvedAtMs < PROFILE_CACHE_TTL_MS) {
    return cached;
  }

  const profile = buildKnownProfile({
    chainId: params.chainId,
    hookAddress,
    hookFamily: hookProfile.family,
    codeHash,
  });
  capabilityCache.set(cacheKey, profile);
  return profile;
}

export async function probeV4HookCapability(
  params: ProbeCapabilityParams,
): Promise<V4HookProbeResult> {
  const hookAddress = normalizeHookAddress(params.hookAddress);
  const resolved = await resolveV4HookCapabilityProfile({
    chainId: params.chainId,
    hookAddress,
    callRpc: params.callRpc,
    allowProbe: true,
  });

  if (resolved.status !== 'probe_only') {
    return {
      profile: resolved,
      probeReasonCode: resolved.codeHash ? 'PROBE_SUCCESS_EMPTY_HOOKDATA' : 'PROBE_NO_CODE',
      supportsEmptyHookData: resolved.supportsEmptyHookData,
    };
  }

  if (!resolved.codeHash) {
    const unsupported = { ...resolved, status: 'unsupported' as const, reasonCode: 'UNKNOWN_HOOK_NO_CODE' };
    capabilityCache.set(buildCacheKey(params.chainId, hookAddress, unsupported.codeHash), unsupported);
    return {
      profile: unsupported,
      probeReasonCode: 'PROBE_NO_CODE',
      supportsEmptyHookData: false,
    };
  }

  try {
    await params.callRpc<string>(params.chainId, 'eth_call', [{
      from: params.tx.from,
      to: params.tx.to,
      data: params.tx.data,
      value: params.tx.value || '0x0',
    }, 'latest'], {
      strategy: 'fast',
      importance: 'critical',
    });
    const safe = {
      ...resolved,
      supportsEmptyHookData: true,
      routerCompatibility: 'uniswap_v4' as const,
      status: 'supported_safe' as const,
      reasonCode: 'PROBED_SAFE_EMPTY_HOOKDATA',
      resolvedAtMs: Date.now(),
    };
    capabilityCache.set(buildCacheKey(params.chainId, hookAddress, safe.codeHash), safe);
    return {
      profile: safe,
      probeReasonCode: 'PROBE_SUCCESS_EMPTY_HOOKDATA',
      supportsEmptyHookData: true,
    };
  } catch (err: any) {
    const probeReasonCode = summarizeProbeError(err) as V4HookProbeResult['probeReasonCode'];
    const finalProfile = probeReasonCode === 'PROBE_REVERT'
      ? {
          ...resolved,
          status: 'unsupported' as const,
          reasonCode: 'UNKNOWN_HOOK_REVERTED_EMPTY_HOOKDATA',
          resolvedAtMs: Date.now(),
        }
      : {
          ...resolved,
          status: 'probe_only' as const,
          reasonCode: 'UNKNOWN_HOOK_TRANSIENT_PROBE_FAILURE',
          resolvedAtMs: Date.now(),
        };
    capabilityCache.set(buildCacheKey(params.chainId, hookAddress, finalProfile.codeHash), finalProfile);
    return {
      profile: finalProfile,
      probeReasonCode,
      supportsEmptyHookData: false,
    };
  }
}
