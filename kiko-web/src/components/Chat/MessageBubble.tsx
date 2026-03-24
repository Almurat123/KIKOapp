import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  Link2,
  Share2,
  ThumbsDown,
  ThumbsUp,
  X as XIcon,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { toast } from 'sonner';
import clsx from 'clsx';
import { useThemeContext } from '../../contexts/ThemeContext';
import { preprocessMarkdown } from '../../utils/markdownUtils';
// DEPRECATED: SwapCardChat removed from chat interface (kept in WalletPage)
// import { SwapCardChat } from './SwapCardChat';
import { StrategyCard } from './StrategyCard';
import { UnifiedChartCard } from '../Chart/UnifiedChartCard';
import { TransactionStatusCard } from './TransactionStatusCard';
import { PlanCard } from './PlanCard';
import { ThinkingTimer } from './ThinkingTimer';
import { PolymarketEmbedCard } from './PolymarketEmbedCard';
import { TokenCapsule } from './TokenCapsule';
import { CitationRenderer } from './CitationRenderer';
import { XPostCard } from './XPostCard';
import { MarkdownCode } from './MarkdownCode';
import {
  getSourceDomain,
  getFaviconUrl,
  getSourceLogoProps,
  getSourceTitle,
  parseCitation,
} from '../../utils/sourceUtils';
import { logger } from '../../utils/logger';
import { chatApi } from '../../services/api';
import { calculateCost, formatCost } from '../../utils/llmPricing';
import styles from './Chat.module.css';
import type { Message } from '../../hooks/useConversations';

interface MessageBubbleProps {
  message: Message;
  isGrouped?: boolean;
  onContinue?: () => void;
  canContinue?: boolean;
  onCardAction?: (action: string, data: any) => void;
  userAddress?: string;
  chainId?: number;
  sessionId?: string;
  thinkingText?: string;
  thinkingStartTime?: number;
  modelId?: string;
  onFeedback?: (messageId: string, feedback: 'like' | 'dislike' | null) => void;
}

// Define components outside of render to prevent re-creation on every render
// This fixes the "flashing" and selection reset issues
const MarkdownComponents = {
  pre: ({ children }: any) => children,
  table: ({ node, ...props }: any) => (
    <div className={styles.markdownTableWrapper}>
      <table {...props} className={styles.markdownTable} />
    </div>
  ),
  img: ({ node, ...props }: any) => {
    return (
      <img
        {...props}
        className={clsx(styles.markdownImage, styles.markdownImageInline)}
        onClick={() => {
          if (props.src) {
            window.open(props.src, '_blank');
          }
        }}
      />
    );
  },
  a: ({ node, ...props }: any) => {
    const href = props.href || '';
    const childrenArray = React.Children.toArray(props.children);
    const textLabel = childrenArray
      .map((child) => (typeof child === 'string' ? child : ''))
      .join('')
      .trim();
    const isCompactFootnote = /^\[\d+\]$/.test(textLabel);
    const isRawUrlLabel = /^https?:\/\//i.test(textLabel);
    const footnoteNumber = textLabel.replace(/[^\d]/g, '');
    const resolvedLabel = (() => {
      if (isCompactFootnote) return footnoteNumber || textLabel;
      if (!textLabel || isRawUrlLabel || textLabel === href) return getSourceDomain(href);
      return textLabel;
    })();
    const icon = isCompactFootnote ? null : href.startsWith('http') ? (
      <img
        src={getFaviconUrl(getSourceDomain(href))}
        alt=""
        aria-hidden="true"
        className={styles.markdownLinkFavicon}
        onError={(event) => {
          const target = event.currentTarget;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement | null;
          if (fallback) {
            fallback.style.display = 'inline-flex';
          }
        }}
      />
    ) : null;
    const fallbackIcon = isCompactFootnote ? null : href.startsWith('http') ? (
      <Globe size={12} className={styles.markdownLinkIconFallback} />
    ) : (
      <Link2 size={12} className={styles.markdownLinkIconFallback} />
    );
    // Check for token capsule protocol
    if (href.startsWith('token://')) {
      const url = new URL(href);
      const address = url.hostname;
      const chainId = url.searchParams.get('chainId');
      return (
        <TokenCapsule
          address={address}
          symbol={props.children?.[0] || 'Token'}
          chainId={chainId ? parseInt(chainId) : undefined}
        />
      );
    }

    // Check if the link is likely an image
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(href);

    if (isImage) {
      return (
        <img
          src={props.href}
          alt={props.children?.[0] || 'Image'}
          className={clsx(styles.markdownImage, styles.markdownImageInline)}
          onClick={(e) => {
            e.preventDefault();
            window.open(props.href, '_blank');
          }}
        />
      );
    }

    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={clsx(
          styles.markdownLinkCapsule,
          isCompactFootnote && styles.markdownLinkCapsuleCompact,
          props.className
        )}
        title={href}
      >
        {icon}
        {fallbackIcon}
        <span className={styles.markdownLinkLabel}>{resolvedLabel}</span>
      </a>
    );
  },
  code: ({ inline, className, children }: any) => (
    <MarkdownCode inline={inline} className={className}>
      {children}
    </MarkdownCode>
  ),
};

