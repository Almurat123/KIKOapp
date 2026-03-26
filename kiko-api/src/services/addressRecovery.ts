const FULL_EVM_ADDRESS_RE = /\b0x[a-fA-F0-9]{40}\b/g;

export function isTruncatedEvmAddressLike(value: string): boolean {
    return /^0x[a-fA-F0-9]{6,39}$/i.test(String(value || '').trim());
}

export function extractFullEvmAddressesFromMessages(messages: any[]): string[] {
    const seen = new Set<string>();
    const results: string[] = [];
    for (const msg of messages || []) {
        const haystacks = [
            String(msg?.content || ''),
            (() => {
                try {
                    return JSON.stringify(msg?.data || {});
                } catch {
                    return '';
                }
            })(),
        ];
        for (const haystack of haystacks) {
            for (const match of haystack.match(FULL_EVM_ADDRESS_RE) || []) {
                const lower = String(match).toLowerCase();
                if (seen.has(lower)) continue;
                seen.add(lower);
                results.push(match);
            }
        }
    }
    return results;
}

export function repairTruncatedEvmAddressFromMessages(candidate: string, messages: any[]): string {
    const raw = String(candidate || '').trim();
    if (!isTruncatedEvmAddressLike(raw)) return raw;
    const normalizedCandidate = raw.toLowerCase();
    const matches = extractFullEvmAddressesFromMessages(messages)
        .filter((address) => String(address).toLowerCase().startsWith(normalizedCandidate));
    if (matches.length === 1) {
        return matches[0];
    }
    return raw;
}
