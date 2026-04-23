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
import { preprocessMarkdown, stripMarkdownTableArtifacts } from '../../utils/markdownUtils';
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
import { ChatAttachmentTray } from './ChatAttachmentTray';
import { XPostCard } from './XPostCard';
import { MarkdownCode } from './MarkdownCode';
import { StructuredRenderBlock } from './StructuredRenderBlock';
import { GeneratedImageMessage } from './GeneratedImageMessage';
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
// CONTEXT MEMORY
// Updated: 2026-04-22
// Author: Rowan
// Reason: runtime plan cards and assistant reasoning were previously rendered
//         reasoning area. A later streaming review also showed that the bubble
//         was reparsing markdown on every incoming chunk, while the interim
//         reveal style also changed the apparent chunk timing instead of only
//         restyling it. The first fade pass was accidentally gated off for normal
//         agent messages because runtime plan cards are attached to the same
//         assistant message, so streaming text must be allowed to animate even
//         when a runtime card is present above it. Streaming diagnostics now
//         also log render-layer segment counts to prove whether chunks reached
//         the bubble incrementally or after frontend coalescing. A follow-up
//         streaming pass also showed that reasoning text should stay visible
//         while the answer is still streaming, instead of hiding behind the
//         collapse toggle as soon as content begins to appear. Runtime testing
//         on 2026-04-17 showed the internal plan card itself was being mistaken
//         for the assistant answer because hard-coded orchestration labels were
//         rendered in the transcript before normal content. A follow-up rollback
//         on 2026-04-18 confirmed the opacity-fade streaming path had replaced
//         live Markdown/citation rendering with plain text span chunks, which
//         broke streaming-time line breaks, lists, and code formatting.
//         Generated-image replies now also render inside this owner, so bubble
//         visibility rules must treat `generated-image` as first-class assistant
//         content instead of hiding it behind text-only heuristics. Product
//         direction later restored runtime plan cards to the normal transcript:
//         the plan must stay visible when backend runtime state exists, but it
//         still must not consume assistant reasoning or final-answer ownership.
//         Runtime transcripts then showed internal warmup scaffolds such as
//         "理解请求" and "生成回答" appearing next to normal answers, so this
//         owner now keeps the old always-render card behavior but normalizes
//         low-quality scaffold copy before it reaches PlanCard.
// Goal: keep runtime plan progress separate from assistant reasoning while
//       showing both in the normal transcript. The message bubble owns
//       user-visible assistant text, generated-image replies, and live thinking
//       content. Streaming answers must preserve the original Markdown and
//       citation render path instead of swapping to plain-text chunk spans.
// Owns: assistant message presentation, runtime-card placement, and reasoning
//       visibility rules inside the chat transcript.
// Does Not Own: broker event routing, plan generation, or model stream parsing.
// Design Language:
// - runtime plan cards show execution structure when runtime state exists
// - plan cards are not assistant answers and must not absorb raw model reasoning
// - reasoning content stays attached to the assistant message surface
// - runtime cards must not suppress legitimate reasoning visibility
// - streaming text must preserve the same Markdown, citation, and newline semantics as the completed message
// - do not split streaming assistant text into plain span segments that bypass Markdown rendering
// - live reasoning should stay visible during streaming even when answer text has started
// - internal orchestration labels such as "Understand the request" must not appear as normal chat replies
// - generated-image replies count as visible assistant content even when text is empty
// - runtime plans persist across refresh and must render whenever backend state exists
// - internal or generic warmup copy must be normalized before it renders as product copy
// Document Provenance:
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: separating runtime plan rendering from live reasoning rendering
// - Verification: verified in code
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: enabling fade-in streaming on messages that also carry runtime plans
// - Verification: verified in runtime
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: adding render-boundary stream diagnostics for non-streaming reports
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/test.txt
// - Kind: runtime observation
// - Retrieved: 2026-04-16
// - Applied To: showing reasoning content inline during active streaming
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/kiko-web/src/layouts/RootLayout.tsx and /Users/almurat/KiKo/kiko-api/src/jobs/chat/streamBroker.ts
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: confirming reasoning and runtime snapshots arrive on the same assistant message id
// - Verification: verified in code
// - Source: operator runtime transcript showing plan labels rendered before answers
// - Kind: runtime observation
// - Retrieved: 2026-04-17
// - Applied To: hiding `agentRuntime.plan` from normal transcript rendering unless debug is explicitly enabled
// - Verification: verified in code and targeted build
// - Source: git show 754ec8b6^:kiko-web/src/components/Chat/MessageBubble.tsx
// - Kind: repo doc
// - Retrieved: 2026-04-18
// - Applied To: restoring the pre-fade streaming render path that kept CitationRenderer/ReactMarkdown active while streaming
// - Verification: verified in code
// - Source: operator report that streaming text was animating character-by-character and losing Markdown line breaks
// - Kind: runtime observation
// - Retrieved: 2026-04-18
// - Applied To: removing the plain-text streaming fade path
// - Verification: partially verified
// - Source: operator request on 2026-04-18 to render generated-image replies inside chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: treating `generated-image` rows as visible assistant content in the bubble owner
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18 to restore visible runtime plan cards in normal chat
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: removing the debug-only visibility gate from runtime plan cards
// - Verification: verified in code
// - Source: operator runtime transcript showing warmup plan labels rendered as
//           answer-adjacent copy
// - Kind: runtime observation
// - Retrieved: 2026-04-18
// - Applied To: normalizing internal/generic runtime plan scaffolds without hiding the card
// - Verification: verified in code and targeted tests
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/runtime-plan-visibility.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/chat-runtime-planning.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-streaming-markdown-restore.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-plan-card-internal-scaffold-filter.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-runtime-plan-user-visible-hardcoding-fix.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-runtime-plan-card-reasoning-separation.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-streaming-opacity-fade.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-stream-diagnostics.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-chat-execution-and-ui.md
// - /Users/almurat/KiKo/system-journal/conflicts.md

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

