import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

export async function runDailyBilling(_targetDateUtc?: string): Promise<void> {
    logger.info(LogCode.SYS_INFO, 'Daily billing job skipped: credits billing is now the active settlement path.');
}

export function startBillingJobs(): void {
    logger.info(LogCode.SYS_INFO, 'Daily billing scheduler disabled: credits billing is now the active settlement path.');
}
