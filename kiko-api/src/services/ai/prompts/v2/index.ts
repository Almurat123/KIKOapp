import { CORE } from './CORE.js';
import { MODEL_ADAPTER } from './MODEL_ADAPTER.js';
import { OUTPUT_POLICY } from './OUTPUT_POLICY.js';
import { INTENT_POLICY } from './policies/IntentPolicy.js';
import { TRADING_POLICY } from './policies/TradingPolicy.js';

export const V2_PROMPT_MODULES = {
    CORE,
    MODEL_ADAPTER,
    OUTPUT_POLICY,
    INTENT_POLICY,
    TRADING_POLICY
};
