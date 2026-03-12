import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';
import { isContextLearningEnabled } from '../services/copytrade-v2/context/featureFlags.js';
import { learnTemplateCandidateDrafts } from '../services/copytrade-v2/learning/contextLearner.js';
import { shouldRunNonCriticalJob } from '../services/runtimeActivityService.js';

let started = false;
let running = false;

export async function runContextLearningJob(): Promise<void> {
  if (!isContextLearningEnabled()) return;
  if (running) return;
  if (!shouldRunNonCriticalJob('context_learning')) return;
  running = true;
  try {
    const result = await learnTemplateCandidateDrafts();
    logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Learning job completed', {
      generatedDrafts: result.generatedDrafts,
      failureBuckets: result.failureBuckets
    });
  } catch (error: any) {
    logger.warn(LogCode.SYS_ERROR, '[CTX-LEARN] Learning job failed', {
      error: error?.message || String(error)
    });
  } finally {
    running = false;
  }
}

export function startContextLearningJob(): void {
  if (started) return;
  started = true;
  if (!isContextLearningEnabled()) {
    logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Job disabled by CTX_LEARNING_ENABLED');
    return;
  }

  cron.schedule('*/10 * * * *', () => {
    void runContextLearningJob();
  }, {
    timezone: 'UTC'
  });

  logger.info(LogCode.SYS_INFO, '[CTX-LEARN] Job scheduled', {
    cron: '*/10 * * * *',
    timezone: 'UTC'
  });

  void runContextLearningJob();
}
