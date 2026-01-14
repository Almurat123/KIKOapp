# KIKO Project Context (Master Guide)

> [!IMPORTANT]
> This document is the **Single Source of Truth** for any LLM working on Kiko. It aggregates architectural facts, business logic, prompt engineering rules, and specialized personas defined across the codebase.

## 🏗️ System Architecture

Kiko is a **multi-service** AI Trading Terminal orchestrated via Docker.

| Service | Path | Tech Stack | Port | Role |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `kiko-web` | React 19, Vite, Tailwind, Framer Motion | 5173 | UI, Stream Rendering, Card Components |
| **Backend** | `kiko-api` | Node.js, Fastify, Prisma, Redis | 3001 | Transaction Logic, Data Jobs, **Prompt Orchestration** |
| **AI Layer** | `kiko-python` | Python, FastAPI, xAI Grok SDK | 8000 | LLM Inference (Grok), RAG, Model Serving |

---

## 🧠 Prompt Engineering Architecture

Kiko uses a **Modular, Dynamic Prompt Injection** system defined in `pro.txt` and implemented in `PromptOrchestrator.ts`.
**The AI Service (`kiko-python`) is a CONSUMER of prompts defined in `kiko-api`.**

### Core Modules (Dynamic Assembly)
Every request to the LLM is assembled from these blocks:
1.  **IDENTITY**: Core personality (Model-agnostic).
2.  **MODEL_SAFETY**: `GROK_SAFETY` (Strict) vs `DEEPSEEK_SAFETY` (Reasoning-focused).
3.  **TOOL_DIRECTIVE**: Dynamic tool definitions from `toolPromptGenerator.ts`.
4.  **KIKO_RULES**: Global business rules.
5.  **USER_PREFERENCES**: Dynamic block injected based on user settings (Quick Swap, Allowance Mode).

---

## 🎭 Specialized Agent Personas

Kiko is not a single agent. It switches "hats" based on the task. You must adhere to the specific rules of the active persona.

### 1. Launchpad Decision Engine (from `Juage.md`)
**Role**: `Launchpad Decision Engine v3.5`
**Goal**: Analyze new tokens via a 5-layer decision matrix.
**Priority**: `Liquidity Layer` > `Structure Layer` > `Stage Layer` > `Token Intelligence` > `User Size`.
**Critical Rule**: If **Liquidity Layer** says BLOCK, the final decision is **BLOCK**.
**Output**: Strict JSON (No markdown, no commentary outside JSON).

### 2. Web3 News Reporter (from `News_prompt.md`)
**Role**: `Web3 Hot Token Analysis Reporter`
**Goal**: Generate insights without external links or hallucinations. (No-Source Edition).
**Narrative Logic**:
*   **Creator Coin Correction**: Tokens from Zora/Paragraph/Base Creator Economy MUST be labeled as `Character/Community Narrative`, **NEVER** `Meme Narrative`.
*   **Writing Style**: Adaptive (Short commentary vs Deep analysis).
*   **Constraints**: No fake dates, no hallucinated prices. If info is missing -> "Limited information, no speculation."

### 3. News Compliance Editor (from `newsrules.md`)
**Role**: Content Compliance Officer.
**Red Lines**:
*   No "Guaranteed 100x" or "Insider Info".
*   Must add **Risk Disclaimer** to all financial content.
*   No political sensitivity, violence, or illegal content.

### 4. User Interaction Models (from `Xai.md`)
The system must handle diverse user personas defined in `Xai.md`. Your responses should adapt to the user's tone (while maintaining safety):
*   **Degen Trader**: Uses slang ("ape in", "wen moon", "rekt check"). Expects speed and "Alpha".
*   **Whale/Institutional**: Asks for depth charts, slippage analysis, cross-chain asset breakdowns. Expects professional reports.
*   **Snipe/Bot Operator**: Commands related to auto-buy limits, stop losses, and mempool monitoring.
*   **Data Analyst**: Requests CSV exports, correlation coefficients, and on-chain metrics.
*   **Community Manager**: Asks for sentiment analysis, viral cast alerts, and KOL tracking.

---

## ⚙️ Key Domain Constraints & Logic

### 1. User Preferences (`[USER_PREFERENCES_MODULE]`)
The logic shifts based on user config (`ctx.toolConfig`):
*   **Quick Swap Mode**:
    *   **Goal**: Speed > Safety.
    *   **Action**: Trace *prepare_swap_transaction* IMMEDIATELY.
    *   **Override**: IGNORE Price Deviation warnings (unless >80% Tax/Honeypot).
*   **Allowance Trade Mode**: execution occurs automatically (`execute=true`).
*   **Price Deviation**: Default rule is **BLOCK** if deviation > 50%. (Strict rule in `tokenRisk.ts` and `solanaSwap.ts`).

### 2. Transaction Flow (The 'Card' System)
AI **never** executes transactions directly via text.
1.  **AI**: Calls `prepare_swap_transaction` tool.
2.  **Backend**: Returns a structured JSON result.
3.  **Frontend**: Renders a UI **Card** (`ExecutionPreviewCard`, `StrategyCard`, `TokenCard`).
4.  **User**: Manually clicks "Confirm" on the UI Card.

### 3. Data Sources & Tooling
*   **Price**: Coinbase (Major coins) > DexScreener (Long tail).
*   **Safety**: GoPlus / RugCheck (via `check_token_risk`).
*   **Social**: Neynar (Farcaster data).
*   **Prediction**: Polymarket (trending/search).
*   **Protocols**: Native support for Uniswap (v2/v3/v4), 0x, and Jupiter.

### 4. Protocol Knowledge (from `Uniswap.md`)
*   **Version Awareness**: Distinguish between Uniswap v2, v3 (Concentrated Liq), and v4 (Hooks).
*   **Risk**: Always warn about Impermanent Loss and Smart Contract risk when discussing pools.

---

## 📝 Developer Rules (for You)

1.  **Golden Rule**: **Code in English**, **UI/Comments in Chinese**.
2.  **Prompt Updates**: If you modify agent behavior, you MUST update the underlying prompt module in `kiko-api/src/services/ai/prompts/`. Do NOT hardcode prompts in Python.
3.  **Safety First**: Never output logic that bypasses the `Liquidity > Structure` hierarchy in the Decision Engine.
4.  **No Hallucinations**: In News/Analysis mode, strictly follow `News_prompt.md` constraints (No fake URLs). 
5.  **Context Aware**: Always check `LLM_CONTEXT.md` first.
