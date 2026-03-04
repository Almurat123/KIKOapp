export type ExposurePositionLike = {
  id: string;
  status?: string | null;
  createdAt?: Date | null;
  closedAt?: Date | null;
};

export type CopytradeExposureState =
  | 'none'
  | 'pending_entry'
  | 'open'
  | 'exit_in_progress'
  | 'mixed_active';

export type CopytradeExposureReasonCode =
  | 'EXPOSURE_NONE'
  | 'EXPOSURE_PENDING_ENTRY'
  | 'EXPOSURE_OPEN'
  | 'EXPOSURE_EXIT_IN_PROGRESS'
  | 'EXPOSURE_MIXED_ACTIVE';

export type ExposureStateResult<T extends ExposurePositionLike> = {
  state: CopytradeExposureState;
  reasonCode: CopytradeExposureReasonCode;
  blockingPositions: T[];
  pendingEntryPositions: T[];
  openPositions: T[];
  exitInProgressPositions: T[];
  metrics: {
    totalPositions: number;
    blockingCount: number;
    pendingEntryCount: number;
    openCount: number;
    exitInProgressCount: number;
  };
};

const ENTRY_LOCK_STATUSES = new Set([
  'pending',
  'pending_broadcast',
  'broadcasted_unseen',
]);

const OPEN_EXPOSURE_STATUSES = new Set([
  'open',
]);

const EXIT_IN_PROGRESS_STATUSES = new Set([
  'closing',
  'close_pending',
]);

export function classifyCopytradeExposureState<T extends ExposurePositionLike>(positions: T[]): ExposureStateResult<T> {
  const pendingEntryPositions = positions.filter((position) => ENTRY_LOCK_STATUSES.has(String(position.status || '')));
  const openPositions = positions.filter((position) => OPEN_EXPOSURE_STATUSES.has(String(position.status || '')));
  const exitInProgressPositions = positions.filter((position) => EXIT_IN_PROGRESS_STATUSES.has(String(position.status || '')));
  const blockingPositions = [
    ...pendingEntryPositions,
    ...openPositions,
    ...exitInProgressPositions,
  ];

  let state: CopytradeExposureState = 'none';
  let reasonCode: CopytradeExposureReasonCode = 'EXPOSURE_NONE';

  if (blockingPositions.length > 0) {
    const hasPending = pendingEntryPositions.length > 0;
    const hasOpen = openPositions.length > 0;
    const hasExit = exitInProgressPositions.length > 0;

    if ((hasPending && hasOpen) || (hasPending && hasExit) || (hasOpen && hasExit)) {
      state = 'mixed_active';
      reasonCode = 'EXPOSURE_MIXED_ACTIVE';
    } else if (hasPending) {
      state = 'pending_entry';
      reasonCode = 'EXPOSURE_PENDING_ENTRY';
    } else if (hasExit) {
      state = 'exit_in_progress';
      reasonCode = 'EXPOSURE_EXIT_IN_PROGRESS';
    } else {
      state = 'open';
      reasonCode = 'EXPOSURE_OPEN';
    }
  }

  return {
    state,
    reasonCode,
    blockingPositions,
    pendingEntryPositions,
    openPositions,
    exitInProgressPositions,
    metrics: {
      totalPositions: positions.length,
      blockingCount: blockingPositions.length,
      pendingEntryCount: pendingEntryPositions.length,
      openCount: openPositions.length,
      exitInProgressCount: exitInProgressPositions.length,
    },
  };
}

