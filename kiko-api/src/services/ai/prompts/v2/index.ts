import { CORE_EXECUTION, CORE_THINKING } from './CORE.js';
import { INTENT_POLICY } from './policies/IntentPolicy.js';
import { TRADING_POLICY } from './policies/TradingPolicy.js';
import { AnalystPolicy } from './policies/AnalystPolicy.js';
import { GENERAL_THINKING_POLICY } from './policies/GeneralThinkingPolicy.js';

export const V2_PROMPT_MODULES = {
    CORE_EXECUTION,
    CORE_THINKING,
    INTENT_POLICY,
    TRADING_POLICY,
    ANALYST_POLICY: AnalystPolicy,
    GENERAL_THINKING_POLICY,
};
