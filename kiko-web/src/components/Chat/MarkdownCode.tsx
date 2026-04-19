// CONTEXT MEMORY
// Updated: 2026-04-19
// Author: Rowan
// Reason: runtime Markdown warnings showed ReactMarkdown sometimes calls the
//         code renderer with `inline` undefined for inline backtick content.
//         Treating that case as a block returned `<div>` nodes inside `<p>`,
//         causing invalid DOM nesting and hydration risk during streaming.
// Goal: render true inline code as inline elements even when the renderer omits
//       the inline flag, while preserving fenced/code-looking blocks as copyable
//       code panels.
// Owns: Markdown code span/block presentation inside chat bubbles.
// Does Not Own: Markdown parsing, message streaming, or syntax theme selection.
// Design Language:
// - inline code must never return block-level elements
// - fenced or language-tagged code may render as a block with copy controls
// - metadata tokens may stay inline only when the Markdown parser placed them inline
// - diagnostics and fixes must not alter raw assistant content
// Document Provenance:
// - Source: operator browser console warning for cmo5a4f1h03sjj5et046ndecy
// - Kind: runtime observation
// - Retrieved: 2026-04-19
// - Applied To: inline fallback when ReactMarkdown omits the inline boolean
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-streaming-markdown-restore.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-19-chat-stream-duplicate-and-tool-loop-diagnostics.md
import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import clsx from 'clsx';
import { useThemeContext } from '../../contexts/ThemeContext';
import styles from './MarkdownCode.module.css';

interface MarkdownCodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const nonCodeLanguages = new Set(['text', 'txt', 'plain', 'plaintext']);

const lightSyntaxTheme = {
  ...oneLight,
  'pre[class*="language-"]': {
    ...(oneLight['pre[class*="language-"]'] || {}),
    background: 'transparent',
    color: '#1f2937',
  },
  'code[class*="language-"]': {
    ...(oneLight['code[class*="language-"]'] || {}),
    background: 'transparent',
    color: '#1f2937',
  },
};

const darkSyntaxTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...(oneDark['pre[class*="language-"]'] || {}),
    background: 'transparent',
    color: '#e5e7eb',
  },
  'code[class*="language-"]': {
    ...(oneDark['code[class*="language-"]'] || {}),
    background: 'transparent',
    color: '#e5e7eb',
  },
};

function stringifyChildren(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') return child;
      if (typeof child === 'number') return String(child);
      return '';
    })
    .join('');
}

function isMetadataLine(line: string): boolean {
  return /^(?:internal tool|browse_page|web_search|\[(?:web|post|cpost|source|tool):\d+\]|<grok:[^>]+>)$/i.test(
    line.trim()
  );
}

function getMetadataTone(line: string): string {
  const normalized = line.trim().toLowerCase();

  if (normalized.startsWith('<grok:')) return 'renderer';
  if (normalized === 'web_search' || normalized === 'browse_page') return 'tool';
  if (normalized === 'internal tool') return 'internal';
  if (normalized.startsWith('[web:')) return 'web';
  if (normalized.startsWith('[post:') || normalized.startsWith('[cpost:')) return 'post';
  return 'default';
}

function looksLikeCode(block: string): boolean {
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
}

function looksLikeHexScalar(value: string): boolean {
  const trimmed = value.trim();
  return /^0x[a-fA-F0-9]{40,64}$/.test(trimmed);
}

export const MarkdownCode: React.FC<MarkdownCodeProps> = ({
  inline,
  className,
  children,
}) => {
  const { resolvedTheme } = useThemeContext();
  const [copied, setCopied] = useState(false);
  const rawCode = useMemo(() => stringifyChildren(children).replace(/\n$/, ''), [children]);
  const languageMatch = /language-([\w-]+)/.exec(className || '');
  const language = languageMatch?.[1]?.toLowerCase() || 'text';
  const shouldTreatAsInline =
    inline === true || (inline !== false && !languageMatch && !rawCode.includes('\n'));
  const lines = useMemo(
    () =>
      rawCode
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    [rawCode]
  );
  const isTextLikeLanguage = nonCodeLanguages.has(language);
  const isMetadataOnly = lines.length > 0 && lines.every(isMetadataLine);
  const isShortSingleLineMetadata =
    isMetadataOnly && lines.length === 1 && lines[0].length <= 72;
  const isHexScalar = looksLikeHexScalar(rawCode);
  const shouldRenderAsCodeBlock =
    !isHexScalar &&
    (
      !isTextLikeLanguage ||
      (!isMetadataOnly && looksLikeCode(rawCode))
    );

  if (shouldTreatAsInline) {
    if (isHexScalar) {
      return <span className={styles.plainAddress}>{rawCode}</span>;
    }
    return <code className={styles.inlineCode}>{rawCode}</code>;
  }

  if (isHexScalar) {
    return <div className={styles.plainAddressBlock}>{rawCode}</div>;
  }

  if (!shouldRenderAsCodeBlock) {
    if (isMetadataOnly) {
      return (
        <span className={styles.metadataInlineGroup}>
          {lines.map((line) => (
            <span
              key={line}
              className={clsx(
                styles.inlineCode,
                isShortSingleLineMetadata && styles.metadataToken,
                styles[`metadataTone${getMetadataTone(line)[0].toUpperCase()}${getMetadataTone(line).slice(1)}`]
              )}
            >
              {line}
            </span>
          ))}
        </span>
      );
    }

    return <div className={styles.plainTextBlock}>{rawCode}</div>;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.language}>{language}</span>
        <button
          type="button"
          className={clsx(styles.copyButton, copied && styles.copyButtonSuccess)}
          onClick={handleCopy}
          title={copied ? 'Copied' : 'Copy code'}
          aria-label={copied ? 'Copied code' : 'Copy code'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language === 'text' ? undefined : language}
        style={resolvedTheme === 'light' ? lightSyntaxTheme : darkSyntaxTheme}
        customStyle={{}}
        className={styles.syntax}
        PreTag="div"
        wrapLongLines={false}
        codeTagProps={{ style: { fontFamily: 'inherit' } }}
      >
        {rawCode}
      </SyntaxHighlighter>
    </div>
  );
};
