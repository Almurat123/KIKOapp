import { env } from '@xenova/transformers';

// Configure Transformers.js for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

class ModerationService {
    private static instance: ModerationService;
    // AI classifier removed - sentiment models are NOT appropriate for safety moderation
    // The SST-2 model was blocking legitimate Web3 queries like "early buyers", "sell", "profit"

    private constructor() { }

    public static getInstance(): ModerationService {
        if (!ModerationService.instance) {
            ModerationService.instance = new ModerationService();
        }
        return ModerationService.instance;
    }

    /**
     * Initialize - No longer needed as we removed the AI model
     */
    public async init(): Promise<void> {
        // No-op: AI classifier removed
        console.log('[Moderation] Initialized with keyword-only filtering (AI sentiment disabled for Web3)');
    }

    /**
     * Perform a quick check on user input
     * ONLY blocks actual security threats, NOT Web3 vocabulary
     */
    public async checkInput(
        text: string,
        _sessionId?: string | null,
        _model?: string | null
    ): Promise<{ safe: boolean; reason?: string }> {
        let result: { safe: boolean; reason?: string } = { safe: true };

        // 1. Simple Keyword Check - ONLY for real security threats
        // These are terms that indicate malicious intent, NOT trading vocabulary
        const blockedKeywords = [
            'hack this wallet',
            'drain wallet',
            'steal private key',
            'phishing script',
            'rug pull contract',
            'malware',
            'exploit vulnerability'
        ];
        const lowerText = text.toLowerCase();
        for (const kw of blockedKeywords) {
            if (lowerText.includes(kw)) {
                result = { safe: false, reason: `Policy violation: Restricted phrase detected.` };
                break;
            }
        }

        // 2. NO AI sentiment check - it was incorrectly blocking Web3 terms
        // The SST-2 model is a SENTIMENT classifier (positive/negative feelings)
        // It is NOT designed for safety moderation and blocks legitimate crypto queries

        // Deprecated: frontend moderation telemetry was consuming chat rate-limit budget
        // while the backend endpoint is a no-op. Keep local moderation only.

        return result;
    }
}

export const moderationService = ModerationService.getInstance();
