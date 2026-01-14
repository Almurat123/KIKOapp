# KIKO Suggestion System (Smart Terminal Guide)

> [!IMPORTANT]
> The KIKO Chat Interface is not just a bot—it is a **Context-Aware Smart Terminal**. The Suggestion System is the project's core "Unified Entry Point," designed to anticipate user intent and minimize keystrokes.

## 🛠️ System Architecture

The suggestion engine lives in the frontend (`kiko-web`) but maps inputs to structured backend tools.

### 1. Multi-Layer Matching Strategy
The engine (`SuggestionEngine.tsx`) evaluates input through multiple filters:

| Layer | Logic | Example |
| :--- | :--- | :--- |
| **NLU Prediction** | Maps natural language to commands + slots. | "Buy 0.1 ETH" -> `swap 0.1 ETH ...` |
| **Context Aware** | Offers tools based on detected entities (EVM/SOL Address). | `0x123...` -> [Chart, Risk, Info] |
| **IDE Completion** | Exact, Prefix, and Alias matching for CLI-style use. | `sw` -> `swap`, `tr` -> `trending` |
| **Fuzzy Subsequence** | Handles typos and partial matches. | `pnlch` -> `analyze pnl` |
| **Personalization** | Boosts score based on user's frequent commands. | `UsageTracker` boosts common tasks. |

---

## 💾 Parameter Memory & Slot Filling

The system utilizes `ParamMemory` (localStorage) to "remember" session context:
*   **Last Address**: If you view a chart for `TokenX`, then type "risk", it automatically proposes `token risk TokenX`.
*   **Default Amounts**: Remembers the last swap amount (e.g., `0.01`) to pre-fill swap suggestions.
*   **Token Pairs**: Tracks `tokenIn` and `tokenOut` history to guess swap directions.

---

## 🎯 Command Registry (The Terminal Language)

The suggestion engine draws from a centralized `CommandRegistry.ts`. Every command has:
- **Pattern**: `swap {amount} {tokenIn} to {tokenOut}`
- **Aliases**: `buy`, `sell`, `trade`
- **Category**: Trading, Analysis, Social, General

---

## 🧠 LLM Integration Flow

The Suggestion System and the LLM work in a feedback loop:
1.  **Typing Stage**: The frontend engine provides instant, non-AI suggestions (Regex/Fuzzy).
2.  **Commit Stage**: The user selects a suggestion, which inserts a **Structured Command String** into the input.
3.  **Submission Stage**: This command string is sent to the backend.
4.  **AI Orchestration**: The `PromptOrchestrator` uses the structured input to trigger high-confidence tool calls.

---

## 📝 Rules for Future Development

1.  **New Features = New Commands**: To add an AI capability, first add it to `CommandRegistry.ts`.
2.  **Bilingual Patterns**: Always add both English and Chinese regex patterns to `INTENT_PATTERNS` in `SuggestionEngine.tsx`.
3.  **High-Confidence Shortcuts**: If an input is high-confidence (e.g., specific address paste), ALWAYS offer `Token Risk` and `Chart` as the first two suggestions.
4.  **No Dead Ends**: If no commands match, fallback to `Popular Suggestions` to keep the user moving.
