import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  Plus,
  Settings,
} from 'lucide-react';
import styles from './WelcomeScreen.module.css';
import { useThemeContext } from '../../contexts/ThemeContext';
import { useSmartSuggestions } from './useSmartSuggestions.tsx';
import { ChatInputSuggestions } from './ChatInputSuggestions';
import { logger } from '../../utils/logger';
import { usePrivy } from '@privy-io/react-auth';
import { getUserSettings, saveUserSettings } from '../../services/userSettingsApi';
import { LiquidGlassEffect } from '../Effects/LiquidGlassEffect';
import { agentAttrs } from '../../agent/attrs';
import { findChatModelOption, getDefaultChatModelOption, hydrateChatModelOption } from './chatConstants';
import { ChatAttachmentTray } from './ChatAttachmentTray';
import { COMPOSER_IMAGE_ACCEPT, type ComposerImageDraft } from './chatImageDrafts';
import { ChatModelSelector } from './ChatModelSelector';

const LazyCustomAISettingsModal = React.lazy(() => import('./CustomAISettingsModal').then((m) => ({ default: m.CustomAISettingsModal })));

// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: The welcome screen is the lightweight first-paint owner for the
//         homepage, so its optional settings surface must not pin the heavier
//         modal runtime into the default bundle. It now also needs to expose
//         the same local image-draft affordance as the live chat composer so
//         first-send prompt composition does not split into a second UI path,
//         including image-only sends. The welcome shell also stays free of the
//         animated particle backdrop so first paint remains visually calm and
//         does not depend on a GPU-backed background scene. It now mirrors the
//         same borderless model/reasoning selector pair used by the live chat
//         composer.
// Goal: preserve a responsive welcome shell that can collect the first prompt
//       immediately while deferring optional settings UI until the user opens
//       it, while sharing the same local image-preview affordance and image-
//       only send eligibility as live chat, and without owning animated page
//       backdrops or model-policy chrome.
// Owns: welcome-screen prompt collection, model selection persistence, local
//       draft preview placement, borderless model/reasoning picker placement,
//       and the local settings-modal entry point for the welcome shell.
// Does Not Own: full chat runtime boot, conversation creation, chat message
//       rendering, animated background scenes, or model catalog policy.
// Design Language:
// - welcome-shell controls should stay lightweight and immediately interactive
// - optional modal surfaces must load on demand
// - welcome and live chat must share one image-draft affordance language
// - forbidden local patch patterns: static imports of optional settings UI in the welcome shell
// - send affordance should activate when text or at least one image is present
// - send must stay disabled while selected images are still uploading or failed
// - welcome shells should not ship a persistent particle/canvas backdrop
// - picker buttons should read as inline text actions, not boxed pills
// - model family and reasoning strength are separate controls but one persisted model id
// Document Provenance:
// - Source: Vite production build output warning about static import preventing chunk split
// - Kind: build evidence
// - Retrieved: 2026-04-10
// - Applied To: defer the welcome-screen settings modal behind a lazy boundary
// - Verification: verified in code
// - Source: user-provided local UI requirement and screenshot review on 2026-04-16
// - Kind: product doc
// - Retrieved: 2026-04-16
// - Applied To: adding a GPT-style local image draft row and `+` affordance to the welcome composer
// - Verification: verified in code
// - Source: user screenshot request showing borderless model and reasoning controls
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: switching the welcome shell to a borderless dual-selector row
// - Verification: inferred
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: documenting the welcome shell selector grouping
// - Verification: inferred
// - Source: user request to remove the welcome-page dynamic background particles
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: removing `StardustBackground` from the welcome shell
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-homepage-welcome-stardust-background-removal.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: recording the welcome shell backdrop correction and owner boundary
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/design-language/loading-resilience.md
// - /Users/almurat/KiKo/system-journal/owner-map/frontend-data-loading.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-10-homepage-welcome-shell-split.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-homepage-welcome-stardust-background-removal.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-local-image-composer-base.md

