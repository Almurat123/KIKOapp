import { ethers } from 'ethers';
import type { PlannerInput } from '../types.js';

const PSEUDO_NATIVE_ADDRESSES = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x0000000000000000000000000000000000000000'
]);

export function defaultDeadline(): number {
  return Math.floor(Date.now() / 1000) + 300;
}

export function toWordHex(value: bigint): string {
  return value.toString(16).padStart(64, '0');
}

export function toAddressWord(address: string): string {
  const normalized = String(address || '').toLowerCase().replace(/^0x/, '');
  return normalized.padStart(64, '0');
}

export function replaceWordAll(dataNoPrefix: string, fromWord: string, toWord: string): string {
  if (!fromWord || fromWord === toWord) return dataNoPrefix;
  let result = dataNoPrefix;
  while (result.includes(fromWord)) {
    result = result.replace(fromWord, toWord);
  }
  return result;
}

export function parseNativeInputAmountWei(input: PlannerInput): bigint | null {
  const tokenIn = String(input.tokenIn || '').toLowerCase();
  const isNativeLike = tokenIn === 'eth'
    || tokenIn === 'bnb'
    || tokenIn === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  if (!isNativeLike) return null;
  const amountRaw = String(input.amountIn || '').trim();
  if (!amountRaw) return null;
  try {
    if (/^0x[0-9a-f]+$/i.test(amountRaw)) {
      const asHex = BigInt(amountRaw);
      return asHex >= 0n ? asHex : null;
    }
    if (/^[0-9]+$/.test(amountRaw)) {
      // Large integer strings are typically already wei values from decoded tx inputs.
      if (amountRaw.length > 18) return BigInt(amountRaw);
      return ethers.parseUnits(amountRaw, 18);
    }
    if (/^[0-9]+(?:\.[0-9]+)?$/.test(amountRaw)) {
      return ethers.parseUnits(amountRaw, 18);
    }
    const numeric = Number(amountRaw);
    if (Number.isFinite(numeric) && numeric > 0) {
      const fixed = numeric.toFixed(18).replace(/\.?0+$/, '');
      return ethers.parseUnits(fixed || '0', 18);
    }
    return null;
  } catch {
    return null;
  }
}

