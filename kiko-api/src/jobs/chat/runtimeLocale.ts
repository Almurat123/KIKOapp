const CJK_IDEOGRAPH_RE = /[\u4e00-\u9fff]/;
const JAPANESE_KANA_RE = /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/;

export function containsJapaneseKana(text: string): boolean {
    return JAPANESE_KANA_RE.test(String(text || ''));
}

export function isChineseDominantText(text: string): boolean {
    const value = String(text || '');
    if (!value.trim()) return false;
    if (containsJapaneseKana(value)) return false;
    return CJK_IDEOGRAPH_RE.test(value);
}

export function resolveBinaryLocale(
    text: string,
    preferredLocale?: string | null,
): 'en' | 'zh' {
    const raw = String(preferredLocale || '').trim().toLowerCase();
    if (raw === 'zh' || raw === 'cn' || raw === 'zh-cn' || raw === 'zh-hans' || raw === 'zh-hant') {
        return 'zh';
    }
    if (raw === 'en') return 'en';
    return isChineseDominantText(text) ? 'zh' : 'en';
}