type UserImageAttachment = {
  id: string;
  previewUrl: string;
  name: string;
};

function normalizeRuntimePlanForDisplay(plan: any): any {
  if (!plan || typeof plan !== 'object') return null;
  const locale = String(plan.locale || '')
    .toLowerCase()
    .startsWith('zh')
    ? 'zh'
    : 'en';
  const isZh = locale === 'zh';
  const normalizeTitle = (value: any) => {
    const text = String(value || '').trim();
    if (
      !text ||
      text === '正在处理你的请求' ||
      text === '处理请求' ||
      text === 'Working on your request'
    ) {
      return isZh ? '任务进度' : 'Task progress';
    }
    return text;
  };
  const normalizeSummary = (value: any) => {
    const text = String(value || '').trim();
    if (
      text === '我会逐步查看信息并在拿到结果后继续。' ||
      text === '我会先确认你现在想让我做什么，再继续给出结果。' ||
      text === 'I will inspect the task step by step and continue as results come in.'
    ) {
      return '';
    }
    return text;
  };
  const normalizeStepTitle = (step: any) => {
    const id = String(step?.id || '');
    const title = String(step?.title || '').trim();
    if (id === 'step-understand' || title === '理解请求' || title === 'Understand the request') {
      return isZh ? '分析请求' : 'Analyze request';
    }
    if (id === 'step-summary' || title === '生成回答' || title === 'Generate answer') {
      return isZh ? '整理回答' : 'Draft response';
    }
    return title;
  };
  const normalizeStepDescription = (step: any) => {
    const id = String(step?.id || '');
    const description = String(step?.description || '').trim();
    if (
      id === 'step-understand' &&
      /先(快速)?(判断|明确)|Clarify|Quickly determine/i.test(description)
    ) {
      return '';
    }
    if (id === 'step-summary' && /给出回答|Answer once|Answer from/i.test(description)) {
      return '';
    }
    return description;
  };

  return {
    ...plan,
    title: normalizeTitle(plan.title),
    summary: normalizeSummary(plan.summary),
    steps: Array.isArray(plan.steps)
      ? plan.steps.map((step: any) => ({
          ...step,
          title: normalizeStepTitle(step),
          description: normalizeStepDescription(step),
        }))
      : [],
  };
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
  const rawRuntimePlan = !isUser
    ? message.data?.agentRuntime?.plan || (message.type === 'plan-card' ? message.data : null)
    : null;
  const runtimePlan = normalizeRuntimePlanForDisplay(rawRuntimePlan);
  const hasRuntimeCard = !!runtimePlan;
  const hasInlineCard = !!(
    message.type &&
    message.type !== 'text' &&
    message.type !== 'plan-card' &&
    message.data
  );
  const [copied, setCopied] = useState(false);
  const [showCitations, setShowCitations] = useState(false);
  const [showReasoning, setShowReasoning] = useState(true); // 默认展开状态
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(message.feedback || null); // Initial state from message if available
  const { resolvedTheme } = useThemeContext();
  const userAttachments: UserImageAttachment[] = Array.isArray(message.data?.attachments)
    ? message.data.attachments.filter(
        (attachment: any) =>
          attachment &&
          typeof attachment.previewUrl === 'string' &&
          typeof attachment.name === 'string'
      )
    : [];

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
                <PolymarketEmbedCard marketSlug={message.data?.market_slug || message.data?.slug} />
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

  const renderContracts = Array.isArray(message.data?.renderContracts)
    ? message.data.renderContracts
    : message.data?.renderContract
      ? [message.data.renderContract]
      : [];
  const generatedImagePayload =
    message.type === 'generated-image' ? message.data?.generatedImage : null;
  const hasGeneratedImageContent = Boolean(
    generatedImagePayload &&
    ((Array.isArray(generatedImagePayload.images) && generatedImagePayload.images.length > 0) ||
      String(generatedImagePayload.status || '').trim().length > 0 ||
      String(generatedImagePayload.errorMessage || '').trim().length > 0)
  );
  const hasStructuredRender = renderContracts.length > 0;
  const hasVisibleContent =
    (message.content && message.content.trim().length > 0) ||
    (message.reasoning_content && message.reasoning_content.trim().length > 0) ||
    hasGeneratedImageContent ||
    hasStructuredRender ||
    hasInlineCard ||
    hasRuntimeCard;
  const renderedContent = hasStructuredRender
    ? stripMarkdownTableArtifacts(message.content || '')
    : message.content || '';

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
            {message.reasoning_content && !hasInlineCard && (
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
              <>
                <ChatAttachmentTray
                  attachments={userAttachments}
                  compact
                  className={styles.userAttachmentTray}
                />
                {message.content}
              </>
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
                  !hasInlineCard && (
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
                  (message.status !== 'complete' || showReasoning) && (
                    <div
                      className={styles.reasoningContent}
                      data-kiko-message-selection-target="true"
                    >
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
                {hasStructuredRender && (
                  <div className={styles.markdownContent}>
                    <StructuredRenderBlock contracts={renderContracts} />
                  </div>
                )}
                {generatedImagePayload && <GeneratedImageMessage payload={generatedImagePayload} />}
                {renderedContent && (
                  <div
                    className={clsx(
                      styles.markdownContent,
                      styles.markdownContentSelectable,
                      styles.markdownContainer
                    )}
                    data-kiko-message-selection-target="true"
                  >
                    <CitationRenderer
                      content={renderedContent}
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
                <Flame
                  size={13}
                  className={styles.tokenIcon}
                  color="#f97316"
                  fill="currentColor"
                  stroke="currentColor"
                />
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
