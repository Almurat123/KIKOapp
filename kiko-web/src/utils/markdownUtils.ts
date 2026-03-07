/**
 * Preprocesses markdown content to fix common LLM formatting issues.
 * Particularly helpful for models like Grok that might output loose markdown.
 */
export const preprocessMarkdown = (content: string): string => {
  if (!content) return '';

  let processed = content;
  const nonCodeFenceLanguages = new Set(['text', 'txt', 'plain', 'plaintext']);

  const collapseDuplicateUrlParens = (input: string) =>
    input.replace(/(\[[^\n]+?\]\((https?:\/\/[^\s)]+)\))\s*\(\s*\2\s*\)/g, '$1');

  const collapseNestedSameUrlLinks = (input: string) =>
    input.replace(/\[\s*(\[[^\n]+?\]\((https?:\/\/[^\s)]+)\))\s*\]\(\s*\2\s*\)/g, '$1');

  const unwrapBracketWrappedLinks = (input: string) =>
    input.replace(/\[\s*(\[[^\n]+?\]\([^)]+\))\s*\]/g, '$1');

  const unwrapParenWrappedLinks = (input: string) =>
    input.replace(/\(\s*(\[[^\n]+?\]\([^)]+\))\s*\)/g, '$1');

  const dedupeAdjacentSameUrlLinks = (input: string) =>
    input.replace(/(\[[^\n]+?\]\((https?:\/\/[^\s)]+)\))\s+(\[[^\n]+?\]\(\2\))/g, '$1');

  const isMetadataPlaceholder = (line: string) =>
    /^(?:internal tool|\[(?:web|post|cpost|source|tool):\d+\])$/i.test(line.trim());

  const wrapMetadataToken = (line: string) => `\`${line.trim()}\``;

  const looksLikeCode = (block: string) => {
    const trimmed = block.trim();
    if (!trimmed) return false;

    const codeSignals = [
      /(^|\n)\s*(const|let|var|function|class|interface|type|import|export|return)\b/,
      /=>/,
      /[{};]/,
      /<\/?[a-z][\w:-]*[^>]*>/i,
      /^\s*[\[{].*[\]}]\s*$/m,
      /(^|\n)\s*[-\w$]+\s*=\s*.+/,
      /(^|\n)\s*(if|for|while|switch|case|try|catch)\b/,
    ];

    return codeSignals.some((pattern) => pattern.test(trimmed));
  };

  const unwrapNonCodeTextFences = (input: string) =>
    input.replace(/```([\w-]*)\n([\s\S]*?)```/g, (fullMatch, rawLanguage, rawBody) => {
      const language = String(rawLanguage || '').trim().toLowerCase();
      if (!nonCodeFenceLanguages.has(language)) {
        return fullMatch;
      }

      const body = String(rawBody || '').trim();
      if (!body) {
        return '';
      }

      const lines = body
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length > 0 && lines.every(isMetadataPlaceholder)) {
        return `\n\n${lines.map(wrapMetadataToken).join(' ')}\n\n`;
      }

      if (!looksLikeCode(body)) {
        return `\n\n${body}\n\n`;
      }

      return fullMatch;
    });

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
  processed = processed.replace(
    /\[TOKEN:([^:]+):([^:]+)(?::([^\]]+))?\]/g,
    (_match, addr, sym, chainId) => {
      return `[${sym}](token://${addr}${chainId ? `?chainId=${chainId}` : ''})`;
    }
  );

  // 5. Normalize common LLM duplicate-link patterns such as:
  // [label](url)(url) or [[label](url)](url)
  // This keeps one canonical link token before markdown rendering.
  for (let i = 0; i < 3; i += 1) {
    processed = collapseDuplicateUrlParens(processed);
    processed = collapseNestedSameUrlLinks(processed);
    processed = unwrapBracketWrappedLinks(processed);
    processed = unwrapParenWrappedLinks(processed);
    processed = dedupeAdjacentSameUrlLinks(processed);
  }

  // 6. Assistant outputs sometimes wrap non-code text in ```text fences.
  // Keep real code fences, but unwrap metadata/prose so they render like normal content.
  processed = unwrapNonCodeTextFences(processed);

  // 7. Collapse overly large blank gaps created by fence unwrapping.
  processed = processed.replace(/\n{3,}/g, '\n\n');

  return processed;
};
