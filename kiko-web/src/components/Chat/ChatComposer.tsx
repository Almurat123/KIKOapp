import React from 'react';
import { ArrowDown, ChevronDown, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import styles from './Chat.module.css';
import { LiquidGlassEffect } from '../Effects/LiquidGlassEffect';
import { ChatInputSuggestions, type SuggestionGroup, type SuggestionItem } from './ChatInputSuggestions';
import { agentAttrs } from '../../agent/attrs';
import { MODEL_OPTIONS, type ChatModelOption } from './chatConstants';

interface ChatComposerProps {
    chatStarted: boolean;
    disableChatTransitions: boolean;
    showJumpToBottom: boolean;
    showSuggestions: boolean;
    suggestions: SuggestionGroup[] | SuggestionItem[];
    input: string;
    selectedModel: ChatModelOption;
    isModelDropdownOpen: boolean;
    isBusy: boolean;
    isStopping: boolean;
    inputTop: number | null;
    isKeyboardVisible: boolean;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
    modelSelectorRef: React.RefObject<HTMLDivElement | null>;
    closeSuggestions: () => void;
    onScrollToBottom: () => void;
    onSelectSuggestion: (item: SuggestionItem) => void;
    onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onInputKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
    onInputFocus: () => void;
    onCompositionStart: () => void;
    onCompositionEnd: () => void;
    onToggleModelDropdown: () => void;
    onSelectModel: (model: ChatModelOption) => void;
    onOpenSettings: () => void;
    onPrimaryAction: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
    chatStarted,
    disableChatTransitions,
    showJumpToBottom,
    showSuggestions,
    suggestions,
    input,
    selectedModel,
    isModelDropdownOpen,
    isBusy,
    isStopping,
    inputTop,
    isKeyboardVisible,
    textareaRef,
    modelSelectorRef,
    closeSuggestions,
    onScrollToBottom,
    onSelectSuggestion,
    onInputChange,
    onInputKeyDown,
    onInputFocus,
    onCompositionStart,
    onCompositionEnd,
    onToggleModelDropdown,
    onSelectModel,
    onOpenSettings,
    onPrimaryAction,
}) => {
    if (!chatStarted) return null;

    return (
        <div
            className={clsx(styles.inputArea, styles.inputBottom, !disableChatTransitions && styles.chatUiEnterDelayed)}
            style={isKeyboardVisible && inputTop !== null ? {
                bottom: 'auto',
                top: `${inputTop}px`,
                transform: 'translateY(-100%)',
            } : undefined}
        >
            {showJumpToBottom && (
                <button
                    className={styles.jumpToBottom}
                    onClick={onScrollToBottom}
                    aria-label="Scroll to bottom"
                >
                    <ArrowDown size={20} />
                </button>
            )}
            <LiquidGlassEffect
                className={clsx(styles.inputWrapper, showSuggestions && styles.inputWrapperOpen)}
                enabled={true}
            >
                <ChatInputSuggestions
                    suggestions={suggestions}
                    isVisible={showSuggestions}
                    agentId="chat.suggestions.list"
                    onSelect={onSelectSuggestion}
                />
                <div className={styles.textareaContainer}>
                    <textarea
                        ref={textareaRef}
                        className={styles.textArea}
                        {...agentAttrs({ id: 'chat.input.textarea', role: 'input', action: 'select', page: 'chat', key: 'message' })}
                        placeholder="Ask anything..."
                        rows={1}
                        value={input}
                        onChange={onInputChange}
                        onKeyDown={onInputKeyDown}
                        onFocus={onInputFocus}
                        onBlur={() => closeSuggestions()}
                        onCompositionStart={onCompositionStart}
                        onCompositionEnd={onCompositionEnd}
                    />

                    <div className={styles.inputActions}>
                        <div className={styles.modelSelector} ref={modelSelectorRef}>
                            <button
                                className={styles.modelButton}
                                {...agentAttrs({ id: 'chat.model.toggle', role: 'button', action: 'open', page: 'chat' })}
                                onClick={onToggleModelDropdown}
                            >
                                <span className={styles.modelName}>
                                    {MODEL_OPTIONS.find(model => model.id === selectedModel.id)?.name || selectedModel.name}
                                </span>
                                <span className={styles.modelMode}>{selectedModel.mode}</span>
                                <ChevronDown size={12} className={clsx(styles.chevron, isModelDropdownOpen && styles.chevronOpen)} />
                            </button>

                            {isModelDropdownOpen && (
                                <div className={styles.modelDropdown}>
                                    {MODEL_OPTIONS.map((model) => (
                                        <button
                                            key={model.id}
                                            className={clsx(styles.modelOption, selectedModel.id === model.id && styles.modelOptionActive)}
                                            {...agentAttrs({ id: `chat.model.option.${model.id}`, role: 'button', action: 'select', page: 'chat', key: 'model_id' })}
                                            onClick={() => onSelectModel(model)}
                                        >
                                            <span className={styles.modelOptionName}>{model.name}</span>
                                            <span className={styles.modelOptionMode}>{model.mode}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            className={styles.settingsButton}
                            {...agentAttrs({ id: 'chat.settings.open', role: 'button', action: 'open', page: 'chat' })}
                            onClick={onOpenSettings}
                            title="Customize AI"
                        >
                            <Settings size={18} />
                        </button>
                        <button
                            className={clsx(
                                styles.sendBtn,
                                isBusy && styles.stopMode,
                                !isBusy && input.trim() && styles.activeMode,
                                isStopping && styles.stoppingMode
                            )}
                            onClick={onPrimaryAction}
                            disabled={(!input.trim() && !isBusy) || isStopping}
                            title={isBusy ? 'Stop generation' : 'Send message'}
                            {...agentAttrs({ id: 'chat.action.send', role: 'button', action: 'submit', page: 'chat' })}
                        >
                            {isBusy && <div className={styles.auroraLayer} />}

                            <motion.div
                                className={styles.btnIcon}
                                animate={{ scale: isBusy ? 1.1 : 1, rotate: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <motion.path
                                        initial={false}
                                        animate={{
                                            d: isBusy
                                                ? 'M6 6h12v12H6z'
                                                : 'M12 19V5M5 12l7-7 7 7'
                                        }}
                                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                    />
                                </svg>
                            </motion.div>
                            {isBusy && <div className={styles.spinnerRing} />}
                        </button>
                    </div>
                </div>
            </LiquidGlassEffect>
        </div>
    );
};
