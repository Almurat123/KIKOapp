import type { ExecutionPlanV1, PlannerInput, ReplayPrecheckResult } from '../types.js';
import type { SourceReplayAdapter } from './types.js';
import { aero24856bc3Adapter, getAeroReplaySpender } from './aero24856bc3.js';
import { customcae6a6b3Adapter, getCustomReplaySpender } from './customcae6a6b3.js';
import {
  raw0490a7f3Adapter,
  raw04e45aafAdapter,
  getGenericRawReplaySpender,
  raw0f27c5c1Adapter,
  raw791ac947Adapter,
  raw2213bc0bAdapter,
  rawb6f9de95Adapter,
  raw784e2685Adapter,
  rawd1ee211dAdapter
} from './genericRawSelectors.js';
import { ur3593564cAdapter, getUrReplaySpender } from './ur3593564c.js';

const REPLAY_ADAPTERS: SourceReplayAdapter[] = [
  ur3593564cAdapter,
  aero24856bc3Adapter,
  customcae6a6b3Adapter,
  raw0f27c5c1Adapter,
  rawd1ee211dAdapter,
  raw2213bc0bAdapter,
  raw784e2685Adapter,
  rawb6f9de95Adapter,
  raw791ac947Adapter,
  raw04e45aafAdapter,
  raw0490a7f3Adapter
];

export interface SourceReplayBuildResult {
  status: 'built' | 'not_supported' | 'rewrite_failed' | 'validation_failed';
  selector: string;
  adapterName?: string;
  adapterVersion?: string;
  warnings?: string[];
  reason?: string;
  plan?: ExecutionPlanV1;
}

function normalizeSelector(input?: string, selectorHint?: string): string {
  const hinted = String(selectorHint || '').toLowerCase();
  if (/^0x[0-9a-f]{8}$/.test(hinted)) return hinted;
  const fromInput = String(input || '').slice(0, 10).toLowerCase();
  return /^0x[0-9a-f]{8}$/.test(fromInput) ? fromInput : '';
}

export function listReplayAdapters(): readonly SourceReplayAdapter[] {
  return REPLAY_ADAPTERS;
}

export function findReplayAdapter(selector: string): SourceReplayAdapter | null {
  for (const adapter of REPLAY_ADAPTERS) {
    if (adapter.supports(selector)) return adapter;
  }
  return null;
}

export function buildSourceReplayPlanFromInput(input: PlannerInput): SourceReplayBuildResult {
  const selector = normalizeSelector(input.sourceTxInput, input.sourceSelector);
  if (!selector) {
    return {
      status: 'not_supported',
      selector: '',
      reason: 'missing_or_invalid_selector'
    };
  }

  const adapter = findReplayAdapter(selector);
  if (!adapter) {
    return {
      status: 'not_supported',
      selector,
      reason: 'selector_not_supported'
    };
  }

  const rewritten = adapter.rewrite(input);
  if (!rewritten) {
    return {
      status: 'rewrite_failed',
      selector,
      adapterName: adapter.name,
      adapterVersion: adapter.version,
      reason: 'rewrite_returned_null'
    };
  }

  const validation = adapter.validate(rewritten, input);
  if (!validation.ok) {
    return {
      status: 'validation_failed',
      selector,
      adapterName: adapter.name,
      adapterVersion: adapter.version,
      warnings: rewritten.warnings,
      reason: validation.reason || 'adapter_validation_failed'
    };
  }

  return {
    status: 'built',
    selector,
    adapterName: rewritten.adapterName,
    adapterVersion: rewritten.adapterVersion,
    warnings: rewritten.warnings,
    plan: rewritten.plan
  };
}

function parseSourceSelectorFromPlan(plan: ExecutionPlanV1): string {
  const selectorFromCalldata = String(plan.execData?.sourceCalldata || '').slice(0, 10).toLowerCase();
  if (/^0x[0-9a-f]{8}$/.test(selectorFromCalldata)) return selectorFromCalldata;
  if (String(plan.trace?.adapterName || '').toLowerCase() === 'ur3593564c') return '0x3593564c';
  if (String(plan.trace?.adapterName || '').toLowerCase() === 'aero24856bc3') return '0x24856bc3';
  if (String(plan.trace?.adapterName || '').toLowerCase() === 'customcae6a6b3') return '0xcae6a6b3';
  return '';
}

export function resolveReplaySpender(plan: ExecutionPlanV1): ReplayPrecheckResult['spender'] {
  const selector = parseSourceSelectorFromPlan(plan);
  const router = String(plan.templateRef?.router || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(router)) return undefined;

  if (selector === '0x3593564c') return getUrReplaySpender();
  if (selector === '0x24856bc3') return getAeroReplaySpender(router);
  if (selector === '0xcae6a6b3') return getCustomReplaySpender(router);
  if (selector === '0x0f27c5c1') return getGenericRawReplaySpender(router);
  if (selector === '0xd1ee211d') return getGenericRawReplaySpender(router);
  if (selector === '0x2213bc0b') return getGenericRawReplaySpender(router);
  if (selector === '0x784e2685') return getGenericRawReplaySpender(router);
  if (selector === '0xb6f9de95') return getGenericRawReplaySpender(router);
  if (selector === '0x791ac947') return getGenericRawReplaySpender(router);
  if (selector === '0x04e45aaf') return getGenericRawReplaySpender(router);
  if (selector === '0x0490a7f3') return getGenericRawReplaySpender(router);

  return router.toLowerCase();
}
