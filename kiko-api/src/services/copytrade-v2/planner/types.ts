export type ExecutionSide = 'buy' | 'sell';

export interface PlannerInput {
  chainId: number;
  side: ExecutionSide;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  walletAddress: string;
  sourceWallet?: string;
  sourceTxHash?: string;
  sourceRouter?: string;
  sourceSelector?: string;
  sourceTxInput?: string;
  sourceTxValue?: string;
}

export interface ExecutionConstraintV1 {
  maxSlippageBps: number;
  maxGas: string;
  allowPartialFill: boolean;
  strictTokenCheck: boolean;
}

export interface TemplateRefV1 {
  templateId: string;
  templateVersion: number;
  router: string;
  commandType: string;
}

export interface PlannerDecisionTrace {
  sourceTxHash?: string;
  sampleIds: string[];
  plannerScore: number;
  reasoning: string;
  adapterName?: string;
  adapterVersion?: string;
}

export interface ExecutionPlanV1 {
  version: 1;
  chainId: number;
  side: ExecutionSide;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  receiver: string;
  deadline: number;
  nonce: string;
  templateRef: TemplateRefV1;
  execData: {
    commands: string;
    inputs: string[];
    sourceCalldata?: string;
    sourceValue?: string;
  };
  constraints: ExecutionConstraintV1;
  trace: PlannerDecisionTrace;
}

export interface TemplateCandidate {
  id: string;
  chainId: number;
  side: ExecutionSide;
  tokenIn: string;
  tokenOut: string;
  router: string;
  commandType: string;
  templateVersion: number;
  templatePayloadJson: string;
  successRate: number;
  avgSlippageBps?: number | null;
  avgGasUsed?: string | null;
  sampleCount: number;
  isActive: boolean;
}

export interface PlanScore {
  value: number;
  breakdown: {
    executable: number;
    slippage: number;
    gas: number;
    sampleConfidence: number;
  };
}

export interface SimulationResult {
  success: boolean;
  amountOut?: string;
  gasUsed?: string;
  revertReason?: string;
  raw?: string;
  blockTag?: string;
  classificationCode?: string;
  rawErrorCode?: string;
}

export interface ReplayPrecheckResult {
  ok: boolean;
  reason?: string;
  tokenBalance?: string;
  requiredAmount?: string;
  allowance?: string;
  requiredAllowance?: string;
  spender?: string;
}

export type ReplayDriftClassification =
  | 'state_drift'
  | 'adapter_or_logic'
  | 'tx_send_or_nonce_path'
  | 'no_drift'
  | 'unknown_drift';

export interface ReplayDriftDiagnosis {
  latest: SimulationResult;
  atSourcePreBlock?: SimulationResult;
  classification: ReplayDriftClassification;
  reasonCode?: string;
  sourceBlockTag?: string;
}
