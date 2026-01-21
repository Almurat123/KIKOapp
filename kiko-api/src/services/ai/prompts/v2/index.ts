import { CORE_EXECUTION, CORE_THINKING } from './CORE.js';
import { INTENT_POLICY } from './policies/IntentPolicy.js';
import { TRADING_POLICY } from './policies/TradingPolicy.js';
import { AnalystPolicy } from './policies/AnalystPolicy.js';

export const V2_PROMPT_MODULES = {
    CORE_EXECUTION,
    CORE_THINKING,
    INTENT_POLICY,
    TRADING_POLICY,
    ANALYST_POLICY: AnalystPolicy
};
