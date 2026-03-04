import type { ExecutionPlanV1, PlannerInput } from '../types.js';

export interface SourceReplayRewriteOutput {
  plan: ExecutionPlanV1;
  adapterName: string;
  adapterVersion: string;
  warnings: string[];
}

export interface SourceReplayAdapter {
  readonly name: string;
  readonly version: string;
  supports(selector: string): boolean;
  rewrite(input: PlannerInput): SourceReplayRewriteOutput | null;
  validate(output: SourceReplayRewriteOutput, input: PlannerInput): { ok: boolean; reason?: string };
}
