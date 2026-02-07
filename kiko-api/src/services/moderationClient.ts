import { fetchJson } from '../config/unifiedApiService.js';
import * as dotenv from 'dotenv';
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
            const response = await fetchJson({
                url: `${MODERATION_SERVICE_URL}/input`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    context
                }),
                timeout: 3000
            });

            logger.info(LogCode.SYS_INFO, 'Moderation Input check result', { safe: response.safe, action: response.action, userId: userId ?? undefined });
            return response;
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
            const response = await fetchJson({
                url: `${MODERATION_SERVICE_URL}/output`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text
                }),
                timeout: 3000
            });

            logger.info(LogCode.SYS_INFO, 'Moderation Output check result', { safe: response.safe, userId: userId ?? undefined });
            return response;
        } catch (error: any) {
            logger.warn(LogCode.API_FETCH_FAILED, 'Output moderation request failed, defaulting to original', { error: error.message });
            return { safe: true, filtered_text: scrub(text) };
        }
    }
}

export const moderationClient = ModerationClient.getInstance();
