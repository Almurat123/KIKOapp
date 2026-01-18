import axios from 'axios';
import dotenv from 'dotenv';
import { createModerationLog } from '../repositories/chatRepository.js';
import { redact } from '../utils/sanitizer.js';
import { scrub } from '../utils/scrubber.js';
import { logger } from '../utils/logger.js';
import { LogCode } from '../config/logRegistry.js';

dotenv.config();

const MODERATION_SERVICE_URL = process.env.MODERATION_SERVICE_URL || 'http://localhost:8003';

export interface ModerationResult {
    safe: boolean;
    checks?: {
        intent?: any;
        sensitive?: any;
        code?: any;
    };
    action?: 'allow' | 'block';
    filtered_text?: string;
    verification?: any;
}

export class ModerationClient {
    private static instance: ModerationClient;

    private constructor() { }

    public static getInstance(): ModerationClient {
        if (!ModerationClient.instance) {
            ModerationClient.instance = new ModerationClient();
        }
        return ModerationClient.instance;
    }

    /**
     * Moderate user input before sending to LLM
     */
    public async moderateInput(
        text: string,
        context: any = {},
        userId: string | null = null,
        sessionId: string | null = null,
        model: string | null = null
    ): Promise<ModerationResult> {
        try {
            const response = await axios.post(`${MODERATION_SERVICE_URL}/input`, {
                text,
                context
            }, { timeout: 3000 });

            // Log to DB
            logger.debug(LogCode.SYS_INFO, 'Logging input check to DB', { userId: userId ?? undefined });
            createModerationLog(userId || '', 'input', text, JSON.stringify(response.data), sessionId, model).catch((err: any) =>
                logger.error(LogCode.SYS_ERROR, 'Moderation input log to DB failed', { error: err.message })
            );

            logger.info(LogCode.SYS_INFO, 'Moderation Input check result', { safe: response.data.safe, action: response.data.action, userId: userId ?? undefined });
            return response.data;
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Input moderation request failed, defaulting to safe', { error: error.message });
            return { safe: true, action: 'allow' };
        }
    }

    /**
     * Moderate LLM output before sending to user
     */
    public async moderateOutput(
        text: string,
        userId: string | null = null,
        sessionId: string | null = null,
        model: string | null = null
    ): Promise<ModerationResult> {
        try {
            const response = await axios.post(`${MODERATION_SERVICE_URL}/input`, {
                text
            }, { timeout: 3000 });

            // Log to DB
            logger.debug(LogCode.SYS_INFO, 'Logging output check to DB', { userId: userId ?? undefined });
            createModerationLog(userId || '', 'output', text, JSON.stringify(response.data), sessionId, model).catch((err: any) =>
                logger.error(LogCode.SYS_ERROR, 'Moderation output log to DB failed', { error: err.message })
            );

            logger.info(LogCode.SYS_INFO, 'Moderation Output check result', { safe: response.data.safe, userId: userId ?? undefined });
            return response.data;
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Output moderation request failed, defaulting to original', { error: error.message });
            return { safe: true, filtered_text: scrub(text) };
        }
    }
}

export const moderationClient = ModerationClient.getInstance();
