import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { agentAttrs } from '../../agent/attrs';
import {
    findChatModelFamilyOption,
    findChatModelOptionByFamilyAndReasoning,
    getDisplayedChatReasoningLabel,
    getChatModelFamilyOptions,
    type ChatModelOption,
    type ChatReasoningLevel,
} from './chatConstants';

// CONTEXT MEMORY
// Updated: 2026-04-17
// Author: Rowan
// Reason: The chat composer and welcome shell now present two borderless
//         selectors in the input row: one for the model family and, when a
//         family actually has multiple declared variants, one for the thinking
//         level. This component owns only that visual picker chrome and its
//         temporary open/close state so the surrounding owners can keep
//         persistence, prompt submission, and conversation flow in one place.
// Goal: keep the model/thinking picker visually lightweight while mapping every
//       user choice back to a real persisted model id.
// Owns: borderless model-family and thinking dropdown chrome, temporary menu
//       open state, and translating picker choices back into concrete model ids.
// Does Not Own: model persistence, conversation boot, settings storage, or
//       backend request shaping.
// Design Language:
// - picker buttons should read like inline controls, not boxed pills
// - thinking choices must resolve back to actual model variants or documented effort levels
// - show thinking labels whenever the family exposes more than one reasoning choice, including GPT-5.4 mini's product-visible Low/Medium subset
// - GPT display labels must be recomputed from the active effort state so stale
//   serialized values cannot resurrect old labels like Fast
// - keep the family selector and thinking selector adjacent
// - do not introduce a second persistence path for the same selected model
// - do not guess per-family defaults when the actual model list already defines
//   the available variants
// Document Provenance:
// - Source: user screenshot request showing a borderless model + reasoning row
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: borderless split selectors for model family and thinking
// - Verification: inferred
// - Source: OpenAI GPT-5.4 model page
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: grounding GPT-5.4 mini in a real effort ladder while exposing
//   only the product-visible Low/Medium subset
// - Verification: verified in docs
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
// - Kind: repo doc
// - Retrieved: 2026-04-17
// - Applied To: documenting the shared selector chrome and its owner boundary
// - Verification: inferred
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - /Users/almurat/KiKo/kiko-web/src/components/Chat/chatConstants.ts
// - /Users/almurat/KiKo/kiko-web/src/components/Chat/ChatComposer.tsx
// - /Users/almurat/KiKo/kiko-web/src/components/Chat/WelcomeScreen.tsx

interface ChatModelSelectorProps {
    page: 'chat' | 'welcome';
    selectedModel: ChatModelOption;
    onSelectModel: (model: ChatModelOption) => void;
    styles: Record<string, string>;
}

type OpenMenu = 'model' | 'reasoning' | null;

export const ChatModelSelector: React.FC<ChatModelSelectorProps> = ({
    page,
    selectedModel,
    onSelectModel,
    styles,
}) => {
    const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const familyOptions = useMemo(() => getChatModelFamilyOptions(), []);
    const selectedFamily = findChatModelFamilyOption(selectedModel.id) || familyOptions[0];
    const reasoningOptions = selectedFamily?.reasoningOptions || [];
    const showReasoningSelector = reasoningOptions.length > 1;

    useEffect(() => {
        if (openMenu === 'reasoning' && !showReasoningSelector) {
            setOpenMenu(null);
        }
    }, [openMenu, showReasoningSelector]);

    useEffect(() => {
        if (!openMenu) return;

        const handleOutsideClick = (event: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpenMenu(null);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpenMenu(null);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [openMenu]);

    const handleFamilySelect = (familyId: string) => {
        const nextModel = findChatModelOptionByFamilyAndReasoning(familyId, selectedModel.reasoningLevel);
        if (nextModel) {
            onSelectModel(nextModel);
        }
        setOpenMenu(null);
    };

    const handleReasoningSelect = (reasoningLevel: ChatReasoningLevel) => {
        const familyId = selectedFamily?.id || selectedModel.familyId;
        const nextModel = findChatModelOptionByFamilyAndReasoning(familyId, reasoningLevel);
        if (nextModel) {
            onSelectModel(nextModel);
        }
        setOpenMenu(null);
    };

    const familyLabel = selectedFamily?.name || selectedModel.name;
    const reasoningLabel = getDisplayedChatReasoningLabel(selectedModel);

    return (
        <div ref={rootRef} className={styles.modelSelectors}>
            <div className={styles.modelSelector}>
                <button
                    type="button"
                    className={styles.modelButton}
                    {...agentAttrs({ id: `${page}.model.toggle`, role: 'button', action: 'open', page })}
                    onClick={() => setOpenMenu((current) => current === 'model' ? null : 'model')}
                    title="Choose model"
                    aria-haspopup="menu"
                    aria-expanded={openMenu === 'model'}
                >
                    <span className={styles.modelName}>{familyLabel}</span>
                    <ChevronDown size={14} className={clsx(styles.chevron, openMenu === 'model' && styles.chevronOpen)} />
                </button>

                {openMenu === 'model' && (
                    <div className={styles.modelDropdown} role="menu" aria-label="Choose model family">
                        {familyOptions.map((family) => (
                            <button
                                key={family.id}
                                type="button"
                                className={clsx(styles.modelOption, selectedFamily?.id === family.id && styles.modelOptionActive)}
                                {...agentAttrs({ id: `${page}.model.option.${family.id}`, role: 'button', action: 'select', page, key: 'model_id' })}
                                onClick={() => handleFamilySelect(family.id)}
                            >
                                <span className={styles.modelOptionName}>{family.name}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {showReasoningSelector && (
                <div className={styles.modelSelector}>
                    <button
                        type="button"
                        className={styles.modelButton}
                        {...agentAttrs({ id: `${page}.reasoning.toggle`, role: 'button', action: 'open', page })}
                        onClick={() => setOpenMenu((current) => current === 'reasoning' ? null : 'reasoning')}
                        title="Choose thinking strength"
                        aria-haspopup="menu"
                        aria-expanded={openMenu === 'reasoning'}
                    >
                        <span className={styles.modelName}>{reasoningLabel}</span>
                        <ChevronDown size={14} className={clsx(styles.chevron, openMenu === 'reasoning' && styles.chevronOpen)} />
                    </button>

                    {openMenu === 'reasoning' && selectedFamily && (
                        <div className={styles.modelDropdown} role="menu" aria-label="Choose thinking strength">
                            {reasoningOptions.map((reasoning) => (
                                <button
                                    key={reasoning.id}
                                    type="button"
                                    className={clsx(styles.modelOption, selectedModel.reasoningLevel === reasoning.id && styles.modelOptionActive)}
                                    {...agentAttrs({ id: `${page}.reasoning.option.${reasoning.id}`, role: 'button', action: 'select', page, key: 'reasoning_level' })}
                                    onClick={() => handleReasoningSelect(reasoning.id)}
                                >
                                    <span className={styles.modelOptionName}>{reasoning.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
