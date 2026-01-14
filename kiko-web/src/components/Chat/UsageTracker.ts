// UsageTracker.ts - Track user command usage for personalized suggestions

const USAGE_KEY = 'kiko_command_usage';
const RECENT_KEY = 'kiko_recent_commands';
const MAX_RECENT = 10;

interface UsageData {
    [commandId: string]: number;
}

interface RecentCommand {
    commandId: string;
    timestamp: number;
}

/**
 * UsageTracker - Tracks command usage frequency and recency
 * for personalized suggestion ordering
 */
export class UsageTracker {

    /**
     * Record a command usage
     */
    static record(commandId: string): void {
        // Update frequency
        const data = this.loadUsage();
        data[commandId] = (data[commandId] || 0) + 1;
        localStorage.setItem(USAGE_KEY, JSON.stringify(data));

        // Update recent list
        const recent = this.loadRecent();
        recent.unshift({ commandId, timestamp: Date.now() });
        if (recent.length > MAX_RECENT) {
            recent.pop();
        }
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    }

    /**
     * Get usage frequency for a command
     */
    static getFrequency(commandId: string): number {
        const data = this.loadUsage();
        return data[commandId] || 0;
    }

    /**
     * Get all usage data
     */
    static getAllFrequencies(): UsageData {
        return this.loadUsage();
    }

    /**
     * Get the most recently used command
     */
    static getMostRecent(): string | null {
        const recent = this.loadRecent();
        return recent.length > 0 ? recent[0].commandId : null;
    }

    /**
     * Get recent commands (up to MAX_RECENT)
     */
    static getRecentCommands(): string[] {
        const recent = this.loadRecent();
        return recent.map(r => r.commandId);
    }

    /**
     * Calculate a score boost based on usage
     * More frequent = higher boost, with diminishing returns
     */
    static getScoreBoost(commandId: string): number {
        const frequency = this.getFrequency(commandId);
        // Logarithmic scaling to prevent runaway scores
        // 1 use = 10, 10 uses = 23, 100 uses = 46
        return frequency > 0 ? Math.round(10 * Math.log10(frequency + 1) * 2) : 0;
    }

    /**
     * Get recency boost (higher if used recently)
     */
    static getRecencyBoost(commandId: string): number {
        const recent = this.loadRecent();
        const index = recent.findIndex(r => r.commandId === commandId);
        if (index === -1) return 0;
        // First = 50, second = 45, etc.
        return Math.max(0, 50 - (index * 5));
    }

    /**
     * Clear all usage data (for testing/reset)
     */
    static clear(): void {
        localStorage.removeItem(USAGE_KEY);
        localStorage.removeItem(RECENT_KEY);
    }

    // --- Private helpers ---

    private static loadUsage(): UsageData {
        try {
            const raw = localStorage.getItem(USAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    private static loadRecent(): RecentCommand[] {
        try {
            const raw = localStorage.getItem(RECENT_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }
}
