import { v4 as uuidv4 } from 'uuid';
import * as unifiedApiService from '../../../config/unifiedApiService.js';
import type { SendDirectCastParams } from './types.js';

const WARPCAST_API_BASE = 'https://api.warpcast.com/v2';
const DAILY_LIMIT_PER_KEY = 5000;

interface KeyUsage {
    key: string;
    count: number;
    resetAt: number;
}

export class WarpcastService {
    private keys: KeyUsage[] = [];
    private currentKeyIndex: number = 0;

    constructor() {
        this.loadKeys();
    }

    private loadKeys(): void {
        const allKeys: string[] = [];
        const singleKey = process.env.WARPCAST_DC_API_KEY || process.env.WARPCAST_API_KEY;
        if (singleKey) {
            allKeys.push(singleKey);
        }

        for (let i = 1; i <= 99; i++) {
            const key = process.env[`WARPCAST_API_KEY_${i}`];
            if (key) {
                allKeys.push(key);
            }
        }

        const nextMidnightUTC = this.getNextMidnightUTC();
        this.keys = allKeys.map((key) => ({
            key,
            count: 0,
            resetAt: nextMidnightUTC
        }));

        if (this.keys.length > 0) {
            console.log(`[Warpcast] Loaded ${this.keys.length} API keys. Daily capacity: ${this.keys.length * DAILY_LIMIT_PER_KEY} messages.`);
        } else {
            console.warn('[Warpcast] No API keys configured. Direct Casts will be disabled.');
        }
    }

    private getNextMidnightUTC(): number {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
        return tomorrow.getTime();
    }

    private checkAndResetUsage(): void {
        const now = Date.now();
        for (const keyUsage of this.keys) {
            if (now >= keyUsage.resetAt) {
                keyUsage.count = 0;
                keyUsage.resetAt = this.getNextMidnightUTC();
            }
        }
    }

    private getNextKey(): string | null {
        this.checkAndResetUsage();
        if (this.keys.length === 0) {
            return null;
        }

        for (let i = 0; i < this.keys.length; i++) {
            const index = (this.currentKeyIndex + i) % this.keys.length;
            const keyUsage = this.keys[index];

            if (keyUsage.count < DAILY_LIMIT_PER_KEY) {
                this.currentKeyIndex = (index + 1) % this.keys.length;
                return keyUsage.key;
            }
        }

        console.warn('[Warpcast] All API keys have reached daily limit!');
        return null;
    }

    private recordUsage(usedKey: string): void {
        const keyUsage = this.keys.find((k) => k.key === usedKey);
        if (keyUsage) {
            keyUsage.count++;
        }
    }

    private getHeaders(apiKey: string) {
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    public isConfigured(): boolean {
        return this.keys.length > 0;
    }

    public getUsageStats(): { totalKeys: number; totalUsed: number; totalRemaining: number; keys: { index: number; used: number; remaining: number }[] } {
        this.checkAndResetUsage();
        const stats = this.keys.map((k, i) => ({
            index: i + 1,
            used: k.count,
            remaining: DAILY_LIMIT_PER_KEY - k.count
        }));

        return {
            totalKeys: this.keys.length,
            totalUsed: stats.reduce((sum, k) => sum + k.used, 0),
            totalRemaining: stats.reduce((sum, k) => sum + k.remaining, 0),
            keys: stats
        };
    }

    public async sendDirectCast({ recipientFid, message }: SendDirectCastParams): Promise<boolean> {
        if (!this.isConfigured()) {
            console.warn('[Warpcast] API key not configured, skipping Direct Cast');
            return false;
        }

        const apiKey = this.getNextKey();
        if (!apiKey) {
            console.error('[Warpcast] No available API keys (all exhausted). Message not sent.');
            return false;
        }

        try {
            console.log(`[Warpcast] Sending DM to FID ${recipientFid}: "${message.slice(0, 50)}..."`);

            const idempotencyKey = uuidv4();
            const url = `${WARPCAST_API_BASE}/ext-send-direct-cast`;

            await unifiedApiService.fetchJson<any>({
                url,
                method: 'PUT',
                headers: this.getHeaders(apiKey),
                body: JSON.stringify({
                    recipientFid,
                    message,
                    idempotencyKey
                }),
                timeout: 10000,
                endpointName: 'api.warpcast.com'
            });

            this.recordUsage(apiKey);
            const stats = this.getUsageStats();
            console.log(`[Warpcast] DM sent successfully. Daily usage: ${stats.totalUsed}/${stats.totalKeys * DAILY_LIMIT_PER_KEY}`);
            return true;
        } catch (error: any) {
            console.error('[Warpcast] Error sending DM:', error.message);
            return false;
        }
    }
}

export const warpcastService = new WarpcastService();
