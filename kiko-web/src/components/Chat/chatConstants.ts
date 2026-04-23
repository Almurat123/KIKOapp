// CONTEXT MEMORY
// Updated: 2026-04-23
// Author: Almurat
// Reason: web chat, X mentions, and Farcaster mentions still share one canonical
//         default model. The product default is back on GPT-5.4 Mini, and the UI
//         must expose the same canonical default that the backend now uses for
//         new sessions and persisted defaults. The selectable normal-model family
//         now stays on the GPT/Grok catalog. The same
//         catalog now also
//         needs a first-party vision capability flag so image-upload turns do
//         not silently route into text-only models. The chat composer now
//         presents borderless model and thinking selectors side by side, so
//         this catalog also owns the grouping metadata that lets the UI split a
//         saved model id into family and reasoning-strength controls without
//         inventing a new backend field or a separate family-default table.
//         GPT-5.4 mini now exposes only the product-visible Low/Medium subset
//         of the documented reasoning-effort ladder while the Grok family only
//         exposes the provider-documented choices. The selector also
//         has to expose image-generation models in a separate Image section, so
//         the second inline control now represents either text reasoning or
//         image quality depending on the selected model family. Product now
//         uses GPT Image 2 as the current paid OpenAI image family while still
//         exposing GPT Image 1 Mini as the lower-cost OpenAI option.
// Goal: keep one stable frontend default model id that matches backend session
//       creation and persisted per-user reply policy, while exposing whether a
//       chat model can accept current-turn image input.
// Owns: frontend-visible model catalog, canonical default selection helper, and
//       first-party image-capability checks, and frontend image-generation
//       model display metadata.
// Does Not Own: backend persistence, pricing, or agent execution.
// Design Language:
// - Do not rely on list order for the default model.
// - Keep UI model ids aligned with backend-supported model ids.
// - Prefer explicit helpers over duplicated literal ids in components.
// - Image upload UI must not imply vision support on text-only models.
// - UI family/reasoning selectors must resolve back to real persisted model ids.
// - Per-family fallback must come from the actual option list, not a guessed
//   reasoning-default map; the first declared option in each family is the
//   canonical fallback.
// - Reasoning labels must come from actual model variants or documented effort ladders, not synthetic tiers.
// - GPT-5.4 mini only surfaces the product-approved Low/Medium subset of its
//   documented effort ladder; do not synthesize Fast, High, or Extra High for GPT.
// - GPT display labels must be derived from the active effort state, not a
//   stale serialized `reasoningLabel` field.
// - Text and image models must stay visibly separated in the selector.
// - Image quality selection must not write a generated-image model into the
//   persisted default chat-model setting.
// - Disabled image variants must stay visible for roadmap clarity but must not
//   be restorable as the active selection from local storage.
// Document Provenance:
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - Kind: repo doc
// - Retrieved: 2026-04-15
// - Applied To: setting GPT-5.4 Mini as canonical frontend default
// - Verification: verified in code
// - Source: /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - Kind: repo doc
// - Retrieved: 2026-04-16
// - Applied To: exposing image-capable model checks in the frontend send flow
// - Verification: verified in code
// - Source: OpenAI GPT-5.4 and GPT-5.4 mini model pages
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: confirming GPT-5.4 mini supports a real reasoning-effort ladder
//   and constraining the selector to the product-visible Low/Medium subset
// - Verification: verified in docs
// - Source: OpenAI latest model guide FAQ
// - Kind: official API doc
// - Retrieved: 2026-04-17
// - Applied To: using ChatGPT-facing Instant/Thinking terminology as the
//   user-facing mental model for the selector
// - Verification: verified in docs
// - Source: user request and screenshot reference for borderless model plus Reasoning selectors
// - Kind: product doc
// - Retrieved: 2026-04-17
// - Applied To: grouping model ids into family and reasoning controls in the chat composer
// - Verification: inferred
// - Source: OpenAI GPT Image 2 model page and image generation guide
// - Kind: official API doc
// - Retrieved: 2026-04-22
// - Applied To: exposing `gpt-image-2` with low/medium/high quality options
// - Verification: verified in docs
// - Source: xAI Grok Imagine Image and Grok Imagine Image Pro model pages
// - Kind: official API doc
// - Retrieved: 2026-04-18
// - Applied To: exposing Grok image quality as Normal/Pro model variants
// - Verification: verified in docs
// - Source: operator requirement on 2026-04-22
// - Kind: product doc
// - Retrieved: 2026-04-22
// - Applied To: enabling GPT Image 2 while keeping Grok Pro disabled
// - Verification: verified in code
// See also:
// - /Users/almurat/KiKo/system-journal/INDEX.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-15-default-chat-model-switch-to-gpt.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-chat-image-upload-r2-and-model-input.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-17-chat-model-thinking-label-correction.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-image-model-selector-sections.md
// - /Users/almurat/KiKo/system-journal/fix-log/2026-04-18-generated-image-billing-and-gating.md
// - /Users/almurat/KiKo/system-journal/conflicts.md
export type ChatReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';
export type ChatReasoningLevel = 'fast' | 'thinking' | ChatReasoningEffort;
export type ChatModelKind = 'text' | 'image';
export type ChatImageQualityLevel = 'low' | 'medium' | 'high' | 'normal' | 'pro';
export type ChatModelControlLevel = ChatReasoningLevel | ChatImageQualityLevel;
export type ChatModelControlKind = 'reasoning' | 'quality';