export function parseSourceValueWei(value?: string): bigint {
  const raw = String(value || '0').trim();
  try {
    if (!raw) return 0n;
    if (raw.startsWith('0x') || raw.startsWith('0X')) return BigInt(raw);
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export function safeRewriteCalldata(params: {
  dataNoPrefix: string;
  selector: string;
  sourceWallet: string;
  followerWallet: string;
  sourceValueWei: bigint;
  desiredValueWei: bigint;
  tokenIn: string;
  tokenOut: string;
  rewriteHeadWord?: boolean;
}): { data: string; warnings: string[] } {
  const { selector, sourceWallet, followerWallet, sourceValueWei, desiredValueWei, tokenIn, tokenOut } = params;
  const rewriteHeadWord = params.rewriteHeadWord !== false;
  let data = params.dataNoPrefix;
  const warnings: string[] = [];
  const selectorNoPrefix = selector.slice(2);

  const isAddressWordCandidate = (value: string): boolean => /^0x[0-9a-f]{40}$/i.test(value);
  const shouldGuardTokenWord = (value: string): boolean => {
    const normalized = String(value || '').toLowerCase();
    if (!isAddressWordCandidate(normalized)) return false;
    return !PSEUDO_NATIVE_ADDRESSES.has(normalized);
  };

  const protectedWords = new Set<string>();
  const tokenInWord = shouldGuardTokenWord(tokenIn) ? toAddressWord(tokenIn) : null;
  const tokenOutWord = shouldGuardTokenWord(tokenOut) ? toAddressWord(tokenOut) : null;
  const hadTokenInWordBefore = tokenInWord ? data.includes(tokenInWord) : false;
  const hadTokenOutWordBefore = tokenOutWord ? data.includes(tokenOutWord) : false;
  if (tokenInWord && hadTokenInWordBefore) protectedWords.add(tokenInWord);
  if (tokenOutWord && hadTokenOutWordBefore) protectedWords.add(tokenOutWord);

  const sourceWalletWord = toAddressWord(sourceWallet);
  const followerWalletWord = toAddressWord(followerWallet);
  const sourceValueWord = sourceValueWei > 0n ? toWordHex(sourceValueWei) : null;
  const desiredValueWord = toWordHex(desiredValueWei);

  if (protectedWords.has(sourceWalletWord)) {
    warnings.push('collision:source_wallet_matches_token');
  } else if (/^0x[0-9a-f]{40}$/.test(sourceWallet) && /^0x[0-9a-f]{40}$/.test(followerWallet)) {
    data = replaceWordAll(data, sourceWalletWord, followerWalletWord);
  }

  if (sourceValueWei > 0n && sourceValueWord) {
    if (protectedWords.has(sourceValueWord)) {
      warnings.push('collision:source_value_matches_token');
    } else if (sourceWalletWord === sourceValueWord) {
      warnings.push('collision:wallet_equals_value');
    } else {
      data = replaceWordAll(data, sourceValueWord, desiredValueWord);
    }
  }

  if (rewriteHeadWord && data.startsWith(selectorNoPrefix) && data.length >= selectorNoPrefix.length + 64) {
    const head = data.slice(0, selectorNoPrefix.length);
    const rest = data.slice(selectorNoPrefix.length + 64);
    data = `${head}${desiredValueWord}${rest}`;
  }

  if (tokenInWord && hadTokenInWordBefore && !data.includes(tokenInWord)) {
    warnings.push('validation:tokenIn_missing_after_rewrite');
  }
  if (tokenOutWord && hadTokenOutWordBefore && !data.includes(tokenOutWord)) {
    warnings.push('validation:tokenOut_missing_after_rewrite');
  }
  return { data, warnings };
}

export function decodeUniversalRouterExecute(sourceTxInput: string, selector?: string): { commands: string; inputs: string[] } | null {
  const input = String(sourceTxInput || '');
  if (!input.startsWith('0x') || input.length < 10) return null;
  const callSelector = String(selector || input.slice(0, 10)).toLowerCase();
  if (callSelector !== '0x3593564c' && callSelector !== '0x24856bc3') return null;
  const iface = new ethers.Interface([
    'function execute(bytes commands, bytes[] inputs)',
    'function execute(bytes commands, bytes[] inputs, uint256 deadline)'
  ]);
  try {
    const decoded = iface.decodeFunctionData('execute(bytes,bytes[])', input);
    return {
      commands: String(decoded[0] || '0x'),
      inputs: Array.isArray(decoded[1]) ? decoded[1].map((x: unknown) => String(x)) : []
    };
  } catch {
    try {
      const decoded = iface.decodeFunctionData('execute(bytes,bytes[],uint256)', input);
      return {
        commands: String(decoded[0] || '0x'),
        inputs: Array.isArray(decoded[1]) ? decoded[1].map((x: unknown) => String(x)) : []
      };
    } catch {
      return null;
    }
  }
}

function commandBytes(commands: string): number[] {
  const hex = String(commands || '').toLowerCase();
  if (!hex.startsWith('0x')) return [];
  const raw = hex.slice(2);
  if (raw.length % 2 !== 0) return [];
  const out: number[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    const byte = Number.parseInt(raw.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return [];
    out.push(byte);
  }
  return out;
}

function summarizeReplayTopology(commands: string, inputs: string[]): string {
  const abi = ethers.AbiCoder.defaultAbiCoder();
  const cmdBytes = commandBytes(commands);
  let v4Cmds = 0;
  let v4Actions = 0;
  const hopCounts: number[] = [];
  let hookCount = 0;

  for (let i = 0; i < cmdBytes.length && i < inputs.length; i++) {
    const cmd = cmdBytes[i] & 0x7f;
    if (cmd !== 0x10) continue;
    v4Cmds += 1;
    try {
      const decoded = abi.decode(['bytes', 'bytes[]'], inputs[i]) as unknown as [string, string[]];
      const actions = decoded[0];
      const actionParams = decoded[1] || [];
      const actionRaw = actions.startsWith('0x') ? actions.slice(2) : '';
      v4Actions += Math.floor(actionRaw.length / 2);
      for (let j = 0; j < actionRaw.length; j += 2) {
        const action = Number.parseInt(actionRaw.slice(j, j + 2), 16);
        const param = actionParams[Math.floor(j / 2)];
        if (!param) continue;
        if (action === 0x07) {
          try {
            const [swap] = abi.decode(
              ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint128,uint128)'],
              param
            ) as unknown as [any];
            const path = Array.isArray(swap?.[1]) ? swap[1] : [];
            hopCounts.push(path.length);
            hookCount += path.filter((p: any) => String(p?.[3] || '').toLowerCase() !== ethers.ZeroAddress).length;
            continue;
          } catch { }
          try {
            const [swap] = abi.decode(
              ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint256[],uint128,uint128)'],
              param
            ) as unknown as [any];
            const path = Array.isArray(swap?.[1]) ? swap[1] : [];
            hopCounts.push(path.length);
            hookCount += path.filter((p: any) => String(p?.[3] || '').toLowerCase() !== ethers.ZeroAddress).length;
            continue;
          } catch { }
        } else if (action === 0x06) {
          try {
            const [swapSingle] = abi.decode(
              ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
              param
            ) as unknown as [any];
            hopCounts.push(1);
            const hook = String(swapSingle?.[0]?.[4] || '').toLowerCase();
            if (hook && hook !== ethers.ZeroAddress) hookCount += 1;
          } catch { }
        }
      }
    } catch {
      continue;
    }
  }

  return `v4:${v4Cmds}|actions:${v4Actions}|hops:${hopCounts.join(',')}|hooks:${hookCount}`;
}

export function rewriteUniversalRouterReplay(params: {
  commands: string;
  inputs: string[];
  desiredValueWei: bigint | null;
  receiver: string;
}): { inputs: string[]; rewritten: boolean; warnings: string[] } {
  const { commands, inputs, desiredValueWei, receiver } = params;
  if (!desiredValueWei || desiredValueWei <= 0n) {
    return { inputs, rewritten: false, warnings: ['skip:desired_value_missing'] };
  }

  const cmdBytes = commandBytes(commands);
  if (!cmdBytes.length || inputs.length < cmdBytes.length) {
    return { inputs, rewritten: false, warnings: ['skip:invalid_commands'] };
  }

  const abi = ethers.AbiCoder.defaultAbiCoder();
  const beforeTopo = summarizeReplayTopology(commands, inputs);
  const rewrittenInputs = [...inputs];
  const warnings: string[] = [];
  let rewritten = false;

  for (let i = 0; i < cmdBytes.length && i < rewrittenInputs.length; i++) {
    const cmd = cmdBytes[i] & 0x7f;
    const input = rewrittenInputs[i];
    if (!/^0x[0-9a-fA-F]*$/.test(input)) continue;

    if (cmd === 0x10) {
      let actions: string;
      let actionParams: string[];
      try {
        const decoded = abi.decode(['bytes', 'bytes[]'], input) as unknown as [string, string[]];
        actions = decoded[0];
        actionParams = [...decoded[1]];
      } catch {
        warnings.push('v4_swap_decode_failed');
        continue;
      }

      const actionsRaw = actions.slice(2);
      const actionBytes: number[] = [];
      for (let a = 0; a < actionsRaw.length; a += 2) {
        actionBytes.push(Number.parseInt(actionsRaw.slice(a, a + 2), 16));
      }
      if (!actionBytes.length || actionParams.length < actionBytes.length) {
        warnings.push('v4_swap_actions_invalid');
        continue;
      }

      for (let j = 0; j < actionBytes.length && j < actionParams.length; j++) {
        const action = actionBytes[j];
        const p = actionParams[j];
        if (action === 0x07) {
          try {
            const [swap] = abi.decode(
              ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint128,uint128)'],
              p
            ) as unknown as [any];
            actionParams[j] = abi.encode(
              ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint128,uint128)'],
              [[swap[0], swap[1], desiredValueWei, 0n]]
            );
            rewritten = true;
            continue;
          } catch { }
          try {
            const [swap] = abi.decode(
              ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint256[],uint128,uint128)'],
              p
            ) as unknown as [any];
            actionParams[j] = abi.encode(
              ['tuple(address,tuple(address,uint24,int24,address,bytes)[],uint256[],uint128,uint128)'],
              [[swap[0], swap[1], swap[2], desiredValueWei, 0n]]
            );
            rewritten = true;
            continue;
          } catch {
            warnings.push('swap_exact_in_decode_failed');
          }
        } else if (action === 0x06) {
          try {
            const [swapSingle] = abi.decode(
              ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
              p
            ) as unknown as [any];
            actionParams[j] = abi.encode(
              ['tuple(tuple(address,address,uint24,int24,address),bool,uint128,uint128,bytes)'],
              [[swapSingle[0], swapSingle[1], desiredValueWei, 0n, swapSingle[4]]]
            );
            rewritten = true;
            continue;
          } catch {
            warnings.push('swap_exact_in_single_decode_failed');
          }
        } else if (action === 0x0c) {
          try {
            const [currency] = abi.decode(['address', 'uint256'], p) as unknown as [string, bigint];
            actionParams[j] = abi.encode(['address', 'uint256'], [currency, desiredValueWei]);
            rewritten = true;
            continue;
          } catch {
            warnings.push('settle_all_decode_failed');
          }
        } else if (action === 0x0f) {
          try {
            const [currency] = abi.decode(['address', 'uint256'], p) as unknown as [string, bigint];
            actionParams[j] = abi.encode(['address', 'uint256'], [currency, 0n]);
            rewritten = true;
            continue;
          } catch {
            warnings.push('take_all_decode_failed');
          }
        }
      }

      rewrittenInputs[i] = abi.encode(['bytes', 'bytes[]'], [actions, actionParams]);
      continue;
    }

    if (cmd === 0x04) {
      try {
        const [token] = abi.decode(['address', 'address', 'uint256'], input) as unknown as [string, string, bigint];
        rewrittenInputs[i] = abi.encode(['address', 'address', 'uint256'], [token, receiver, 0n]);
        rewritten = true;
      } catch {
        warnings.push('sweep_decode_failed');
      }
    }
  }

  const afterTopo = summarizeReplayTopology(commands, rewrittenInputs);
  if (beforeTopo !== afterTopo) warnings.push('validation:topology_changed');
  return { inputs: rewrittenInputs, rewritten, warnings };
}
