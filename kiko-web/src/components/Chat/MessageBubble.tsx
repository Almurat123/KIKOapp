import React, { useState } from 'react';
import { Copy, ThumbsUp, ThumbsDown, MoreHorizontal, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import clsx from 'clsx';
import styles from './Chat.module.css';

interface MessageBubbleProps {
    message: {
        id: string;
        role: 'user' | 'ai';
        content: string;
        timestamp: string;
    };
    isGrouped?: boolean;
    onContinue?: () => void;
    canContinue?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isGrouped, onContinue, canContinue }) => {
    const isUser = message.role === 'user';
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className={clsx(
            styles.messageRow,
            isUser ? styles.userRow : styles.aiRow,
            isGrouped && styles.groupedRow
        )}>
            {!isUser && !isGrouped && (
                <div className={styles.avatar}>
                    <div className={styles.aiAvatarIcon} />
                </div>
            )}
            {!isUser && isGrouped && <div className={styles.avatarPlaceholder} />}

            <div className={styles.messageContentWrapper}>
                {!isUser && !isGrouped && <div className={styles.senderName}>KIKO AI <span className={styles.timestamp}>{message.timestamp}</span></div>}

                <div className={clsx(styles.bubble, isUser ? styles.userBubble : styles.aiBubble)}>
                    {isUser ? (
                        message.content
                    ) : (
                        <div className={styles.markdownContent}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                p: ({ children }) => <p className={styles.markdownParagraph}>{children}</p>,
                                h1: ({ children }) => <h1 className={styles.markdownH1}>{children}</h1>,
                                h2: ({ children }) => <h2 className={styles.markdownH2}>{children}</h2>,
                                h3: ({ children }) => <h3 className={styles.markdownH3}>{children}</h3>,
                                h4: ({ children }) => <h4 className={styles.markdownH4}>{children}</h4>,
                                strong: ({ children }) => <strong className={styles.markdownStrong}>{children}</strong>,
                                em: ({ children }) => <em className={styles.markdownEm}>{children}</em>,
                                ul: ({ children }) => <ul className={styles.markdownList}>{children}</ul>,
                                ol: ({ children }) => <ol className={styles.markdownList}>{children}</ol>,
                                li: ({ children }) => <li className={styles.markdownListItem}>{children}</li>,
                                code: ({ inline, className, children, ...props }) => {
                                    if (inline) {
                                        return <code className={styles.markdownInlineCode} {...props}>{children}</code>;
                                    }
                                    return (
                                        <code className={styles.markdownCodeBlock} {...props}>
                                            {children}
                                        </code>
                                    );
                                },
                                pre: ({ children }) => <pre className={styles.markdownPre}>{children}</pre>,
                                blockquote: ({ children }) => <blockquote className={styles.markdownBlockquote}>{children}</blockquote>,
                                table: ({ children }) => <table className={styles.markdownTable}>{children}</table>,
                                thead: ({ children }) => <thead className={styles.markdownTableHead}>{children}</thead>,
                                tbody: ({ children }) => <tbody className={styles.markdownTableBody}>{children}</tbody>,
                                tr: ({ children }) => <tr className={styles.markdownTableRow}>{children}</tr>,
                                th: ({ children }) => <th className={styles.markdownTableHeader}>{children}</th>,
                                td: ({ children }) => <td className={styles.markdownTableCell}>{children}</td>,
                                hr: () => <hr className={styles.markdownHr} />,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    )}
                </div>

                {/* Hover Actions */}
                <div className={clsx(styles.actions, isUser ? styles.userActions : styles.aiActions)}>
                    <button className={styles.actionBtn} onClick={handleCopy} title="Copy">
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    {!isUser && (
                        <>
                            <button className={styles.actionBtn} title="Good response">
                                <ThumbsUp size={14} />
                            </button>
                            <button className={styles.actionBtn} title="Bad response">
                                <ThumbsDown size={14} />
                            </button>
                        </>
                    )}
                    <button className={styles.actionBtn} title="More">
                        <MoreHorizontal size={14} />
                    </button>
                </div>

                {/* Continue Generation Button */}
                {canContinue && onContinue && !isUser && (
                    <div className={styles.continueWrapper}>
                        <button className={styles.continueBtn} onClick={onContinue}>
                            Continue generating
                        </button>
                    </div>
                )}
            </div>

            {isUser && !isGrouped && (
                <div className={styles.avatar}>
                    <div className={styles.userAvatarIcon} />
                </div>
            )}
            {isUser && isGrouped && <div className={styles.avatarPlaceholder} />}
        </div>
    );
};
