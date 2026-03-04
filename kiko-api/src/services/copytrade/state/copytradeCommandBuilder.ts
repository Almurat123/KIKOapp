import type { CopytradeCommand, CopytradeCommandType } from './copytradeStateTypes.js';

export function buildCopytradeCommand(type: CopytradeCommandType, reasonCode: string): CopytradeCommand {
  return { type, reasonCode };
}
