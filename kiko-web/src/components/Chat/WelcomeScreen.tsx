import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  Settings,
  ChevronDown
} from 'lucide-react';
import styles from './WelcomeScreen.module.css';
import { useThemeContext } from '../../contexts/ThemeContext';
import { CustomAISettingsModal } from './CustomAISettingsModal';
import { useSmartSuggestions } from './useSmartSuggestions.tsx';
import { ChatInputSuggestions } from './ChatInputSuggestions';
import { logger } from '../../utils/logger';
import { LiquidGlassEffect } from '../Effects/LiquidGlassEffect';

// Model options
// According to DeepSeek API docs: https://api-docs.deepseek.com/zh-cn/quick_start/pricing
// - deepseek-chat: DeepSeek-V3.2 (非思考模式)
// - deepseek-reasoner: DeepSeek-V3.2 (思考模式)
const MODEL_OPTIONS = [
  { id: 'deepseek-v3-fast', name: 'DeepSeek-V3.2', mode: 'fast' },
  { id: 'deepseek-v3-thinking', name: 'DeepSeek-V3.2', mode: 'thinking' },
  { id: 'grok-4-reasoning', name: 'Grok-4.1-Fast', mode: 'thinking' },
  { id: 'grok-4-non-reasoning', name: 'Grok-4.1-Fast', mode: 'fast' },
];

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSuggestionClick }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState('');


  // Load selected model from localStorage or use default
  const getInitialModel = () => {
    try {
      const saved = localStorage.getItem('kiko-selected-model');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = MODEL_OPTIONS.find(m => m.id === parsed.id);
        if (found) return found;
      }
    } catch (e) {
      logger.warn('Failed to load saved model from localStorage:', e);
    }
    return MODEL_OPTIONS[0];
  };

  const [selectedModel, setSelectedModel] = useState(getInitialModel);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Save model selection to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('kiko-selected-model', JSON.stringify(selectedModel));
      logger.debug('[WelcomeScreen] Saved model selection:', selectedModel.id);
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('kiko-model-changed', { detail: selectedModel }));
    } catch (e) {
      logger.warn('Failed to save model selection to localStorage:', e);
    }
  }, [selectedModel]);
  const { resolvedTheme } = useThemeContext();
  const modelSelectorRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelSelectorRef.current && !modelSelectorRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };

    if (isModelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelDropdownOpen]);

  // Smart Suggestions Hook
  const {
    suggestions: smartSuggestions,
    showSuggestions: showSmartSuggestions,
    detectIntent,
    openSuggestions,
    setShowSuggestions: setShowSmartSuggestions
  } = useSmartSuggestions(
    (text) => {
      onSuggestionClick(text);
      setInputValue('');
    }, // onSend
    (text) => {
      // For WelcomeScreen, immediately send when a suggestion is selected
      // instead of just filling the input
      onSuggestionClick(text);
      setInputValue('');
    } // onSetInput - also send immediately
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';

    // Trigger detection
    detectIntent(newValue);
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      onSuggestionClick(inputValue);
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`${styles.welcomeContainer} ${styles[resolvedTheme]}`}>
      {/* Background Ambient Light */}
      <div className={styles.ambientLight}>
        <div className={styles.centerLight}></div>
        <div className={styles.topLight}></div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>I am KIKO.</h1>
          <h2 className={styles.heroSubTitleSecondary}>The on-chain analyst.</h2>
        </div>


        {/* Floating Input with Liquid Glass Effect */}
        <div className={styles.inputContainer}>
          <LiquidGlassEffect
            className={`${styles.inputWrapper} ${isFocused ? styles.inputFocused : ''}`}
            enabled={true}
          >
            <ChatInputSuggestions
              suggestions={smartSuggestions}
              isVisible={showSmartSuggestions}
              onSelect={(item) => {
                item.action();
                setShowSmartSuggestions(false);
              }}
            />
            <div className={styles.textareaContainer}>
              <textarea
                value={inputValue}
                onChange={handleInput}
                onFocus={() => {
                  setIsFocused(true);
                  if (!inputValue || inputValue.trim().length === 0) openSuggestions();
                }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                className={styles.textarea}
              />

              <div className={styles.inputActions}>
                <div className={styles.modelSelector} ref={modelSelectorRef}>
                  <button
                    className={styles.modelButton}
                    onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  >
                    <span className={styles.modelName}>
                      {MODEL_OPTIONS.find(m => m.id === selectedModel.id)?.name || selectedModel.name}
                    </span>
                    <span className={styles.modelMode}>{selectedModel.mode}</span>
                    <ChevronDown size={12} className={`${styles.chevron} ${isModelDropdownOpen ? styles.chevronOpen : ''}`} />
                  </button>

                  {isModelDropdownOpen && (
                    <div className={styles.modelDropdown}>
                      {MODEL_OPTIONS.map((model) => (
                        <button
                          key={model.id}
                          className={`${styles.modelOption} ${selectedModel.id === model.id ? styles.modelOptionActive : ''}`}
                          onClick={() => {
                            setSelectedModel(model);
                            setIsModelDropdownOpen(false);
                            logger.debug('[WelcomeScreen] Model changed to:', model.id);
                          }}
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
                  onClick={() => setIsSettingsOpen(true)}
                  title="Customize AI"
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className={`${styles.sendButton} ${inputValue.trim() ? styles.sendButtonActive : ''}`}
                  title={inputValue.trim() ? '发送' : '输入内容后可发送'}
                >
                  <ArrowUp size={20} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </LiquidGlassEffect>

          <div className={styles.inputFooter}>
            <p>AI can make mistakes. Please double check responses.</p>
          </div>
        </div>
      </div>

      <CustomAISettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div >
  );
};