// Memoized MessageBubble to prevent re-renders during streaming
const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  message,
  isGrouped,
  onContinue,
  canContinue,
  onCardAction,
  chainId,
  sessionId,
  thinkingText,
  thinkingStartTime,
  modelId,
  onFeedback,
}: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  const runtimePlan = !isUser
    ? message.data?.agentRuntime?.plan || (message.type === 'plan-card' ? message.data : null)
    : null;
  const hasRuntimeCard = !!runtimePlan;
  const hasInlineCard = !!(message.type && message.type !== 'text' && message.type !== 'plan-card' && message.data);
  const [copied, setCopied] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true); // 默认展开状态
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(message.feedback || null); // Initial state from message if available
  const { resolvedTheme } = useThemeContext();

  // elapsedTime variable removed as it is now handled by ThinkingTimer component

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFeedback = async (type: 'like' | 'dislike') => {
    if (!message.id || !sessionId) return;

    const newFeedback = feedback === type ? null : type;
    setFeedback(newFeedback); // Optimistic update

    // Notify parent to update local state immediately
    if (onFeedback) {
      onFeedback(message.id, newFeedback);
    }

    try {
      await chatApi.rateMessage(sessionId, message.id, newFeedback);
    } catch (error) {
      console.error('Failed to rate message:', error);
      setFeedback(feedback); // Revert on error
      if (onFeedback) {
        onFeedback(message.id, feedback); // Revert parent
      }
    }
  };

  // Render card inline if message has card type and data
  const renderCard = () => {
    if (isUser) return null;

    if (!message.type || !message.data) return null;

    switch (message.type) {
      // DEPRECATED: swap-card removed from chat interface (kept in WalletPage)
      // case 'swap-card': ...

      case 'strategy-card':
        return (
          <div className={styles.inlineCard}>
            <div className={styles.animFluid}>
              <div className={styles.cardContent}>
                <StrategyCard
                  strategy={message.data}
                  onEdit={(strategy) => onCardAction?.('strategy-edit', strategy)}
                  onDelete={(id) => onCardAction?.('strategy-delete', id)}
                  onToggleStatus={(id) => onCardAction?.('strategy-toggle', id)}
                />
              </div>
            </div>
          </div>
        );

      case 'chart-card':
        if (message.data) {
          return (
            <div className={styles.inlineCard}>
              <div className={styles.animFluid}>
                <div className={styles.cardContent}>
                  <UnifiedChartCard
                    chain={message.data.chain || 'ethereum'}
                    tokenAddress={message.data.tokenAddress || ''}
                  />
                </div>
              </div>
            </div>
          );
        }
        return null;

      case 'transaction-status-card':
        return (
          <div className={styles.inlineCard}>
            <div className={styles.animFluid}>
              <div className={styles.cardContent}>
                <TransactionStatusCard
                  status={message.data?.status || 'pending'}
                  txHash={message.data?.txHash}
                  tokenInSymbol={message.data?.tokenInSymbol}
                  tokenInLogoURI={message.data?.tokenInLogoURI}
                  tokenOutSymbol={message.data?.tokenOutSymbol}
                  tokenOutLogoURI={message.data?.tokenOutLogoURI}
                  amountIn={message.data?.amountIn}
                  amountOut={message.data?.amountOut}
                  amountInRaw={message.data?.amountInRaw}
                  amountOutRaw={message.data?.amountOutRaw}
                  tokenInDecimals={message.data?.tokenInDecimals}
                  tokenOutDecimals={message.data?.tokenOutDecimals}
                  chainId={message.data?.chainId || chainId}
                  errorMessage={message.data?.errorMessage || message.data?.error}
                  isLoading={message.data?.isLoading}
                />
              </div>
            </div>
          </div>
        );
      case 'polymarket-embed':
        return (
          <div className={styles.inlineCard}>
            <div className={styles.animFluid}>
              <div className={styles.cardContent}>
                <PolymarketEmbedCard
                  marketSlug={message.data?.market_slug || message.data?.slug}
                />
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderRuntimeCard = () => {
    if (!runtimePlan) return null;
    return (
      <div className={clsx(styles.inlineCard, styles.fullWidthInlineCard)}>
        <div className={clsx(styles.animFluid, styles.fullWidthAnimFluid)}>
          <div className={clsx(styles.cardContent, styles.fullWidthCardContent)}>
            <PlanCard
              plan={runtimePlan}
              reasoningText={message.reasoning_content}
              isStreaming={message.status !== 'complete' && message.status !== 'error'}
              messageStatus={message.status}
            />
          </div>
        </div>
      </div>
    );
  };

  const hasThinkingPlaceholder =
    !isUser &&
    !!thinkingText &&
    (!message.content || message.content.trim().length === 0) &&
    (!message.reasoning_content || message.reasoning_content.trim().length === 0);

  const hasVisibleContent =
    (message.content && message.content.trim().length > 0) ||
    (message.reasoning_content && message.reasoning_content.trim().length > 0) ||
    hasInlineCard ||
    hasRuntimeCard;

  return (
    <div
      className={clsx(
        styles.messageRow,
        isUser ? styles.userRow : styles.aiRow,
        isGrouped && styles.groupedRow,
        resolvedTheme
      )}
    >
      <div className={styles.messageContentWrapper}>
        {!isUser && !isGrouped && (
          <div className={styles.senderName}>
            {/* Show name when we have content OR reasoning */}
            {hasVisibleContent && (
              <>
                KIKO
                <span className={styles.timestamp}>{message.timestamp}</span>
              </>
            )}
            {/* Thinking标签显示 */}
            {message.reasoning_content && !hasInlineCard && !hasRuntimeCard && (
              <>
                {(!message.content || message.content.trim().length === 0) &&
                message.status !== 'complete' ? (
                  // 思考中：显示shimmer Thinking标签 + 计时器 + 当前状态
                  <ThinkingTimer
                    startTime={thinkingStartTime || Date.now()}
                    status="thinking"
                    text={thinkingText}
                  />
                ) : (
                  // 思考完成：显示可展开的Thinking按钮
                  <ThinkingTimer
                    startTime={
                      thinkingStartTime ||
                      (message.timestamp ? new Date(message.timestamp).getTime() : Date.now())
                    }
                    status="complete"
                    text={thinkingText || 'Thinking'}
                    expanded={showReasoning}
                    onToggle={() => setShowReasoning(!showReasoning)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Only render bubble if there is visible content or it's a user message */}
        {(isUser || hasVisibleContent || hasThinkingPlaceholder) && (
          <div
            className={clsx(
              styles.bubble,
              isUser ? styles.userBubble : styles.aiBubble,
              resolvedTheme
            )}
          >
            {isUser ? (
              message.content
            ) : (
              <>
                {renderRuntimeCard()}
                {/* Waiting for first content - show thinkingText animation */}
                {thinkingText &&
                  !message.content &&
                  !message.reasoning_content &&
                  !hasInlineCard &&
                  !hasRuntimeCard && (
                    <div className={styles.thinkingBubble}>
                      <span className={styles.thinkingText}>
                        <ThinkingTimer
                          startTime={thinkingStartTime || Date.now()}
                          status="thinking"
                          text={thinkingText}
                        />
                      </span>
                    </div>
                  )}

                {/* Thinking进行中（无content）：在bubble内显示思考内容 */}
                {message.reasoning_content &&
                  (!message.content || message.content.trim().length === 0) &&
                  !hasInlineCard &&
                  !hasRuntimeCard && (
                    <div className={styles.markdownContent}>
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={MarkdownComponents}
                      >
                        {preprocessMarkdown(message.reasoning_content)}
                      </ReactMarkdown>
                    </div>
                  )}

                {/* Thinking完成（有content）：显示思考内容（如果展开） */}
                {message.reasoning_content &&
                  message.content &&
                  message.content.trim().length > 0 &&
                  !hasRuntimeCard &&
                  showReasoning && (
                    <div className={styles.reasoningContent}>
                      <div className={`${styles.reasoningText} ${styles.markdownContent}`}>
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={MarkdownComponents}
                        >
                          {preprocessMarkdown(message.reasoning_content)}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                {message.content && (
                  <div
                    className={clsx(
                      styles.markdownContent,
                      styles.markdownContentSelectable,
                      styles.markdownContainer
                    )}
                    onMouseDown={(e) => {
                      // Allow text selection by not preventing default
                      e.stopPropagation();
                    }}
                    onMouseUp={(e) => {
                      // Prevent any parent handlers from clearing selection
                      e.stopPropagation();
                    }}
                  >
                    {/* Use simple ReactMarkdown without custom components to enable text selection */}
                    <CitationRenderer
                      content={message.content}
                      citations={message.citations || []}
                      components={MarkdownComponents}
                    />
                  </div>
                )}
                {/* Render card inline after content */}
                {renderCard()}
              </>
            )}
          </div>
        )}

        {/* Hover Actions - Only show if hasVisibleContent and (regular text or no type) */}
        {hasVisibleContent && (!message.type || message.type === 'text') && (
          <div className={clsx(styles.actions, isUser ? styles.userActions : styles.aiActions)}>
            <button className={styles.actionBtn} onClick={handleCopy} title="Copy">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {!isUser && (
              <>
                <button
                  className={clsx(styles.actionBtn, feedback === 'like' && styles.actionBtnActive)}
                  title="Like"
                  onClick={() => handleFeedback('like')}
                >
                  <ThumbsUp
                    size={14}
                    className={feedback === 'like' ? styles.iconActive : ''}
                    fill={feedback === 'like' ? 'currentColor' : 'none'}
                  />
                </button>
                <button
                  className={clsx(
                    styles.actionBtn,
                    feedback === 'dislike' && styles.actionBtnActive
                  )}
                  title="Dislike"
                  onClick={() => handleFeedback('dislike')}
                >
                  <ThumbsDown
                    size={14}
                    className={feedback === 'dislike' ? styles.iconActive : ''}
                    fill={feedback === 'dislike' ? 'currentColor' : 'none'}
                  />
                </button>
                <button
                  className={styles.actionBtn}
                  title="Share"
                  onClick={() => {
                    // Simple share: copy message content for now, or specific link if available
                    navigator.clipboard.writeText(message.content);
                    toast.success('Message copied!');
                  }}
                >
                  <Share2 size={14} />
                </button>
              </>
            )}

            {/* Token Usage - Cost Display */}
            {!isUser && message.usage && (
              <div
                className={styles.tokenUsage}
                title={`Total: ${message.usage.total_tokens} tokens (Prompt: ${message.usage.prompt_tokens}, Completion: ${message.usage.completion_tokens})`}
              >
                <Flame size={13} className={styles.tokenIcon} />
                {(() => {
                  const cost = calculateCost(
                    modelId,
                    message.usage.prompt_tokens,
                    message.usage.completion_tokens,
                    message.tool_calls || 0
                  );
                  return <span>{formatCost(cost.amount, cost.currency)}</span>;
                })()}
              </div>
            )}

            {/* Sources Button - Single button with icon and count */}
            {(() => {
              const hasCitations = !isUser && message.citations && message.citations.length > 0;
              return hasCitations;
            })() && (
              <button
                className={styles.sourcesButton}
                onClick={() => setShowCitations(true)}
                title={`View all ${message.citations!.length} sources`}
              >
                <div className={styles.sourcesButtonIcons}>
                  {message.citations!.slice(0, 3).map((citation, index) => {
                    const logoProps = getSourceLogoProps(citation);
                    return (
                      <div
                        key={index}
                        className={clsx(styles.sourceIconCircle, styles.sourceIconZIndex)}
                        style={{ zIndex: 3 - index }}
                      >
                        {logoProps.avatarUrl ? (
                          <img
                            src={logoProps.avatarUrl}
                            alt={logoProps.domain}
                            className={styles.sourceLogoCircle}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent && !parent.querySelector('svg')) {
                                const icon = document.createElementNS(
                                  'http://www.w3.org/2000/svg',
                                  'svg'
                                );
                                icon.setAttribute('width', '14');
                                icon.setAttribute('height', '14');
                                icon.setAttribute('viewBox', '0 0 24 24');
                                icon.setAttribute('fill', 'none');
                                icon.setAttribute('stroke', 'currentColor');
                                icon.setAttribute('stroke-width', '2');
                                const path = document.createElementNS(
                                  'http://www.w3.org/2000/svg',
                                  'path'
                                );
                                path.setAttribute(
                                  'd',
                                  'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3'
                                );
                                icon.appendChild(path);
                                parent.appendChild(icon);
                              }
                            }}
                          />
                        ) : logoProps.isX ? (
                          <XIcon size={14} />
                        ) : (
                          <ExternalLink size={14} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <span className={styles.sourcesButtonText}>
                  {message.citations!.length} sources
                </span>
              </button>
            )}
          </div>
        )}

        {/* Sources Sidebar - Use React Portal for proper z-index */}
        {showCitations &&
        message.citations &&
        message.citations.length > 0 &&
        typeof document !== 'undefined'
          ? createPortal(
              <div className={clsx(styles.portalRoot, resolvedTheme)}>
                <div
                  className={styles.sourcesSidebarOverlay}
                  onClick={() => setShowCitations(false)}
                />
                <div className={styles.sourcesSidebar}>
                  <div className={styles.sourcesSidebarHeader}>
                    <h4>Sources</h4>
                    <button
                      onClick={() => setShowCitations(false)}
                      className={styles.sourcesSidebarClose}
                    >
                      <XIcon size={20} />
                    </button>
                  </div>
                  <div className={styles.sourcesSidebarList}>
                    {message.citations.map((citation, index) => {
                      const parsedCitation: any = parseCitation(citation);

                      const logoProps = getSourceLogoProps(parsedCitation);
                      const validUrl = logoProps.url;
                      // Use provided title or fallback to source title utility (usually domain/name)
                      const title = parsedCitation.title || getSourceTitle(validUrl);
                      const domain = logoProps.domain;
                      // Try to find a description/snippet
                      const description =
                        parsedCitation.snippet ||
                        parsedCitation.content ||
                        parsedCitation.description;

                      // Use XPostCard for X/Twitter posts
                      if (logoProps.isX) {
                        return (
                          <XPostCard key={index} url={validUrl} avatarUrl={logoProps.avatarUrl} />
                        );
                      }

                      // Regular source card for non-X posts
                      return (
                        <a
                          key={index}
                          href={validUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.sourcesSidebarItem}
                          onClick={(e) => {
                            // Ensure external link opens correctly - prevent any router interception
                            e.stopPropagation();
                            e.preventDefault();
                            if (validUrl && validUrl.startsWith('http')) {
                              window.open(validUrl, '_blank', 'noopener,noreferrer');
                            } else {
                              logger.error(
                                '[MessageBubble] Invalid URL for window.open:',
                                validUrl
                              );
                            }
                          }}
                        >
                          <div className={styles.sourcesSidebarItemIcon}>
                            {logoProps.avatarUrl ? (
                              <img
                                src={logoProps.avatarUrl}
                                alt={domain}
                                className={styles.sourcesSidebarLogo}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector('svg')) {
                                    const icon = document.createElementNS(
                                      'http://www.w3.org/2000/svg',
                                      'svg'
                                    );
                                    icon.setAttribute('width', '18');
                                    icon.setAttribute('height', '18');
                                    icon.setAttribute('viewBox', '0 0 24 24');
                                    icon.setAttribute('fill', 'none');
                                    icon.setAttribute('stroke', 'currentColor');
                                    icon.setAttribute('stroke-width', '2');
                                    const path = document.createElementNS(
                                      'http://www.w3.org/2000/svg',
                                      'path'
                                    );
                                    path.setAttribute(
                                      'd',
                                      'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3'
                                    );
                                    icon.appendChild(path);
                                    parent.appendChild(icon);
                                  }
                                }}
                              />
                            ) : (
                              <ExternalLink size={18} />
                            )}
                          </div>
                          <div className={styles.sourcesSidebarItemContent}>
                            <div className={styles.sourcesSidebarItemText}>
                              <div className={styles.sourcesSidebarItemTitle}>{title}</div>
                              <div className={styles.sourcesSidebarItemUrl}>{domain}</div>
                              {description && (
                                <div className={styles.sourcesSidebarItemDescription}>
                                  {description}
                                </div>
                              )}
                            </div>
                          </div>
                          <ExternalLink size={14} className={styles.sourcesSidebarItemArrow} />
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {/* Continue Generation Button */}
        {canContinue && onContinue && !isUser && (
          <div className={styles.continueWrapper}>
            <button className={styles.continueBtn} onClick={onContinue}>
              Continue generating
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Custom comparison function to prevent unnecessary re-renders
const areEqual = (prevProps: MessageBubbleProps, nextProps: MessageBubbleProps) => {
  // Only re-render if message content actually changed
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.reasoning_content === nextProps.message.reasoning_content &&
    prevProps.message.type === nextProps.message.type && // CRITICAL: Compare type for card updates
    JSON.stringify(prevProps.message.data) === JSON.stringify(nextProps.message.data) && // CRITICAL: Compare data for card updates
    JSON.stringify(prevProps.message.usage) === JSON.stringify(nextProps.message.usage) &&
    JSON.stringify(prevProps.message.citations) === JSON.stringify(nextProps.message.citations) &&
    prevProps.isGrouped === nextProps.isGrouped &&
    prevProps.canContinue === nextProps.canContinue &&
    prevProps.chainId === nextProps.chainId &&
    prevProps.thinkingText === nextProps.thinkingText &&
    prevProps.thinkingStartTime === nextProps.thinkingStartTime
  );
};

// Export memoized version to prevent re-renders when parent updates
export const MessageBubble = React.memo(MessageBubbleComponent, areEqual);