interface WelcomeScreenProps {
  onSuggestionClick: (text: string) => void;
  isUploadingImages: boolean;
  isImageSendBlocked: boolean;
  selectedImageDrafts: ComposerImageDraft[];
  onSelectImages: (files: File[]) => void;
  onRemoveImage: (attachmentId: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSuggestionClick,
  isUploadingImages,
  isImageSendBlocked,
  selectedImageDrafts,
  onSelectImages,
  onRemoveImage,
}) => {
  const { authenticated, getAccessToken } = usePrivy();
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(() => {
    const stored = sessionStorage.getItem('kiko-prefill-prompt');
    if (stored) {
      sessionStorage.removeItem('kiko-prefill-prompt');
    }
    return stored || '';
  });
  const [isComposing, setIsComposing] = useState(false);
  const lastCompositionEndRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInitialPrefillRef = useRef(inputValue.length > 0);

  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  // Focus the prefilled prompt on mount when navigation seeds the welcome input.
  useEffect(() => {
    if (!hasInitialPrefillRef.current) return;

    hasInitialPrefillRef.current = false;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        autoResizeTextarea(textareaRef.current);
        textareaRef.current.focus();
      }
    });
  }, []);

  // Also listen for the event (fires when WelcomeScreen is already mounted)
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt: string }>).detail?.prompt;
      if (prompt) {
        setInputValue(prompt);
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            autoResizeTextarea(textareaRef.current);
            textareaRef.current.focus();
          }
        });
      }
    };
    window.addEventListener('kiko-prefill-input', handler);
    return () => window.removeEventListener('kiko-prefill-input', handler);
  }, []);


  // Load selected model from localStorage or use default
  const getInitialModel = () => {
    try {
      const saved = localStorage.getItem('kiko-selected-model');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = hydrateChatModelOption(parsed) || findChatModelOption(parsed.id);
        if (found) return found;
      }
    } catch (e) {
      logger.warn('Failed to load saved model from localStorage:', e);
    }
    return getDefaultChatModelOption();
  };

  const [selectedModel, setSelectedModel] = useState(getInitialModel);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const skipInitialRemoteModelPersistRef = useRef(true);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Save model selection to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('kiko-selected-model', JSON.stringify(selectedModel));
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('kiko-model-changed', { detail: selectedModel }));
    } catch (e) {
      logger.warn('Failed to save model selection to localStorage:', e);
    }
  }, [selectedModel]);

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    const loadSavedModel = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const settings = await getUserSettings(token);
        const found = findChatModelOption(settings?.defaultChatModel);
        if (!cancelled && found && found.id !== selectedModel.id) {
          setSelectedModel(found);
        }
      } catch (error) {
        logger.warn('Failed to load saved default chat model:', error);
      }
    };
    void loadSavedModel();
    return () => {
      cancelled = true;
    };
  }, [authenticated, getAccessToken]);

  useEffect(() => {
    if (!authenticated) return;
    if (skipInitialRemoteModelPersistRef.current) {
      skipInitialRemoteModelPersistRef.current = false;
      return;
    }
    const persist = async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        await saveUserSettings(token, { defaultChatModel: selectedModel.id });
      } catch (error) {
        logger.warn('Failed to persist default chat model:', error);
      }
    };
    void persist();
  }, [authenticated, getAccessToken, selectedModel.id]);
  const { resolvedTheme } = useThemeContext();

  // Smart Suggestions Hook
  const {
    suggestions: smartSuggestions,
    showSuggestions: showSmartSuggestions,
    detectIntent,
    openSuggestions,
    setShowSuggestions: setShowSmartSuggestions
  } = useSmartSuggestions(
    (text) => {
      if (text.trim()) {
        onSuggestionClick(text.trim());
        setInputValue('');
      }
    }, // onSend
    (text) => {
      // Fill the input box instead of sending immediately
      setInputValue(text);
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          autoResizeTextarea(textareaRef.current);
        }
      });
    } // onSetInput
  );

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    autoResizeTextarea(e.target);

    // Trigger detection
    detectIntent(newValue);
  };

  useEffect(() => {
    if (textareaRef.current && inputValue) {
      autoResizeTextarea(textareaRef.current);
    }
    if (textareaRef.current && !inputValue) {
      textareaRef.current.style.height = 'auto';
    }
  }, [inputValue]);

  const handleSend = () => {
    if (inputValue.trim() || selectedImageDrafts.length > 0) {
      onSuggestionClick(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isCurrentlyComposing = isComposing || (e.nativeEvent as unknown as { isComposing?: boolean }).isComposing;

    if (e.key === 'Enter' && !e.shiftKey) {
      // 1. Check if we're currently in IME composition
      if (isCurrentlyComposing) {
        return; // Let IME handle it
      }

      // 2. Check if composition JUST ended (within 100ms)
      if (Date.now() - lastCompositionEndRef.current < 100) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      handleSend();
    }
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    lastCompositionEndRef.current = Date.now();
    // Delay clearing the state slightly for trailing event safety
    setTimeout(() => {
      setIsComposing(false);
    }, 50);
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
          <h1 className={styles.heroTitle}>I am <span className={styles.kikoWrapped}>KIKO</span>.</h1>
          <h2 className={styles.heroSubTitleSecondary}>The best way to trade.</h2>
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
              agentId="welcome.suggestions.list"
              onSelect={(item) => {
                item.action();
                setShowSmartSuggestions(false);
              }}
            />
            <div className={styles.textareaContainer}>
              <input
                ref={imageInputRef}
                type="file"
                accept={COMPOSER_IMAGE_ACCEPT}
                multiple
                className={styles.hiddenImageInput}
                onChange={(event) => {
                  const nextFiles = Array.from(event.target.files || []);
                  if (nextFiles.length > 0) {
                    onSelectImages(nextFiles);
                  }
                  event.target.value = '';
                }}
              />
              <ChatAttachmentTray
                attachments={selectedImageDrafts}
                onRemove={onRemoveImage}
                disableRemove={isUploadingImages}
              />
              <textarea
                ref={textareaRef}
                {...agentAttrs({ id: 'welcome.input.textarea', role: 'input', action: 'select', page: 'welcome', key: 'message' })}
                value={inputValue}
                onChange={handleInput}
                onFocus={() => {
                  setIsFocused(true);
                  if (!inputValue || inputValue.trim().length === 0) openSuggestions();
                }}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                placeholder="Ask anything..."
                rows={1}
                className={styles.textarea}
                disabled={isUploadingImages}
              />

              <div className={styles.inputActions}>
                <ChatModelSelector
                  page="welcome"
                  selectedModel={selectedModel}
                  onSelectModel={(model) => {
                    setSelectedModel(model);
                    logger.debug('[WelcomeScreen] Model changed to:', model.id);
                  }}
                  styles={styles}
                />
                <button
                  type="button"
                  className={styles.uploadButton}
                  {...agentAttrs({ id: 'welcome.image.upload', role: 'button', action: 'open', page: 'welcome' })}
                  onClick={() => imageInputRef.current?.click()}
                  title="Add image"
                  disabled={isUploadingImages}
                >
                  <Plus size={18} />
                </button>
                <button
                  className={styles.settingsButton}
                  {...agentAttrs({ id: 'welcome.settings.open', role: 'button', action: 'open', page: 'welcome' })}
                  onClick={() => setIsSettingsOpen(true)}
                  title="Customize AI"
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={handleSend}
                  disabled={(!inputValue.trim() && selectedImageDrafts.length === 0) || isImageSendBlocked}
                  className={`${styles.sendButton} ${(inputValue.trim() || selectedImageDrafts.length > 0) ? styles.sendButtonActive : ''}`}
                  title={isImageSendBlocked ? '图片还没准备好' : ((inputValue.trim() || selectedImageDrafts.length > 0) ? '发送' : '输入内容或添加图片后可发送')}
                  {...agentAttrs({ id: 'welcome.action.send', role: 'button', action: 'submit', page: 'welcome' })}
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

      {isSettingsOpen && (
        <React.Suspense fallback={null}>
          <LazyCustomAISettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        </React.Suspense>
      )}
    </div >
  );
};