export type ChatModelFamilyId =
  | 'gpt-5.4-mini'
  | 'grok-4-1-fast'
  | 'gpt-image-2'
  | 'gpt-image-1-mini'
  | 'grok-imagine-image';

export interface ChatModelOption {
  id: string;
  name: string;
  mode: string;
  kind: ChatModelKind;
  familyId: ChatModelFamilyId;
  reasoningLevel: ChatModelControlLevel;
  reasoningLabel: string;
  reasoningEffort?: ChatReasoningEffort;
  imageQuality?: ChatImageQualityLevel;
  selectable?: boolean;
  disabledReason?: string;
}

interface ChatModelFamilyControlOption {
  id: ChatModelControlLevel;
  label: string;
  effort?: ChatReasoningEffort;
  imageQuality?: ChatImageQualityLevel;
  disabled?: boolean;
  disabledReason?: string;
}

const IMAGE_UNAVAILABLE_REASON = 'Unavailable';

const BINARY_REASONING_OPTIONS: ChatModelFamilyControlOption[] = [
  { id: 'fast', label: 'Fast' },
  { id: 'thinking', label: 'Thinking' },
];

const GPT_54_MINI_REASONING_OPTIONS: ChatModelFamilyControlOption[] = [
  { id: 'low', label: 'Low', effort: 'low' },
  { id: 'medium', label: 'Medium', effort: 'medium' },
];

const GPT_IMAGE_2_QUALITY_OPTIONS: ChatModelFamilyControlOption[] = [
  { id: 'low', label: 'Low', imageQuality: 'low' },
  { id: 'medium', label: 'Medium', imageQuality: 'medium' },
  { id: 'high', label: 'High', imageQuality: 'high' },
];

const GPT_IMAGE_1_MINI_QUALITY_OPTIONS: ChatModelFamilyControlOption[] = [
  { id: 'low', label: 'Low', imageQuality: 'low' },
  { id: 'medium', label: 'Medium', imageQuality: 'medium' },
  { id: 'high', label: 'High', imageQuality: 'high' },
];

const GROK_IMAGE_QUALITY_OPTIONS: ChatModelFamilyControlOption[] = [
  { id: 'normal', label: 'Normal', imageQuality: 'normal' },
  { id: 'pro', label: 'Pro', imageQuality: 'pro' },
];

function normalizeGpt54ReasoningLevel(level?: string | null): ChatReasoningEffort {
  const normalized = String(level || '')
    .trim()
    .toLowerCase();
  if (normalized === 'medium' || normalized === 'high' || normalized === 'xhigh') {
    return 'medium';
  }
  return 'low';
}

