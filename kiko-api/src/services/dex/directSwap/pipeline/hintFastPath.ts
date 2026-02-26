import type { DirectSwapHint } from '../../directSwapTypes.js';

export function isHintFastPathEligible(params: {
  hint?: DirectSwapHint;
  turboMode: boolean;
}): { eligible: boolean; reason?: string; hopCount: number } {
  if (!params.hint?.resolvedPoolHint) {
    return { eligible: false, reason: 'missing_resolved_hint', hopCount: 0 };
  }
  const hopCount = Math.max(
    Number(params.hint?.routeHopCount || 0),
    params.hint?.routeHops?.length || 0
  );
  if (!params.turboMode && hopCount > 1) {
    return { eligible: false, reason: 'multi_hop_in_non_turbo', hopCount };
  }
  if (params.hint?.canUseResolvedPoolFastPath === false) {
    return { eligible: false, reason: 'hint_disabled_fast_path', hopCount };
  }
  return { eligible: true, hopCount };
}
