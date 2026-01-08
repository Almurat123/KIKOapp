import React, { useState, useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
          if (url.includes('twitter.com') || url.includes('x.com')) {
            previews[i + 1] = `X (Twitter) post: ${url}`;
            continue;
          }

          try {
            const domain = new URL(url).hostname;
            previews[i + 1] = `Source: ${domain}`;
          } catch {
            previews[i + 1] = url;
          }
        } catch (error) {
          previews[i + 1] = getCitationUrl(citations[i]);
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

  const citationPattern = /\[(\d+)\]/g;

  // Simple render if no citations to avoid complexity
  if (citations.length === 0 || !citationPattern.test(content)) {
    return (
      <div className={clsx(styles.citationContainer, className)}>
        <ReactMarkdown
          components={components}
          remarkPlugins={[remarkGfm]}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  // Complex render with citations
  const renderWithCitations = () => {
    const parts: (string | React.ReactElement)[] = [];
    let lastIndex = 0;
    let match;

    citationPattern.lastIndex = 0;

    while ((match = citationPattern.exec(content)) !== null) {
      const citationIndex = parseInt(match[1], 10);
      const citation = citations[citationIndex - 1];
      const citationUrl = getCitationUrl(citation);

      if (match.index > lastIndex) {
        const textPart = content.substring(lastIndex, match.index);
        parts.push(
          <ReactMarkdown
            key={`text-${lastIndex}`}
            components={{
              ...components,
              p: React.Fragment // Render text segments without wrapping in <p> to avoid block breaks
            }}
            remarkPlugins={[remarkGfm]}
          >
            {textPart}
          </ReactMarkdown>
        );
      }

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
        parts.push(
          <sup key={`citation-${match.index}`} className={styles.citation}>
            [{citationIndex}]
          </sup>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(
        <ReactMarkdown
          key={`text-${lastIndex}`}
          components={{
            ...components,
            p: React.Fragment // Render text segments without wrapping in <p> to avoid block breaks
          }}
          remarkPlugins={[remarkGfm]}
        >
          {content.substring(lastIndex)}
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