export const MODEL_OPTIONS: ChatModelOption[] = [
  {
    id: 'gpt-5.4-mini-2026-03-17',
    name: 'GPT-5.4-Mini',
    mode: 'thinking',
    kind: 'text',
    familyId: 'gpt-5.4-mini',
    reasoningLevel: 'low',
    reasoningLabel: 'Low',
    reasoningEffort: 'low',
  },
  {
    id: 'grok-4-1-fast-non-reasoning',
    name: 'Grok-4.1-Fast',
    mode: 'fast',
    kind: 'text',
    familyId: 'grok-4-1-fast',
    reasoningLevel: 'fast',
    reasoningLabel: 'Fast',
  },
  {
    id: 'grok-4-1-fast-reasoning',
    name: 'Grok-4.1-Fast',
    mode: 'thinking',
    kind: 'text',
    familyId: 'grok-4-1-fast',
    reasoningLevel: 'thinking',
    reasoningLabel: 'Thinking',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    mode: 'image',
    kind: 'image',
    familyId: 'gpt-image-2',
    reasoningLevel: 'low',
    reasoningLabel: 'Low',
    imageQuality: 'low',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    mode: 'image',
    kind: 'image',
    familyId: 'gpt-image-2',
    reasoningLevel: 'medium',
    reasoningLabel: 'Medium',
    imageQuality: 'medium',
  },
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    mode: 'image',
    kind: 'image',
    familyId: 'gpt-image-2',
    reasoningLevel: 'high',
    reasoningLabel: 'High',
    imageQuality: 'high',
  },
  {
    id: 'gpt-image-1-mini',
    name: 'GPT Image 1 Mini',
    mode: 'image',
    kind: 'image',
    familyId: 'gpt-image-1-mini',
    reasoningLevel: 'low',
    reasoningLabel: 'Low',
    imageQuality: 'low',
  },
  {
    id: 'gpt-image-1-mini',
    name: 'GPT Image 1 Mini',
    mode: 'image',
    kind: 'image',
    familyId: 'gpt-image-1-mini',
    reasoningLevel: 'medium',
    reasoningLabel: 'Medium',
    imageQuality: 'medium',
  },
  {
    id: 'gpt-image-1-mini',
    name: 'GPT Image 1 Mini',
    mode: 'image',
    kind: 'image',
    familyId: 'gpt-image-1-mini',
    reasoningLevel: 'high',
    reasoningLabel: 'High',
    imageQuality: 'high',
  },
  {
    id: 'grok-imagine-image',
    name: 'Grok Imagine',
    mode: 'image',
    kind: 'image',
    familyId: 'grok-imagine-image',
    reasoningLevel: 'normal',
    reasoningLabel: 'Normal',
    imageQuality: 'normal',
  },
  {
    id: 'grok-imagine-image-pro',
    name: 'Grok Imagine',
    mode: 'image',
    kind: 'image',
    familyId: 'grok-imagine-image',
    reasoningLevel: 'pro',
    reasoningLabel: 'Pro',
    imageQuality: 'pro',
    selectable: false,
    disabledReason: IMAGE_UNAVAILABLE_REASON,
  },
];

export const DEFAULT_CHAT_MODEL_ID = 'gpt-5.4-mini-2026-03-17';

export function findChatModelOption(modelId?: string | null): ChatModelOption | undefined {
  const normalized = String(modelId || '')
    .trim()
    .toLowerCase();
  return MODEL_OPTIONS.find((model) => model.id === normalized);
}

export function getDefaultChatModelOption(): ChatModelOption {
  return findChatModelOption(DEFAULT_CHAT_MODEL_ID) || MODEL_OPTIONS[0];
}

const MODEL_FAMILY_ORDER: ChatModelFamilyId[] = [
  'gpt-5.4-mini',
  'grok-4-1-fast',
  'gpt-image-2',
  'gpt-image-1-mini',
  'grok-imagine-image',
];

