import { v4 as uuidv4 } from 'uuid';

/**
 * Service for interacting with Warpcast API
 * Specifically for sending Direct Casts (DMs)
 * 
 * Supports multiple API keys with round-robin rotation for high volume.
 * Rate limit: 5,000 messages per key per day.
 */

const WARPCAST_API_BASE = 'https://api.warpcast.com/v2';
const DAILY_LIMIT_PER_KEY = 5000;

export interface SendDirectCastParams {
    recipientFid: number;
    message: string;
}

export interface DirectCastResponse {
    result: {
        success: boolean;
    };
}

interface KeyUsage {
    key: string;
    count: number;
    resetAt: number; // Unix timestamp of next reset (midnight UTC)
}

export class WarpcastService {
    private keys: KeyUsage[] = [];
    private currentKeyIndex: number = 0;

    constructor() {
        this.loadKeys();
    }

    /**
     * Load all API keys from environment variables.
     * Supports: WARPCAST_API_KEY, WARPCAST_API_KEY_1, WARPCAST_API_KEY_2, etc.
     */
    private loadKeys(): void {
        const allKeys: string[] = [];

        // Check for single key (legacy support)
        const singleKey = process.env.WARPCAST_DC_API_KEY || process.env.WARPCAST_API_KEY;
        if (singleKey) {
            allKeys.push(singleKey);
        }

        // Check for numbered keys (1-99)
        for (let i = 1; i <= 99; i++) {
            const key = process.env[`WARPCAST_API_KEY_${i}`];
            if (key) {
                allKeys.push(key);
            }
        }

        // Initialize usage tracking for each key
        const now = Date.now();
        const nextMidnightUTC = this.getNextMidnightUTC();

        this.keys = allKeys.map(key => ({
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

    /**
     * Get the next midnight UTC timestamp for daily reset.
     */
    private getNextMidnightUTC(): number {
        const now = new Date();
        const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
        return tomorrow.getTime();
    }

    /**
     * Reset usage counters if a new day has started.
     */
    private checkAndResetUsage(): void {
        const now = Date.now();
        for (const keyUsage of this.keys) {
            if (now >= keyUsage.resetAt) {
                keyUsage.count = 0;
                keyUsage.resetAt = this.getNextMidnightUTC();
            }
        }
    }

    /**
     * Get the next available key using round-robin with quota check.
     * Returns null if all keys are exhausted.
     */
    private getNextKey(): string | null {
        this.checkAndResetUsage();

        if (this.keys.length === 0) {
            return null;
        }

        // Try each key starting from current index
        for (let i = 0; i < this.keys.length; i++) {
            const index = (this.currentKeyIndex + i) % this.keys.length;
            const keyUsage = this.keys[index];

            if (keyUsage.count < DAILY_LIMIT_PER_KEY) {
                this.currentKeyIndex = (index + 1) % this.keys.length; // Move to next for round-robin
                return keyUsage.key;
            }
        }

        // All keys exhausted
        console.warn('[Warpcast] All API keys have reached daily limit!');
        return null;
    }

    /**
     * Record usage for a key after successful send.
     */
    private recordUsage(usedKey: string): void {
        const keyUsage = this.keys.find(k => k.key === usedKey);
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

    /**
     * Get current usage statistics.
     */
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

    /**
     * Send a Direct Cast to a user.
     */
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

            const response = await fetch(url, {
                method: 'PUT',
                headers: this.getHeaders(apiKey),
                body: JSON.stringify({
                    recipientFid,
                    message,
                    idempotencyKey
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Warpcast] Send failed: ${response.status} - ${errorText}`);
                return false;
            }

            // Record successful usage
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
