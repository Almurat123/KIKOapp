# Intent Monitoring Schema (Minimum)

## Input
- timestamp
- session_id
- user_id
- raw_text
- language
- has_contract_address
- has_amount
- has_action

## Decision
- primary_intent
- confidence
- hard_rule (label + reason)
- slots_complete
- labels_top3
- conflict_type
- routing_stage

## Routing
- mode (thinking/execution)
- tools_gated (true/false)
- matched_skills

## Outcome
- model
- response_type (analysis/ask_confirm/execute)
- user_follow_up (next_intent, next_message_id)
- executed_trade (true/false)
