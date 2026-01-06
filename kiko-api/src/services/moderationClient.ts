import axios from 'axios';
import dotenv from 'dotenv';
import { createModerationLog } from '../repositories/chatRepository.js';

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
            console.log(`[ModerationClient] Logging input check to DB for userId=${userId}`);
            createModerationLog(userId || '', 'input', text, JSON.stringify(response.data), sessionId, model).catch((err: any) => console.error('ModLog failed', err));

            console.log(`[ModerationClient] Input check result: safe=${response.data.safe}, action=${response.data.action}`);
            return response.data;
        } catch (error) {
            console.warn('[ModerationClient] Input moderation request failed, defaulting to safe:', error);
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
            console.log(`[ModerationClient] Logging output check to DB for userId=${userId}`);
            createModerationLog(userId || '', 'output', text, JSON.stringify(response.data), sessionId, model).catch((err: any) => console.error('ModLog failed', err));

            console.log(`[ModerationClient] Output check result: safe=${response.data.safe}`);
            return response.data;
        } catch (error) {
            console.warn('[ModerationClient] Output moderation request failed, defaulting to original:', error);
            return { safe: true, filtered_text: text };
        }
    }
}

export const moderationClient = ModerationClient.getInstance();
