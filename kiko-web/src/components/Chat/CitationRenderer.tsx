import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import clsx from 'clsx';
import type { Citation } from '../../utils/sourceUtils';
import { preprocessMarkdown } from '../../utils/markdownUtils';
import styles from './CitationRenderer.module.css';

interface CitationRendererProps {
  content: string;
  citations?: Citation[];
  className?: string;
  components?: any; // Custom components for ReactMarkdown
}

export const CitationRenderer: React.FC<CitationRendererProps> = ({
  content,
  citations = [],
  className,
  components,
}) => {
  const processedContent = preprocessMarkdown(content, citations);
  const hasCitations = citations.length > 0;

  return (
    <div
      className={clsx(styles.citationContainer, className)}
      data-has-citations={hasCitations ? 'true' : 'false'}
    >
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm, remarkBreaks]}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
