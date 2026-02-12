export interface BudgetMessage {
    role: string;
    content?: string;
    reasoning_content?: string;
    tool_calls?: any[];
    tool_call_id?: string;
}

export interface ContextBudgetOptions {
    recentWindow?: number;
    maxInputTokens?: number;
    reservedOutputTokens?: number;
}

export interface ContextBudgetResult {
    messages: BudgetMessage[];
    compactedSummary?: string;
    inputTokensEstimated: number;
    historyKept: number;
    historyCompacted: number;
}

const DEFAULT_RECENT_WINDOW = 12;
const DEFAULT_MAX_INPUT_TOKENS = 16000;
const DEFAULT_RESERVED_OUTPUT = 3500;

// Heuristic estimator: ~4 chars per token.
function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

function messageTokens(msg: BudgetMessage): number {
    const base = estimateTokens(String(msg.content || ''));
    const reasoning = estimateTokens(String(msg.reasoning_content || ''));
    const toolPayload = msg.tool_calls ? estimateTokens(JSON.stringify(msg.tool_calls)) : 0;
    return base + reasoning + toolPayload + 8;
}

function isLowValueHistoryMessage(msg: BudgetMessage): boolean {
    if (msg.role === 'tool') return true;
    const text = String(msg.content || '').toLowerCase();
    if (!text) return true;
    if (text.includes('processing tool results')) return true;
    if (text.includes('thinking')) return true;
    if (text.includes('task status')) return true;
    if (text.length < 8 && msg.role !== 'user') return true;
    return false;
}

function summarizeHistory(messages: BudgetMessage[]): string {
    const facts: string[] = [];
    const openLoops: string[] = [];
    const preferences: string[] = [];
    const toolState: string[] = [];

    const userMsgs = messages.filter(m => m.role === 'user').slice(-8);
    const assistantMsgs = messages.filter(m => m.role === 'assistant').slice(-8);

    for (const m of userMsgs) {
        const t = String(m.content || '').trim();
        if (!t) continue;
        if (/\b(prefer|always|never|don't|do not|请|不要|总是|偏好)\b/i.test(t)) {
            preferences.push(t.slice(0, 200));
        } else {
            facts.push(t.slice(0, 180));
        }
    }

    for (const m of assistantMsgs) {
        const t = String(m.content || '').trim();
        if (!t) continue;
        if (/\b(confirm|confirmation|需要确认|请确认|pending|awaiting)\b/i.test(t)) {
            openLoops.push(t.slice(0, 180));
        }
        if (/\btool|swap|transaction|simulate|quote|risk|launchpad\b/i.test(t)) {
            toolState.push(t.slice(0, 180));
        }
    }

    return [
        '[COMPACTED_HISTORY]',
        `facts=${JSON.stringify(facts.slice(-8))}`,
        `open_loops=${JSON.stringify(openLoops.slice(-6))}`,
        `preferences=${JSON.stringify(preferences.slice(-6))}`,
        `tool_state=${JSON.stringify(toolState.slice(-8))}`,
    ].join('\n');
}

export class ContextBudgetManager {
    applyBudget(
        fullMessages: BudgetMessage[],
        options: ContextBudgetOptions = {}
    ): ContextBudgetResult {
        const recentWindow = options.recentWindow ?? DEFAULT_RECENT_WINDOW;
        const maxInputTokens = options.maxInputTokens ?? DEFAULT_MAX_INPUT_TOKENS;
        const reservedOutputTokens = options.reservedOutputTokens ?? DEFAULT_RESERVED_OUTPUT;
        const usableBudget = Math.max(1000, maxInputTokens - reservedOutputTokens);

        const messages = [...fullMessages];
        const totalEstimate = messages.reduce((sum, m) => sum + messageTokens(m), 0);

        if (totalEstimate <= usableBudget) {
            return {
                messages,
                inputTokensEstimated: totalEstimate,
                historyKept: messages.length,
                historyCompacted: 0,
            };
        }

        const recent = messages.slice(-recentWindow);
        const older = messages.slice(0, Math.max(0, messages.length - recentWindow));
        const olderHighValue = older.filter(m => !isLowValueHistoryMessage(m));

        let compactedSummary = '';
        if (olderHighValue.length > 0) {
            compactedSummary = summarizeHistory(olderHighValue);
        }

        let next = recent;
        let nextEstimate = next.reduce((sum, m) => sum + messageTokens(m), 0)
            + estimateTokens(compactedSummary);

        // If still over budget, trim oldest from recent window.
        while (next.length > 4 && nextEstimate > usableBudget) {
            next.shift();
            nextEstimate = next.reduce((sum, m) => sum + messageTokens(m), 0)
                + estimateTokens(compactedSummary);
        }

        return {
            messages: next,
            compactedSummary: compactedSummary || undefined,
            inputTokensEstimated: nextEstimate,
            historyKept: next.length,
            historyCompacted: messages.length - next.length,
        };
    }
}

export const contextBudgetManager = new ContextBudgetManager();