const FAMILY_REASONING_OPTIONS: Record<ChatModelFamilyId, ChatModelFamilyControlOption[]> = {
  'gpt-5.4-mini': GPT_54_MINI_REASONING_OPTIONS,
  'grok-4-1-fast': BINARY_REASONING_OPTIONS,
  'gpt-image-2': GPT_IMAGE_2_QUALITY_OPTIONS,
  'gpt-image-1-mini': GPT_IMAGE_1_MINI_QUALITY_OPTIONS,
  'grok-imagine-image': GROK_IMAGE_QUALITY_OPTIONS,
};

const FAMILY_CONTROL_KIND: Record<ChatModelFamilyId, ChatModelControlKind> = {
  'gpt-5.4-mini': 'reasoning',
  'grok-4-1-fast': 'reasoning',
  'gpt-image-2': 'quality',
  'gpt-image-1-mini': 'quality',
  'grok-imagine-image': 'quality',
};

function normalizeModelFamilyId(modelId?: string | null): ChatModelFamilyId | undefined {
  const normalized = String(modelId || '')
    .trim()
    .toLowerCase();
  if (!normalized) return undefined;
  const existing = MODEL_OPTIONS.find((model) => model.id === normalized)?.familyId;
  if (existing) return existing;
  if (normalized.startsWith('grok-imagine-image-pro')) return 'grok-imagine-image';
  if (normalized.startsWith('grok-imagine-image')) return 'grok-imagine-image';
  if (normalized.startsWith('gpt-image-1-mini')) return 'gpt-image-1-mini';
  if (normalized.startsWith('gpt-image-2')) return 'gpt-image-2';
  if (normalized.startsWith('grok-4-1-fast')) return 'grok-4-1-fast';
  if (normalized.startsWith('gpt-5.4-mini')) return 'gpt-5.4-mini';
  return undefined;
}

export interface ChatModelFamilyOption {
  id: ChatModelFamilyId;
  name: string;
  kind: ChatModelKind;
  controlKind: ChatModelControlKind;
  reasoningOptions: ChatModelFamilyControlOption[];
  disabled?: boolean;
  disabledReason?: string;
}

export function isChatModelOptionSelectable(
  model?: Pick<ChatModelOption, 'selectable'> | null
): boolean {
  return model?.selectable !== false;
}

function getFirstSelectableChatModelOptionForFamily(
  familyId?: ChatModelFamilyId | null
): ChatModelOption | undefined {
  if (!familyId) return undefined;
  return MODEL_OPTIONS.find(
    (model) => model.familyId === familyId && isChatModelOptionSelectable(model)
  );
}

function getFirstSelectableChatModelOptionForKind(
  kind?: ChatModelKind | null
): ChatModelOption | undefined {
  if (!kind) return undefined;
  return MODEL_OPTIONS.find((model) => model.kind === kind && isChatModelOptionSelectable(model));
}

export function coerceSelectableChatModelOption(model?: ChatModelOption | null): ChatModelOption {
  if (model && isChatModelOptionSelectable(model)) return model;
  const familyFallback = getFirstSelectableChatModelOptionForFamily(model?.familyId);
  if (familyFallback) return familyFallback;
  const kindFallback = getFirstSelectableChatModelOptionForKind(model?.kind);
  if (kindFallback) return kindFallback;
  return getDefaultChatModelOption();
}

