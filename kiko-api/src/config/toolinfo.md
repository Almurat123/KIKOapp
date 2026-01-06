# KiKo AI Tool Directory (Standardized)

This document serves as the **Technical Reference** for all tools available to the AI agents (DeepSeek & Grok). It defines exactly which tools exist, what they do, and what data they return.

---

## 📊 MARKET DATA
| Tool Name | Technical Description | Key Return Fields (JSON) |
| :--- | :--- | :--- |
| `get_token_price` | Real-time price for major coins (BTC/ETH/SOL) via Coinbase. | `symbol`, `price` (USD string), `priceRaw` (number) |
| `get_historical_price` | Price for a specific date (YYYY-MM-DD) since 2010. | `symbol`, `date`, `price`, `priceRaw` |
| `get_trending_tokens` | Top tokens by volume/liquidity on a specific chain. | `Array<{ rank, name, symbol, price, volume, change, liquidity }>` |
| `get_gas_price` | Current network fees (Safe/Market/Fast). | `{ baseFee, low: { maxFee, priorityFee }, ... }` |
| `get_market_overview` | Macro indices (VIX, DXY, Gold, Oil) + Fear & Greed Index. | `{ indicators: [], marketSentiment: { score, label, analysis } }` |

## 🔄 TRADING & SAFETY
| Tool Name | Technical Description | Key Return Fields (JSON) |
| :--- | :--- | :--- |
| `prepare_swap_transaction` | **CRITICAL**: Generates trading action for swaps. | `{ __client_action: { type: 'execute_swap_instant'\|'show_swap_card', payload: { ... } }, summary: "Short description" }` |
| `check_token_risk` | **SECURITY**: Scans contract for Honeypots, taxes, and rug-pull risks. | `{ status: 'Safe'\|'High Risk', riskScore, isHoneypot, warnings, recommendation }` |

## 🔍 INFO & RESEARCH
| Tool Name | Technical Description | Key Return Fields (JSON) |
| :--- | :--- | :--- |
| `get_token_info` | Metadata, Price, Liquidity, and FDV for any contract address. | `{ name, symbol, address, price, liquidity, fdv, priceChange24h, volume24h }` |
| `web_search` | Real-time news and general info from the live web. | `{ results: "Text summary...", citations: ["URL1", ...] }` |

## 👛 WALLET & PERSONAL
| Tool Name | Technical Description | Key Return Fields (JSON) |
| :--- | :--- | :--- |
| `get_wallet_info` | Balance & History for any address (Public or User). | `{ ethBalance, tokens: [{ symbol, balance, contract }], recentTransactions: [] }` |
| `get_user_favorites` | Fetches the user's specific watchlist from database. | `{ count, favorites: [{ name, symbol, chain, address }] }` |

## 💬 SOCIAL (FARCASTER)
| Tool Name | Technical Description | Key Return Fields (JSON) |
| :--- | :--- | :--- |
| `get_trending_casts` | Hot posts/narratives on Farcaster (last 24h). | `{ count, casts: [{ author: { username }, text, stats: { likes, recasts } }] }` |
| `get_farcaster_user` | Profile & post history for specific Farcaster ID (FID). | `{ user: { username, displayName, pfp, bio }, casts: [] }` |

## 🤖 COPY TRADING
| Tool Name | Technical Description | Key Return Fields (JSON) |
| :--- | :--- | :--- |
| `create_copy_trade_config` | Deploys a new automated mirror trading task. | `{ summary, config_id }` |
| `list_copy_trade_configs` | Active copying tasks for the current user. | `Array<{ id, target, buy_amount, status }>` |
| `delete_copy_trade_config` | Stop and remove a mirror trading task. | `{ summary }` |
| `pause_copy_trade_config` | Pause/Resume an existing automated task. | `{ summary }` |

---

## 🛠 GLOBAL STANDARDS & LLM PRO-TIPS

As an LLM, follow these strict rules to ensure tool reliability:

### 1. Chain Identifier Mapping (Slug System)
Always use these **lowercase slugs** for the `chain` parameter:
- `eth` (Ethereum Mainnet)
- `base` (Coinbase Base)
- `solana` (or `sol`)
- `bsc` (Binance Smart Chain)
- `arbitrum` / `polygon` / `optimism` / `avalanche`

### 2. Error Handling Protocol
All tools return a consistent error object on failure:
`{ error: "Detailed reason for failure" }`
> [!IMPORTANT]
> If you see an `error` field, **DO NOT** make up data. Inform the user or suggest an alternative (e.g., if `get_token_info` fails, try `web_search`).

### 3. Numeric Precision
- **Amounts**: For `prepare_swap_transaction`, `amount_in` MUST be a string representation of a number (e.g., `"0.5"`). 
- **Hallucination Check**: If a user says "Sell all my PEPE", you **MUST** call `get_wallet_info` first to get the exact numeric balance, then pass that number to the swap tool. Never pass `"all"` or `"max"`.

### 4. Search Priority (The "Fallback Strategy")
1. Use `get_token_info` for contract-based research.
2. Use `get_token_price` for major coin symbols.
3. Use `web_search` only as a last resort for news or unlisted tokens.

### 5. Execution vs. Simulation
- `prepare_swap_transaction` has an `execute` parameter (default `true`). 
- If you just want to show the user a preview, set `execute: false`. 
- If the user says "Buy X now", keep `execute: true`.
