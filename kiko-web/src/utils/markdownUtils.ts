/**
 * Preprocesses markdown content to fix common LLM formatting issues.
 * Particularly helpful for models like Grok that might output loose markdown.
 */
export const preprocessMarkdown = (content: string): string => {
    if (!content) return '';

    let processed = content;

    // 1. Ensure headers have a preceding newline
    // Replaces "Text\n# Header" with "Text\n\n# Header"
    processed = processed.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

    // 2. Ensure lists have a preceding newline
    // Replaces "Text\n- Item" with "Text\n\n- Item"
    processed = processed.replace(/([^\n])\n((-|\*|\d+\.)\s)/g, '$1\n\n$2');

    // 3. Ensure code blocks have a preceding newline
    // Replaces "Text\n```" with "Text\n\n```"
    processed = processed.replace(/([^\n])\n```/g, '$1\n\n```');

    // 4. Convert token tags [TOKEN:address:symbol:chainId] to special markdown links
    // This allows them to be captured by the <a> component and rendered as TokenCapsule
    // Format: [symbol](token://address?chainId=chainId)
    processed = processed.replace(/\[TOKEN:([^:]+):([^:]+)(?::([^\]]+))?\]/g, (_match, addr, sym, chainId) => {
        return `[${sym}](token://${addr}${chainId ? `?chainId=${chainId}` : ''})`;
    });

    return processed;
};