export function getChatModelFamilyOptions(): ChatModelFamilyOption[] {
  return MODEL_FAMILY_ORDER.flatMap((familyId) => {
    const familyModels = MODEL_OPTIONS.filter((model) => model.familyId === familyId);
    const reasoningOptions = (FAMILY_REASONING_OPTIONS[familyId] || []).map((option) => {
      const matchingModels = familyModels.filter((model) => model.reasoningLevel === option.id);
      const disabled =
        matchingModels.length > 0 &&
        matchingModels.every((model) => !isChatModelOptionSelectable(model));
      return {
        ...option,
        disabled,
        disabledReason: disabled
          ? matchingModels.find((model) => model.disabledReason)?.disabledReason
          : undefined,
      };
    });
    if (familyModels.length === 0 || reasoningOptions.length === 0) return [];

    return [
      {
        id: familyId,
        name: familyModels[0].name,
        kind: familyModels[0].kind,
        controlKind: FAMILY_CONTROL_KIND[familyId] || 'reasoning',
        reasoningOptions,
        disabled: familyModels.every((model) => !isChatModelOptionSelectable(model)),
        disabledReason: familyModels.every((model) => !isChatModelOptionSelectable(model))
          ? familyModels.find((model) => model.disabledReason)?.disabledReason
          : undefined,
      },
    ];
  });
}

export function findChatModelFamilyOption(
  modelId?: string | null
): ChatModelFamilyOption | undefined {
  const familyId = normalizeModelFamilyId(modelId);
  if (!familyId) return undefined;
  return getChatModelFamilyOptions().find((family) => family.id === familyId);
}

export function findChatModelOptionByFamilyAndReasoning(
  familyId?: string | null,
  reasoningLevel?: ChatModelControlLevel | null
): ChatModelOption | undefined {
  const normalizedFamilyId = normalizeModelFamilyId(familyId);
  if (!normalizedFamilyId) return undefined;

  const familyModels = MODEL_OPTIONS.filter((model) => model.familyId === normalizedFamilyId);
  if (familyModels.length === 0) return undefined;

  const familyReasoningOptions = FAMILY_REASONING_OPTIONS[normalizedFamilyId] || [];
  const normalizedReasoning = String(reasoningLevel || '')
    .trim()
    .toLowerCase() as ChatModelControlLevel;

  if (normalizedFamilyId === 'gpt-5.4-mini') {
    const normalizedGptReasoning = normalizeGpt54ReasoningLevel(normalizedReasoning);
    const requestedReasoning =
      familyReasoningOptions.find((option) => option.id === normalizedGptReasoning) ||
      familyReasoningOptions[0];
    if (!requestedReasoning) return familyModels[0];
    return {
      id: familyModels[0].id,
      name: familyModels[0].name,
      mode: 'thinking',
      kind: 'text',
      familyId: normalizedFamilyId,
      reasoningLevel: requestedReasoning.id,
      reasoningLabel: requestedReasoning.label,
      reasoningEffort: requestedReasoning.effort || 'low',
      selectable: true,
    };
  }

  if (FAMILY_CONTROL_KIND[normalizedFamilyId] === 'quality') {
    const requestedQuality =
      familyReasoningOptions.find(
        (option) => option.id === normalizedReasoning && option.disabled !== true
      ) ||
      familyReasoningOptions.find((option) => option.id === 'medium' && option.disabled !== true) ||
      familyReasoningOptions.find((option) => option.disabled !== true) ||
      familyReasoningOptions[0];
    const requestedModel =
      familyModels.find(
        (model) =>
          model.reasoningLevel === requestedQuality?.id && isChatModelOptionSelectable(model)
      ) ||
      familyModels.find((model) => isChatModelOptionSelectable(model)) ||
      familyModels[0];
    return coerceSelectableChatModelOption({
      ...requestedModel,
      reasoningLevel: requestedQuality?.id || requestedModel.reasoningLevel,
      reasoningLabel: requestedQuality?.label || requestedModel.reasoningLabel,
      imageQuality: requestedQuality?.imageQuality || requestedModel.imageQuality,
    });
  }

  const requested = familyModels.find(
    (model) => model.reasoningLevel === normalizedReasoning && isChatModelOptionSelectable(model)
  );
  if (requested) return requested;

  return familyModels.find((model) => isChatModelOptionSelectable(model)) || familyModels[0];
}

export function getChatReasoningLabel(modelId?: string | null): string {
  return findChatModelOption(modelId)?.reasoningLabel || 'Low';
}

