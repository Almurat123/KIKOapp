import type { CopytradeExposureState } from '../positions/exposureState.js';

export type CopytradeEntryPolicyMode =
  | 'single_position_only'
  | 'allow_scale_in';

export type CopytradeEntryPolicyReasonCode =
  | 'ENTRY_POLICY_ALLOW_NO_EXPOSURE'
  | 'ENTRY_POLICY_ALLOW_SCALE_IN'
  | 'ENTRY_POLICY_BLOCK_ACTIVE_EXPOSURE';

export function evaluateCopytradeEntryPolicy(params: {
  exposureState: CopytradeExposureState;
  allowScaleIn?: boolean;
}): {
  allow: boolean;
  mode: CopytradeEntryPolicyMode;
  reasonCode: CopytradeEntryPolicyReasonCode;
} {
  const mode: CopytradeEntryPolicyMode = params.allowScaleIn ? 'allow_scale_in' : 'single_position_only';

  if (params.exposureState === 'none') {
    return {
      allow: true,
      mode,
      reasonCode: 'ENTRY_POLICY_ALLOW_NO_EXPOSURE',
    };
  }

  if (params.allowScaleIn) {
    return {
      allow: true,
      mode,
      reasonCode: 'ENTRY_POLICY_ALLOW_SCALE_IN',
    };
  }

  return {
    allow: false,
    mode,
    reasonCode: 'ENTRY_POLICY_BLOCK_ACTIVE_EXPOSURE',
  };
}

