import React, { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import clsx from 'clsx';
import type { Citation } from '../../utils/sourceUtils';
import { getCitationUrl } from '../../utils/sourceUtils';
import styles from './CitationRenderer.module.css';

interface CitationRendererProps {
  content: string;
  citations?: Citation[];
  className?: string;
  components?: any; // Custom components for ReactMarkdown
}

/**
 * Renders content with inline citations, similar to Grok.com
 * Supports hover previews and click-to-open links
 */
// Hook to fetch citation previews
export const useCitationPreviews = (citations: Citation[]) => {
  const [citationPreviews, setCitationPreviews] = useState<Record<number, string>>({});

  useEffect(() => {
    if (citations.length === 0) return;

    const fetchPreviews = async () => {
      const previews: Record<number, string> = {};

      for (let i = 0; i < citations.length; i++) {
        try {
          const citation = citations[i];
          const url = getCitationUrl(citation);
          // For X/Twitter URLs, use a special preview
          if (url.includes('twitter.com') || url.includes('x.com')) {
            previews[i + 1] = `X (Twitter) post: ${url}`;
            continue;
          }

          // For other URLs, try to fetch page title
          // Note: This requires CORS support or a proxy
          // For now, just use the URL domain
          try {
            const domain = new URL(url).hostname;
            previews[i + 1] = `Source: ${domain}`;
          } catch {
            previews[i + 1] = url;
          }
        } catch (error) {
          // Fallback to URL
          const citation = citations[i];
          previews[i + 1] = getCitationUrl(citation);
        }
      }

      setCitationPreviews(previews);
    };

    fetchPreviews();
  }, [citations]);

  return citationPreviews;
};

export const CitationRenderer: React.FC<CitationRendererProps> = ({
  content,
  citations = [],
  className,
  components
}) => {
  const [hoveredCitation, setHoveredCitation] = useState<number | null>(null);
  const citationPreviews = useCitationPreviews(citations);

  // Check if content contains citation markers like [1], [2], etc.
  const citationPattern = /\[(\d+)\]/g;
  const hasCitations = citations.length > 0 && citationPattern.test(content);


  // Render content with clickable citation links
  const renderWithCitations = () => {
    if (!hasCitations) {
      return <span>{content}</span>;
    }

    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    // Reset regex
    citationPattern.lastIndex = 0;

    while ((match = citationPattern.exec(content)) !== null) {
      const citationIndex = parseInt(match[1], 10);
      const citation = citations[citationIndex - 1]; // Citations are 1-indexed
      const citationUrl = getCitationUrl(citation);

      // Add text before citation (rendered as Markdown)
      if (match.index > lastIndex) {
        const textPart = content.substring(lastIndex, match.index);
        parts.push(
          <ReactMarkdown
            key={`text-${lastIndex}`}
            components={components || {
              p: ({ children }: any) => <span className={styles.inlineMarkdown}>{children}</span>,
              blockquote: ({ children }: any) => <blockquote className={styles.markdownBlockquote}>{children}</blockquote>,
              strong: ({ children }: any) => <strong>{children}</strong>,
              em: ({ children }: any) => <em>{children}</em>,
              a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
            }}
          >
            {textPart}
          </ReactMarkdown>
        );
      }

      // Add citation link
      if (citationUrl) {
        const isXPost = citationUrl.includes('twitter.com') || citationUrl.includes('x.com');
        parts.push(
          <sup
            key={`citation-${match.index}`}
            className={clsx(styles.citation, isXPost && styles.xCitation)}
          >
            <a
              href={citationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.citationLink}
              onMouseEnter={() => setHoveredCitation(citationIndex)}
              onMouseLeave={() => setHoveredCitation(null)}
              title={citationPreviews[citationIndex] || citationUrl}
            >
              [{citationIndex}]
            </a>
            {hoveredCitation === citationIndex && (
              <div className={styles.citationTooltip}>
                <div className={styles.citationTooltipContent}>
                  {isXPost ? (
                    <div className={styles.xPostPreview}>
                      <X size={16} />
                      <span>X (Twitter) Post</span>
                    </div>
                  ) : (
                    <div className={styles.webPreview}>
                      <ExternalLink size={14} />
                      <span>{citationPreviews[citationIndex] || citationUrl}</span>
                    </div>
                  )}
                  <a
                    href={citationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.citationTooltipLink}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open source
                  </a>
                </div>
              </div>
            )}
          </sup>
        );
      } else {
        // Citation index out of range, just show the number
        parts.push(
          <sup key={`citation-${match.index}`} className={styles.citation}>
            [{citationIndex}]
          </sup>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      const textPart = content.substring(lastIndex);
      parts.push(
        <ReactMarkdown
          key={`text-${lastIndex}`}
          components={components || {
            p: ({ children }: any) => <span className={styles.inlineMarkdown}>{children}</span>,
            blockquote: ({ children }: any) => <blockquote className={styles.markdownBlockquote}>{children}</blockquote>,
            strong: ({ children }: any) => <strong>{children}</strong>,
            em: ({ children }: any) => <em>{children}</em>,
            a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          }}
        >
          {textPart}
        </ReactMarkdown>
      );
    }

    return <>{parts}</>;
  };

  return (
    <div className={clsx(styles.citationContainer, className)}>
      {renderWithCitations()}
    </div>
  );
};

