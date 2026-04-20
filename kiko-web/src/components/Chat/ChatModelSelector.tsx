import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { agentAttrs } from '../../agent/attrs';
import {
    findChatModelFamilyOption,
    findChatModelOptionByFamilyAndReasoning,
    getDisplayedChatReasoningLabel,
    getChatModelFamilyOptions,
    type ChatModelControlLevel,
    type ChatModelOption,
} from './chatConstants';
import { getStoredChatModelControlLevelForFamily } from './chatModelSelectionPersistence';

// CONTEXT MEMORY
// Updated: 2026-04-20
// Author: Rowan
// Reason: The chat composer and welcome shell now present two borderless
//         selectors in the input row: one for the model family and, when a
//         family actually has multiple declared variants, one for the thinking
//         level. The same selector now also includes generated-image families
//         in a separate Image section, where the second control represents
//         image quality instead of reasoning. This component owns only that
//         visual picker chrome and its temporary open/close state so the
//         surrounding owners can keep persistence, prompt submission, and
//         conversation flow in one place. Product policy now also marks some
//         visible image variants as disabled, so the picker must render them
//         without letting them become the active selection.
// Goal: keep the model/thinking picker visually lightweight while mapping every
//       user choice back to a real model id and provider-specific control
//       value.
// Owns: borderless model-family and thinking dropdown chrome, temporary menu
//       open state, and translating picker choices back into concrete model ids.
// Does Not Own: model persistence, conversation boot, settings storage, or
//       backend request shaping.
// Design Language:
// - picker buttons should read like inline controls, not boxed pills
// - thinking choices must resolve back to actual model variants or documented effort levels
// - image choices must appear under an Image section, not mixed with text models
// - the second selector label must read as quality for generated-image models
// - show thinking labels whenever the family exposes more than one reasoning choice, including GPT-5.4 mini's product-visible Low/Medium subset
// - GPT display labels must be recomputed from the active effort state so stale
//   serialized values cannot resurrect old labels like Fast
// - keep the family selector and thinking selector adjacent
// - mobile layouts must preserve a single control row, so long family names
//   need compact labels without changing the persisted model id
// - on mobile, the label and chevron stay packed together; do not stretch the
//   arrow away from the name inside the selector button
// - do not introduce a second persistence path for the same selected model
// - do not guess per-family defaults when the actual model list already defines
//   the available variants
// - disabled model families and quality variants may stay visible, but must not
//   fire selection handlers
// - when switching back to a family, restore that family's last saved control
//   level before falling back to the current row or family default
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
// - Source: OpenAI GPT Image 1.5 model page and image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: displaying `gpt-image-1.5` with Low/Medium/High quality choices
// - Verification: verified in docs
// - Source: xAI Grok Imagine Image and Grok Imagine Image Pro model pages
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: displaying Grok image generation as Normal/Pro choices
// - Verification: verified in docs
// - Source: operator requirement on 2026-04-18
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: disabling GPT image and Grok Pro in the picker while keeping them visible
// - Verification: verified in code
// - Source: operator requirement on 2026-04-18
// - Kind: product doc
// - Retrieved: 2026-04-18
// - Applied To: keeping all mobile input-row controls on a single line via compact family labels
// - Verification: verified in code
// - Source: user screenshot on 2026-04-19 showing excessive mobile selector spacing
// - Kind: product doc
// - Retrieved: 2026-04-19
// - Applied To: keeping selector labels and chevrons visually packed on mobile
// - Verification: inferred
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-input-borderless-model-reasoning-selector.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-image-model-selector-sections.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-chat-composer-mobile-containment.md
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

function getCompactFamilyLabel(
    family?: { familyId?: string | null; name?: string | null } | null
): string {
    const familyId = String(family?.familyId || '').trim().toLowerCase();
    switch (familyId) {
        case 'gpt-5.4-mini':
            return 'GPT-5.4';
        case 'grok-4-1-fast':
            return 'Grok-4.1';
        case 'gpt-image-1.5':
            return 'GPT Img';
        case 'gpt-image-1-mini':
            return 'GPT Mini Img';
        case 'grok-imagine-image':
            return 'Grok Img';
        default:
            return family?.name || '';
    }
}

