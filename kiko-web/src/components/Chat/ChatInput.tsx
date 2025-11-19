import React, { useState } from 'react';
import { Send, Paperclip, Sparkles } from 'lucide-react';
import styles from './Chat.module.css';

interface ChatInputProps {
    onSend: (text: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim()) return;
        onSend(input);
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles.inputContainer}>
            <div className={styles.chips}>
                <button className={styles.chip}>
                    <Sparkles size={14} />
                    <span>Analyze Token</span>
                </button>
                <button className={styles.chip}>
                    <span>/swap</span>
                </button>
            </div>

            <div className={styles.inputWrapper}>
                <button className={styles.attachBtn}>
                    <Paperclip size={20} />
                </button>
                <textarea
                    className={styles.input}
                    placeholder="Ask KIKO anything about crypto..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                />
                <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    disabled={!input.trim()}
                >
                    <Send size={20} />
                </button>
            </div>
            <div className={styles.disclaimer}>
                KIKO can make mistakes. Please verify important information.
            </div>
        </div>
    );
};
