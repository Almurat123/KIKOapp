export type SocialEventAnchorMatch = {
    enabled: true;
    targetHandles: string[];
    reason: string;
    systemInstruction: string;
};

const HANDLE_ALIASES: Array<{ pattern: RegExp; handle: string }> = [
    { pattern: /\bcz(?:_binance)?\b/i, handle: '@cz_binance' },
    { pattern: /赵长鹏/u, handle: '@cz_binance' },
];

function extractExplicitHandles(message: string): string[] {
    const matches = message.match(/@([A-Za-z0-9_]{1,30})/g) || [];
    return matches.map((value) => value.startsWith('@') ? value : `@${value}`);
}

function dedupeHandles(handles: string[]): string[] {
    const normalized = new Set<string>();
    for (const handle of handles) {
        const clean = String(handle || '').trim();
        if (!clean) continue;
        normalized.add(clean.startsWith('@') ? clean : `@${clean}`);
    }
    return Array.from(normalized);
}

export function detectSocialEventAnchor(message: string): SocialEventAnchorMatch | null {
    const text = String(message || '').trim();
    if (!text) return null;

    const hasContractAddress = /0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}/.test(text);
    if (!hasContractAddress) return null;

    const hasSocialPostSignal = /\b(tweet|tweets|post|posts|x\b|twitter)\b/i.test(text)
        || /帖子|推文|发的那个|发帖|发文/u.test(text);
    if (!hasSocialPostSignal) return null;

    const hasTimeAnchorSignal = /\b(time|timestamp|when|at the time|posted|latest|recent)\b/i.test(text)
        || /时间点|发布时间|当时|最新/u.test(text);
    if (!hasTimeAnchorSignal) return null;

    const explicitHandles = extractExplicitHandles(text);
    const aliasHandles = HANDLE_ALIASES
        .filter((entry) => entry.pattern.test(text))
        .map((entry) => entry.handle);
    const targetHandles = dedupeHandles([...explicitHandles, ...aliasHandles]);
    if (targetHandles.length === 0) return null;

    return {
        enabled: true,
        targetHandles,
        reason: 'social_post_time_anchor',
        systemInstruction:
            `SOCIAL_EVENT_TIME_ANCHOR: This request is anchored to a specific post from ${targetHandles.join(', ')}. ` +
            `You MUST first identify the target account's relevant post and extract its exact timestamp. ` +
            `Only after the timestamp is confirmed may you validate token launches, early buyers, price action, or market behavior around that time. ` +
            `Do NOT start with get_early_buyers or generic market analysis before the post timestamp is established. ` +
            `If you cannot verify a qualifying post from the target account, say that clearly and stop instead of guessing.`,
    };
}
