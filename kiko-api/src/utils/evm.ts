export function extractRevertReason(message?: string): string | null {
    if (!message) return null;
    const match = message.match(/execution reverted:?\\s*(.*)$/i);
    if (match && match[1]) return match[1].trim();
    return null;
}