export const ChatModelSelector: React.FC<ChatModelSelectorProps> = ({
    page,
    selectedModel,
    onSelectModel,
    styles,
}) => {
    const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const familyOptions = useMemo(() => getChatModelFamilyOptions(), []);
    const groupedFamilyOptions = useMemo(() => ({
        text: familyOptions.filter((family) => family.kind === 'text'),
        image: familyOptions.filter((family) => family.kind === 'image'),
    }), [familyOptions]);
    const selectedFamily = findChatModelFamilyOption(selectedModel.id) || familyOptions[0];
    const controlOptions = selectedFamily?.reasoningOptions || [];
    const showControlSelector = controlOptions.length > 1;
    const controlKind = selectedFamily?.controlKind || 'reasoning';

    useEffect(() => {
        if (openMenu === 'reasoning' && !showControlSelector) {
            setOpenMenu(null);
        }
    }, [openMenu, showControlSelector]);

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

    const handleFamilySelect = (familyId: string, disabled?: boolean) => {
        if (disabled) return;
        const savedControlLevel = getStoredChatModelControlLevelForFamily(familyId);
        const nextModel = findChatModelOptionByFamilyAndReasoning(
            familyId,
            savedControlLevel || selectedModel.reasoningLevel
        );
        if (nextModel) {
            onSelectModel(nextModel);
        }
        setOpenMenu(null);
    };

    const handleReasoningSelect = (reasoningLevel: ChatModelControlLevel, disabled?: boolean) => {
        if (disabled) return;
        const familyId = selectedFamily?.id || selectedModel.familyId;
        const nextModel = findChatModelOptionByFamilyAndReasoning(familyId, reasoningLevel);
        if (nextModel) {
            onSelectModel(nextModel);
        }
        setOpenMenu(null);
    };

    const familyLabel = selectedFamily?.name || selectedModel.name;
    const compactFamilyLabel = getCompactFamilyLabel({
        familyId: selectedFamily?.id || selectedModel.familyId,
        name: familyLabel,
    });
    const reasoningLabel = getDisplayedChatReasoningLabel(selectedModel);
    const controlTitle = controlKind === 'quality' ? 'Choose image quality' : 'Choose thinking strength';
    const controlAriaLabel = controlKind === 'quality' ? 'Choose image quality' : 'Choose thinking strength';
    const controlAgentName = controlKind === 'quality' ? 'quality' : 'reasoning';

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
                    <span className={clsx(styles.modelName, styles.modelNameFull)}>{familyLabel}</span>
                    <span className={clsx(styles.modelName, styles.modelNameCompact)}>{compactFamilyLabel}</span>
                    <ChevronDown size={14} className={clsx(styles.chevron, openMenu === 'model' && styles.chevronOpen)} />
                </button>

                {openMenu === 'model' && (
                    <div className={styles.modelDropdown} role="menu" aria-label="Choose model family">
                        {([
                            ['Text', groupedFamilyOptions.text],
                            ['Image', groupedFamilyOptions.image],
                        ] as const).map(([sectionLabel, options]) => (
                            options.length > 0 && (
                                <div key={sectionLabel} className={styles.modelDropdownSection}>
                                    <div className={styles.modelDropdownSectionLabel}>{sectionLabel}</div>
                                    {options.map((family) => (
                                        <button
                                            key={family.id}
                                            type="button"
                                            className={clsx(
                                                styles.modelOption,
                                                selectedFamily?.id === family.id && styles.modelOptionActive,
                                                family.disabled && styles.modelOptionDisabled,
                                            )}
                                            {...agentAttrs({ id: `${page}.model.option.${family.id}`, role: 'button', action: 'select', page, key: 'model_id' })}
                                            onClick={() => handleFamilySelect(family.id, family.disabled)}
                                            disabled={family.disabled}
                                            title={family.disabledReason || family.name}
                                        >
                                            <span className={styles.modelOptionName}>{family.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )
                        ))}
                    </div>
                )}
            </div>

            {showControlSelector && (
                <div className={styles.modelSelector}>
                    <button
                        type="button"
                        className={styles.modelButton}
                        {...agentAttrs({ id: `${page}.${controlAgentName}.toggle`, role: 'button', action: 'open', page })}
                        onClick={() => setOpenMenu((current) => current === 'reasoning' ? null : 'reasoning')}
                        title={controlTitle}
                        aria-haspopup="menu"
                        aria-expanded={openMenu === 'reasoning'}
                    >
                        <span className={styles.modelName}>{reasoningLabel}</span>
                        <ChevronDown size={14} className={clsx(styles.chevron, openMenu === 'reasoning' && styles.chevronOpen)} />
                    </button>

                    {openMenu === 'reasoning' && selectedFamily && (
                        <div className={styles.modelDropdown} role="menu" aria-label={controlAriaLabel}>
                            {controlOptions.map((reasoning) => (
                                <button
                                    key={reasoning.id}
                                    type="button"
                                    className={clsx(
                                        styles.modelOption,
                                        selectedModel.reasoningLevel === reasoning.id && styles.modelOptionActive,
                                        reasoning.disabled && styles.modelOptionDisabled,
                                    )}
                                    {...agentAttrs({ id: `${page}.${controlAgentName}.option.${reasoning.id}`, role: 'button', action: 'select', page, key: controlKind === 'quality' ? 'image_quality' : 'reasoning_level' })}
                                    onClick={() => handleReasoningSelect(reasoning.id, reasoning.disabled)}
                                    disabled={reasoning.disabled}
                                    title={reasoning.disabledReason || reasoning.label}
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
