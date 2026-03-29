export type MirrorSellIntentDisposition = 'none' | 'arm_exit' | 'execute_immediately';

export interface MirrorSellIntentDecision {
  disposition: MirrorSellIntentDisposition;
  targetSellTxHash?: string;
  reasonCode?: string;
}

const DISPOSITION_PRIORITY: Record<MirrorSellIntentDisposition, number> = {
  none: 0,
  arm_exit: 1,
  execute_immediately: 2,
};

export function chooseMirrorSellIntent(
  ...candidates: Array<MirrorSellIntentDecision | null | undefined>
): MirrorSellIntentDecision {
  let winner: MirrorSellIntentDecision = { disposition: 'none' };
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (DISPOSITION_PRIORITY[candidate.disposition] > DISPOSITION_PRIORITY[winner.disposition]) {
      winner = candidate;
    }
  }
  return winner;
}

export function hasMirrorSellIntent(decision?: MirrorSellIntentDecision | null): boolean {
  return Boolean(decision && decision.disposition !== 'none');
}

export function shouldExecuteMirrorSellImmediately(decision?: MirrorSellIntentDecision | null): boolean {
  return decision?.disposition === 'execute_immediately';
}