export function getDisplayedChatReasoningLabel(
  model?: Pick<
    ChatModelOption,
    'familyId' | 'reasoningLevel' | 'reasoningEffort' | 'reasoningLabel' | 'kind'
  > | null
): string {
  if (!model) return 'Low';
  if (model.kind === 'image') {
    return model.reasoningLabel || 'Medium';
  }
  if (model.familyId === 'gpt-5.4-mini') {
    const normalized = normalizeGpt54ReasoningLevel(model.reasoningEffort || model.reasoningLevel);
    return normalized === 'medium' ? 'Medium' : 'Low';
  }
  return model.reasoningLabel || 'Fast';
}

export function hydrateChatModelOption(value?: unknown): ChatModelOption | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    return findChatModelOption(value);
  }
  if (typeof value !== 'object') return undefined;

  const candidate = value as {
    id?: string;
    reasoningLevel?: ChatModelControlLevel | null;
    reasoningEffort?: ChatReasoningEffort | null;
    imageQuality?: ChatImageQualityLevel | null;
  };
  const familyId = normalizeModelFamilyId(candidate.id);
  if (!familyId) return undefined;

  const savedReasoning = String(
    candidate.imageQuality || candidate.reasoningEffort || candidate.reasoningLevel || ''
  )
    .trim()
    .toLowerCase() as ChatModelControlLevel;

  const hydrated =
    findChatModelOptionByFamilyAndReasoning(familyId, savedReasoning || undefined) ||
    findChatModelOption(candidate.id);
  return hydrated ? coerceSelectableChatModelOption(hydrated) : undefined;
}

export function isTextChatModelOption(model?: Pick<ChatModelOption, 'kind'> | null): boolean {
  return model?.kind !== 'image';
}

export function supportsVisionChatModel(modelId?: string | null): boolean {
  const normalized = String(modelId || '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('gpt') || normalized.startsWith('o')) return true;
  if (normalized.includes('grok')) return true;
  return false;
}

// CONTEXT MEMORY
// Updated: 2026-04-21
// Status: verified
// Why: composer image drafts now need two separate gates: text-chat vision
// models that can read current-turn uploads, and GPT Image models that can use
// uploads as edit/reference inputs.
// Debug Goal: the upload button must stay enabled for GPT Image models while
// still rejecting Grok image families that do not support uploaded-image edits.
// Search Tags: composer image drafts gpt image upload support grok image no edit
// Invariants:
// - GPT Image 1 Mini and GPT Image 2 accept composer uploads for image-edit flows.
// - Grok image families must not be treated as upload-edit capable.
// Failure Modes:
// - Reusing text-only vision gating hides GPT image edit support in the composer.
// - Treating all image models as upload-capable silently drops reference-image context.
export function supportsGeneratedImageInputModel(modelId?: string | null): boolean {
  const normalized = String(modelId || '')
    .trim()
    .toLowerCase();
  return normalized.startsWith('gpt-image-1-mini') || normalized.startsWith('gpt-image-2');
}

export const COMMON_TOKENS: Record<
  number,
  Array<{ address: string; symbol: string; decimals: number }>
> = {
  1: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 },
  ],
  8453: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', decimals: 6 },
    { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
  ],
  56: [{ address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', decimals: 18 }],
};

export const ACTION_CARD_TYPE_MAP: Record<
  string,
  'text' | 'strategy-card' | 'chart-card' | 'transaction-status-card' | 'polymarket-embed'
> = {
  show_strategy_card: 'strategy-card',
  show_chart_card: 'chart-card',
  show_transaction_status_card: 'transaction-status-card',
  show_cross_chain_status_card: 'transaction-status-card',
  show_polymarket_card: 'polymarket-embed',
};

export const formatChatDateSeparator = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStrToday = today.toISOString().split('T')[0];
  const dateStrYesterday = yesterday.toISOString().split('T')[0];

  if (dateStr === dateStrToday) return 'Today';
  if (dateStr === dateStrYesterday) return 'Yesterday';
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
};
