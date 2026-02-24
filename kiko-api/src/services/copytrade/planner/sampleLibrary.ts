import prisma from '../../../db/prisma.js';
import { logger } from '../../../utils/logger.js';
import { LogCode } from '../../../config/logRegistry.js';
import type { ExecutionSide, PlannerInput, TemplateCandidate } from './types.js';
import { getP2TemplateMinSampleCount, getP2TemplateMinSuccessRate } from './featureFlags.js';

export interface RecordSuccessSampleParams {
  chainId: number;
  side: ExecutionSide;
  txHash: string;
  wallet: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut?: string;
  router: string;
  selector?: string;
  poolMetaJson?: string;
  hookMetaJson?: string;
  commandMetaJson?: string;
  gasUsed?: string;
  blockTime?: Date;
}

export interface RecordPlanRunParams {
  mode: 'shadow' | 'canary' | 'live';
  chainId: number;
  inputJson: string;
  planJson: string;
  simulationJson?: string;
  scoreJson?: string;
  selectedTemplateId?: string;
  resultStatus: string;
  txHash?: string;
  latencyMs?: number;
}

export async function recordSuccessSample(params: RecordSuccessSampleParams): Promise<void> {
  try {
    const db = prisma as any;
    await db.executionSample.create({
      data: {
        chainId: params.chainId,
        txHash: params.txHash,
        wallet: params.wallet,
        side: params.side,
        tokenIn: params.tokenIn.toLowerCase(),
        tokenOut: params.tokenOut.toLowerCase(),
        amountIn: params.amountIn,
        amountOut: params.amountOut,
        router: params.router.toLowerCase(),
        selector: params.selector || null,
        poolMetaJson: params.poolMetaJson || null,
        hookMetaJson: params.hookMetaJson || null,
        commandMetaJson: params.commandMetaJson || null,
        status: 'success',
        gasUsed: params.gasUsed || null,
        blockTime: params.blockTime || new Date(),
      }
    });
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[P2] Failed to record execution sample', {
      error: error?.message || String(error),
      txHash: params.txHash
    });
  }
}

export async function recordPlanRun(params: RecordPlanRunParams): Promise<void> {
  try {
    const db = prisma as any;
    await db.executionPlanRun.create({
      data: {
        mode: params.mode,
        chainId: params.chainId,
        inputJson: params.inputJson,
        planJson: params.planJson,
        simulationJson: params.simulationJson || null,
        scoreJson: params.scoreJson || null,
        selectedTemplateId: params.selectedTemplateId || null,
        resultStatus: params.resultStatus,
        txHash: params.txHash || null,
        latencyMs: params.latencyMs || null,
      }
    });
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[P2] Failed to record execution plan run', {
      error: error?.message || String(error),
      mode: params.mode
    });
  }
}

export async function queryTemplateCandidates(input: PlannerInput): Promise<TemplateCandidate[]> {
  const minSuccessRate = getP2TemplateMinSuccessRate();
  const minSampleCount = getP2TemplateMinSampleCount();

  try {
    const db = prisma as any;
    const rows = await db.executionTemplate.findMany({
      where: {
        chainId: input.chainId,
        side: input.side,
        tokenIn: input.tokenIn.toLowerCase(),
        tokenOut: input.tokenOut.toLowerCase(),
        isActive: true,
        successRate: {
          gte: minSuccessRate,
        },
        sampleCount: {
          gte: minSampleCount,
        }
      },
      orderBy: [
        { successRate: 'desc' },
        { sampleCount: 'desc' },
        { templateVersion: 'desc' }
      ],
      take: 8
    });

    return rows.map((r: any) => ({
      id: r.id,
      chainId: r.chainId,
      side: r.side as ExecutionSide,
      tokenIn: r.tokenIn,
      tokenOut: r.tokenOut,
      router: r.router,
      commandType: r.commandType,
      templateVersion: r.templateVersion,
      templatePayloadJson: r.templatePayloadJson,
      successRate: r.successRate,
      avgSlippageBps: r.avgSlippageBps,
      avgGasUsed: r.avgGasUsed,
      sampleCount: r.sampleCount,
      isActive: r.isActive
    }));
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[P2] Failed to query template candidates', {
      error: error?.message || String(error),
      chainId: input.chainId,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut
    });
    return [];
  }
}

export async function getTemplateStats(templateId: string): Promise<{
  successRate: number;
  sampleCount: number;
} | null> {
  try {
    const db = prisma as any;
    const row = await db.executionTemplate.findUnique({
      where: { id: templateId },
      select: { successRate: true, sampleCount: true }
    });
    if (!row) return null;
    return {
      successRate: row.successRate,
      sampleCount: row.sampleCount
    };
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[P2] Failed to read template stats', {
      error: error?.message || String(error),
      templateId
    });
    return null;
  }
}
