import prisma from '../../../db/prisma.js';
import { LogCode } from '../../../config/logRegistry.js';
import { logger } from '../../../utils/logger.js';
import { analyzeTradeOpportunity, type AnalysisResult } from '../../copyTradeAnalysisService.js';
import { updateJudgeOutcome } from '../../../repositories/judgeRepository.js';
import { createMessage, createSession } from '../../../repositories/chatRepository.js';
import { ChatWebSocketService } from '../../chatWebSocket.js';

export async function runPostBuyAiFlow(params: {
  aiMode: 'analyze_only' | 'auto_decide' | null;
  userId: string;
  privyDid: string;
  configId: string;
  buyAmountUsd: number;
  tokenAddress: string;
  tokenSymbol: string;
  chainId: number;
  targetWallet: string;
  txHash: string;
  aiModel: string;
  resolvedAiModeForLogs: string;
}, deps?: {
  analyzeTradeOpportunity?: typeof analyzeTradeOpportunity;
  createCopyTradeAnalysis?: (params: {
    configId: string;
    tokenAddress: string;
    tokenSymbol: string;
    aiDecision: string;
    confidenceScore: number;
    analysisJson: string;
  }) => Promise<void>;
  createSession?: typeof createSession;
  createMessage?: typeof createMessage;
  broadcastToUser?: (userId: string, payload: unknown) => void;
  updateJudgeOutcome?: typeof updateJudgeOutcome;
}): Promise<{ executed: boolean; judgeDecisionId: string | null }> {
  if (!params.aiMode) {
    logger.debug(LogCode.DEC_AI_RISK_CHECK, 'AI Analysis skipped by copytrade config', {
      userId: params.userId,
      mode: params.resolvedAiModeForLogs,
      configId: params.configId,
      txHash: params.txHash,
    });
    return { executed: false, judgeDecisionId: null };
  }

  const runAnalysis = deps?.analyzeTradeOpportunity || analyzeTradeOpportunity;
  const persistAnalysis = deps?.createCopyTradeAnalysis || (async (input) => {
    await prisma.copyTradeAnalysis.create({ data: input });
  });
  const createAnalysisSession = deps?.createSession || createSession;
  const createAnalysisMessage = deps?.createMessage || createMessage;
  const broadcastToUser = deps?.broadcastToUser || ((userId, payload) => {
    ChatWebSocketService.getInstance().broadcastToUser(userId, payload as any);
  });
  const persistJudgeOutcome = deps?.updateJudgeOutcome || updateJudgeOutcome;

  logger.info(LogCode.DEC_AI_RISK_CHECK, 'AI Analysis triggered for copy trade (post-trade)', {
    userId: params.userId,
    mode: params.aiMode,
  });

  const analysis = await runAnalysis(
    params.tokenAddress,
    params.chainId,
    params.targetWallet,
    params.buyAmountUsd,
    undefined,
    {
      source: 'copytrade',
      copyTradeConfigId: params.configId,
      copyTradeTxHash: params.txHash,
      aiAnalysisMode: params.aiMode,
    },
  );
  const judgeDecisionId = analysis.judgeDecisionId ?? null;

  await persistAnalysis({
    configId: params.configId,
    tokenAddress: params.tokenAddress,
    tokenSymbol: params.tokenSymbol,
    aiDecision: analysis.decision,
    confidenceScore: analysis.confidence,
    analysisJson: JSON.stringify(analysis),
  });

  await sendAiAnalysisChatNotification({
    analysis,
    privyDid: params.privyDid,
    targetWallet: params.targetWallet,
    tokenAddress: params.tokenAddress,
    tokenSymbol: params.tokenSymbol,
    aiModel: params.aiModel,
  }, {
    createSession: createAnalysisSession,
    createMessage: createAnalysisMessage,
    broadcastToUser,
    userIdForLogs: params.userId,
  });

  if (judgeDecisionId) {
    try {
      await persistJudgeOutcome(judgeDecisionId, {
        actualExecuted: true,
        actualOutcome: 'success',
      });
    } catch (updateError: any) {
      logger.warn(LogCode.SYS_ERROR, 'Failed to update judge outcome', {
        decisionId: judgeDecisionId,
        error: updateError.message,
      });
    }
  }

  return { executed: true, judgeDecisionId };
}

async function sendAiAnalysisChatNotification(params: {
  analysis: AnalysisResult;
  privyDid: string;
  targetWallet: string;
  tokenAddress: string;
  tokenSymbol: string;
  aiModel: string;
}, deps: {
  createSession: typeof createSession;
  createMessage: typeof createMessage;
  broadcastToUser: (userId: string, payload: unknown) => void;
  userIdForLogs: string;
}): Promise<void> {
  try {
    const session = await deps.createSession(
      params.privyDid,
      `🤖 AI Trade Analysis: ${params.tokenSymbol}`,
      params.aiModel,
    );
    const sessionId = session.id;

    const messageContent = `
✅ **Copy Trade Executed**
Target Wallet: \`${params.targetWallet.slice(0, 6)}...${params.targetWallet.slice(-4)}\`
Token: **${params.tokenSymbol}** (\`${params.tokenAddress}\`)

🧠 **AI Decision**: ${params.analysis.decision === 'BUY' ? '✅ BUY' : '❌ SKIP'}
**Confidence**: ${params.analysis.confidence}%
**Reason**: ${params.analysis.reason}

**Metrics**:
- 🚀 Launchpad: ${params.analysis.metrics.launchpad}
- 📉 5m Change: ${params.analysis.metrics.priceChange5m.toFixed(2)}%
- 💧 Liquidity: $${params.analysis.metrics.liquidity.toLocaleString()}
- 📊 Market Cap: $${params.analysis.metrics.marketCap.toLocaleString()}
- 🐦 Social Score: ${params.analysis.metrics.socialScore}/100

${params.analysis.rawAnalysis}
    `.trim();

    await deps.createMessage(sessionId, 'assistant', messageContent);
    deps.broadcastToUser(params.privyDid, {
      type: 'content_block',
      sessionId,
      data: {
        text: messageContent,
        final: true,
      },
    });
  } catch (chatError: any) {
    logger.error(LogCode.API_NOTIFY_FAILED, 'Failed to send chat notification', {
      userId: deps.userIdForLogs,
      error: chatError.message,
    });
  }
}