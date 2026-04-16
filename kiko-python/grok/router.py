"""
Grok API Service - FastAPI proxy for xAI Grok API
Supports streaming responses and tool use (web_search, x_search, custom tools)
"""
# CONTEXT MEMORY
# Updated: 2026-04-16
# Author: Rowan
# Reason: Grok social-agent requests now carry current-turn X/Farcaster post
#         images as structured content from Node. xAI's official image
#         understanding path requires image inputs to be passed as image content
#         objects rather than text-only URLs, and advises not to store
#         request/response history for image requests.
# Goal: convert structured social image content into xAI SDK image inputs while
#       keeping the existing streaming/tool protocol stable.
# Owns: xAI SDK request construction, native search/tool attachment, stream
#       normalization, and Grok-specific provider safety gates.
# Does Not Own: Node-side provider selection, social webhook hydration, or
#               NVIDIA/OpenAI multimodal request shaping.
# Design Language:
# - Grok receives the same upstream `text` + `image_url` shape as other
#   OpenAI-compatible providers, then adapts it at the xAI boundary.
# - Image URLs are provider inputs, not prompt-text evidence.
# - xAI image requests must not rely on server-stored prior messages.
# - Tool streaming and citation events must remain compatible with existing
#   chat-completion consumers.
# Document Provenance:
# - Source: xAI Image Understanding docs
# - Kind: official API doc
# - Retrieved: 2026-04-16
# - Applied To: converting structured image content to xAI SDK image inputs and
#   disabling server-side history storage for image requests
# - Verification: verified in docs and code
# See also:
# - /Users/almurat/KiKo/system-journal/INDEX.md
# - /Users/almurat/KiKo/system-journal/design-language/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/owner-map/social-agent-multimodal-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-kimi-grok-social-image-input.md
# - /Users/almurat/KiKo/system-journal/fix-log/2026-04-16-social-agent-thread-context-and-image-input.md
import os
import json
import grpc
import requests
import httpx
import re
from typing import Any, Dict, List, Optional, AsyncGenerator
from datetime import datetime
from functools import lru_cache
import time
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from xai_sdk.chat import user, system, tool, tool_result, image as chat_image
from xai_sdk.tools import (
    web_search,
    x_search,
    code_execution,
    collections_search,
    mcp,
    get_tool_call_type
)
from xai_sdk.aio import chat as aio_chat
from jose import jwt
from grok.tool_bridge import normalize_tool_request
from grok.tool_events import build_stream_chunk_id, build_tool_status_chunk, summarize_tool_names
from grok.tool_policy import resolve_requested_tool_policy
from grok.tool_scheduler import PlannedToolCall, execute_planned_custom_tools
from grok.message_content import (
    append_text_content,
    extract_image_urls,
    extract_text_content,
    messages_have_image_content,
)

# Load environment variables
load_dotenv()

kb = None


def rag_enabled() -> bool:
    return os.getenv("ENABLE_RAG_SERVICE", "false").strip().lower() in {"1", "true", "yes", "on"}


ALLOW_LEGACY_TOOL_FALLBACK = os.getenv("GROK_ALLOW_LEGACY_TOOL_FALLBACK", "false").strip().lower() in {"1", "true", "yes", "on"}
ALLOW_PYTHON_CUSTOM_TOOLS_FALLBACK = os.getenv("GROK_ALLOW_PYTHON_CUSTOM_TOOLS_FALLBACK", "false").strip().lower() in {"1", "true", "yes", "on"}

# Logging disabled to avoid stream blocking from excessive stdout.
def log_citations(message: str) -> None:
    return


def log_tools(message: str) -> None:
    return


def normalize_citations_for_client(citations: List[Any]) -> List[Dict[str, str]]:
    normalized: List[Dict[str, str]] = []
    seen_urls = set()

    for item in citations or []:
        cite_dict: Dict[str, str] = {}

        if hasattr(item, "url"):
            url = str(getattr(item, "url", "") or "").strip()
            if url:
                cite_dict["url"] = url
            for attr in ["title", "snippet", "avatar_url", "avatarUrl", "avatar", "icon_url", "iconUrl"]:
                value = getattr(item, attr, None)
                if value:
                    key = "avatar_url" if attr in {"avatarUrl", "avatar", "icon_url", "iconUrl"} else attr
                    cite_dict[key] = str(value)
        elif isinstance(item, dict):
            url = str(item.get("url", "") or "").strip()
            if url:
                cite_dict["url"] = url
            if item.get("title"):
                cite_dict["title"] = str(item["title"])
            if item.get("snippet"):
                cite_dict["snippet"] = str(item["snippet"])
            for attr in ["avatar_url", "avatarUrl", "avatar", "icon_url", "iconUrl"]:
                value = item.get(attr)
                if value:
                    cite_dict["avatar_url"] = str(value)
                    break
        elif isinstance(item, str):
            url = item.strip()
            if url:
                cite_dict["url"] = url

        url = cite_dict.get("url")
        if not url or url in seen_urls:
            continue

        seen_urls.add(url)
        normalized.append(cite_dict)

    return normalized


def merge_citations_unique(collected: List[Any], incoming: List[Any]) -> List[Any]:
    seen_urls = set()
    merged: List[Any] = []
    for item in list(collected or []) + list(incoming or []):
        normalized = normalize_citations_for_client([item])
        if not normalized:
            continue
        cite = normalized[0]
        url = str(cite.get("url") or "").strip()
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        merged.append(cite)
    return merged


def get_kb():
    """
    Lazy-load the RAG KnowledgeBase when RAG is explicitly enabled.
    IMPORTANT: We must not import `rag.vectorstore` at module import time, otherwise the whole Grok service
    fails to mount when optional RAG dependencies (e.g. `langchain_chroma`) are not installed.
    """
    if not rag_enabled():
        return None
    global kb
    if kb is not None:
        return kb
    try:
        from rag.vectorstore import KnowledgeBase  # type: ignore
        kb = KnowledgeBase()
        return kb
    except Exception as e:
        # Missing optional deps or missing OPENAI_API_KEY should not kill Grok chat.
        print(f"[RAG] Disabled (KnowledgeBase init failed): {e}")
        kb = None
        return None

app = FastAPI(title="Grok API Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Grok client with better timeout
xai_api_key = os.getenv("XAI_API_KEY")
if not xai_api_key:
    raise ValueError("XAI_API_KEY not found in environment variables")

# Privy auth configuration
PRIVY_JWKS_URL = os.getenv("PRIVY_JWKS_URL", "https://auth.privy.io/api/v1/keys")
PRIVY_APP_ID = os.getenv("PRIVY_APP_ID")
SKIP_AUTH = os.getenv("SKIP_AUTH", "false").lower() == "true"


_jwks_last_good = None


@lru_cache(maxsize=1)
def get_jwks():
    global _jwks_last_good
    last_err = None
    for attempt in range(3):
        try:
            resp = requests.get(PRIVY_JWKS_URL, timeout=3)
            resp.raise_for_status()
            data = resp.json()
            if "keys" not in data:
                raise HTTPException(status_code=500, detail="JWKS response invalid")
            _jwks_last_good = data
            return data
        except Exception as e:
            last_err = e
            time.sleep(0.2 * (attempt + 1))
    if _jwks_last_good is not None:
        return _jwks_last_good
    raise HTTPException(status_code=503, detail=f"JWKS fetch failed: {last_err}")


def verify_privy_token(token: str):
    try:
        unverified = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token header: {e}")

    jwks = get_jwks()
    kid = unverified.get("kid")
    key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

    # Refresh JWKS once if kid not found
    if not key:
        get_jwks.cache_clear()
        jwks = get_jwks()
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == kid), None)

    if not key:
        raise HTTPException(status_code=401, detail="JWKS key not found")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=[key.get("alg", "RS256")],
            audience=PRIVY_APP_ID if PRIVY_APP_ID else None,
        )
        return claims
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def require_auth(authorization: str = Header(default=None), x_service_key: str = Header(default=None)):
    # Skip auth in development mode
    if SKIP_AUTH:
        return {"dev": True}

    # Check for internal service key first
    internal_key = os.getenv("INTERNAL_SERVICE_KEY")
    if internal_key and x_service_key == internal_key:
        return {"service": "internal"}
    
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.split(" ", 1)[1].strip()
    return verify_privy_token(token)

# Use AsyncClient for non-blocking streaming
# Use AsyncClient for non-blocking streaming
from xai_sdk import AsyncClient
# client will be initialized inside the request handler to ensure it uses the correct event loop

# ============================================
# CUSTOM TOOLS FOR GROK
# These tools allow Grok to call our backend APIs
# ============================================

KIKO_API_BASE = os.getenv("KIKO_API_URL", "http://localhost:3001")

# Define custom tools with JSON schema (same format as OpenAI function calling)
check_token_risk_tool = tool(
    name="check_token_risk",
    description="Scan a token contract for security risks including honeypot detection, rug pull indicators, ownership analysis, and tax rates. Use this when user asks about token safety or security.",
    parameters={
        "type": "object",
        "properties": {
            "address": {
                "type": "string",
                "description": "Token contract address (0x... for EVM, or base58 for Solana)"
            },
            "chain": {
                "type": "string",
                "description": "Blockchain name: ethereum, bsc, base, polygon, arbitrum, avalanche, solana",
                "default": "ethereum"
            }
        },
        "required": ["address"]
    }
)

get_token_price_tool = tool(
    name="get_token_price",
    description="Get current price, market cap, volume, and price change data for a token. Use this when user asks about token prices or market data.",
    parameters={
        "type": "object",
        "properties": {
            "symbol_or_address": {
                "type": "string",
                "description": "Token symbol (ETH, BTC, USDC) or contract address"
            },
            "chain": {
                "type": "string",
                "description": "Blockchain name: ethereum, bsc, base, polygon, solana",
                "default": "ethereum"
            }
        },
        "required": ["symbol_or_address"]
    }
)

get_trending_tokens_tool = tool(
    name="get_trending_tokens",
    description="Get currently trending/hot cryptocurrency tokens by trading activity. ONLY use this when user explicitly asks about: trending tokens, hot coins, what tokens are pumping, market movers, top gainers, or specific chain activity. Do NOT use this for general news, world events, crypto industry news, or non-token topics. For news (regulations, hacks, company updates), use web_search instead.",
    parameters={
        "type": "object",
        "properties": {
            "chain": {
                "type": "string",
                "description": "Filter by chain: all, ethereum, bsc, base, solana",
                "default": "all"
            },
            "limit": {
                "type": "integer",
                "description": "Number of tokens to return (1-50)",
                "default": 10
            }
        },
        "required": []
    }
)

prepare_swap_transaction_tool = tool(
    name="prepare_swap_transaction",
    description="""Prepare and execute a swap transaction for the user. Use this when user explicitly wants to buy, sell, or swap tokens.

IMPORTANT: If user says 'all', 'max', or 'full balance':
1. First call get_wallet_info to get their current balance for the source token
2. Then use the EXACT balance amount (e.g. '0.622398') as amount_in - NOT 'all'
3. This ensures the swap uses the correct amount

The amount_in parameter MUST be a numeric string like '0.1' or '100'. Never pass 'all' or 'max' as amount_in.""",
    parameters={
        "type": "object",
        "properties": {
            "token_in": {
                "type": "string",
                "description": "Source token address or symbol (e.g. USDC, ETH, or 0x...)",
                "default": "ETH"
            },
            "token_out": {
                "type": "string",
                "description": "Target token address or symbol (e.g. TRUMP, PEPE, or 0x...)"
            },
            "amount_in": {
                "type": "string",
                "description": "NUMERIC amount to swap (e.g. '0.1', '100'). Must be a number, not 'all' or 'max'. Get actual balance from get_wallet_info first."
            },
            "chain_id": {
                "type": "integer",
                "description": "Chain ID (1=Eth, 8453=Base, 56=BSC, 137=Polygon)",
                "default": 1
            },
            "slippage": {
                "type": "number",
                "description": "Slippage tolerance in percentage (e.g. 0.5)",
                "default": 0.5
            },
            "max_price_impact": {
                "type": "number",
                "description": "Maximum price impact/loss tolerance in percentage (e.g. 1, 3, 5). Default is 5.",
                "default": 5
            }
        },
        "required": ["token_out", "amount_in"]
    }
)

# Additional tools
get_token_info_tool = tool(
    name="get_token_info",
    description="Get current price, volume, and detailed metadata for a specific token on a blockchain. Use this for detailed token analysis.",
    parameters={
        "type": "object",
        "properties": {
            "address": {
                "type": "string",
                "description": "The smart contract address of the token (e.g. 0x...)"
            },
            "chain": {
                "type": "string",
                "description": "The blockchain network ID (e.g. eth, solana, base, bsc)",
                "enum": ["eth", "solana", "base", "bsc", "arbitrum", "polygon", "optimism", "avalanche"]
            }
        },
        "required": ["address", "chain"]
    }
)

get_wallet_info_tool = tool(
    name="get_wallet_info",
    description="Get wallet information including ETH balance, token holdings, and recent transaction history. Can check the user's connected wallet or any specific address.",
    parameters={
        "type": "object",
        "properties": {
            "address": {
                "type": "string",
                "description": "The wallet address to check. If not provided, will try to use the connected user's address."
            },
            "chain": {
                "type": "string",
                "description": "Blockchain network (eth, base, arbitrum, optimism, polygon, bsc). Default is eth.",
                "default": "eth"
            },
            "includeHistory": {
                "type": "boolean",
                "description": "Whether to include recent transaction history. Default is false.",
                "default": False
            }
        },
        "required": []
    }
)

get_gas_price_tool = tool(
    name="get_gas_price",
    description="Get real-time gas prices and transaction fees for a blockchain network. Use this when user asks about 'how much is gas', 'transaction cost', 'gwei', or 'fee'.",
    parameters={
        "type": "object",
        "properties": {
            "chain": {
                "type": "string",
                "description": "Blockchain network (eth, bsc, polygon, arbitrum, optimism, base, avalanche). Default is eth.",
                "default": "eth"
            }
        },
        "required": []
    }
)

get_historical_price_tool = tool(
    name="get_historical_price",
    description="Get historical price for a cryptocurrency on a specific date. Use this to analyze price trends or answer 'what was the price on [date]' questions.",
    parameters={
        "type": "object",
        "properties": {
            "symbol": {
                "type": "string",
                "description": "Token symbol (e.g., BTC, ETH, SOL). Case insensitive."
            },
            "date": {
                "type": "string",
                "description": "Date in YYYY-MM-DD format (e.g., 2024-01-01, 2023-12-25)"
            }
        },
        "required": ["symbol", "date"]
    }
)

create_copy_trade_task_tool = tool(
    name="create_copy_trade_task",
    description="Create an automated copy trading task to follow a target wallet. Use this when user asks to 'copy trade', 'follow wallet', or 'auto buy when X buys'.",
    parameters={
        "type": "object",
        "properties": {
            "target_wallet": {
                "type": "string",
                "description": "Target wallet address to follow/copy"
            },
            "buy_amount_usd": {
                "type": "number",
                "description": "Amount in USD to buy for each trade. Default 50 if not specified."
            },
            "chain": {
                "type": "string",
                "description": "Chain name (base, eth). Default base.",
                "default": "base"
            },
            "take_profit_pct": {
                "type": "number",
                "description": "Take profit percentage (e.g. 50 for 50%). Optional."
            },
            "stop_loss_pct": {
                "type": "number",
                "description": "Stop loss percentage (e.g. 20 for 20%). Optional."
            },
            "min_target_value_usd": {
                "type": "number",
                "description": "Minimum transaction value in USD to trigger a copy trade. Optional."
            }
        },
        "required": ["target_wallet"]
    }
)

fetch_farcaster_trending_tool = tool(
    name="fetch_farcaster_trending",
    description="Get top 30 trending Farcaster casts from the last 24 hours. Use this when user asks about trending posts, popular casts, or what's hot on Farcaster.",
    parameters={
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Number of casts to return (1-30). Default is 30.",
                "default": 30
            }
        },
        "required": []
    }
)

get_farcaster_user_tool = tool(
    name="get_farcaster_user",
    description="Get Farcaster user profile and recent casts by FID (Farcaster ID). Use this when user asks about a specific Farcaster user or their posts.",
    parameters={
        "type": "object",
        "properties": {
            "fid": {
                "type": "integer",
                "description": "Farcaster user ID (FID)"
            },
            "include_casts": {
                "type": "boolean",
                "description": "Whether to include recent casts. Default is true.",
                "default": True
            }
        },
        "required": ["fid"]
    }
)

search_farcaster_casts_tool = tool(
    name="search_farcaster_casts",
    description="Search Farcaster casts by keyword. Use this when user asks to find, search, or look for specific posts/casts on Farcaster. Searches in cast text and author names.",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search query - keywords to search for in Farcaster casts"
            },
            "limit": {
                "type": "integer",
                "description": "Number of results to return (1-30). Default is 15.",
                "default": 15
            }
        },
        "required": ["query"]
    }
)

# Polymarket Prediction Market Tools
get_polymarket_trending_tool = tool(
    name="get_polymarket_trending",
    description="Get trending prediction market events from Polymarket, sorted by trading volume. Use this when user asks about prediction markets, betting odds, or 'what are people betting on'.",
    parameters={
        "type": "object",
        "properties": {
            "limit": {
                "type": "integer",
                "description": "Number of events to return (1-20). Default is 10.",
                "default": 10
            }
        },
        "required": []
    }
)

get_polymarket_event_tool = tool(
    name="get_polymarket_event",
    description="Get detailed information about a specific Polymarket prediction event, including all related markets and their current probabilities. Use this when user asks about a specific prediction topic (e.g., 'Bitcoin price prediction', 'election odds').",
    parameters={
        "type": "object",
        "properties": {
            "event_id": {
                "type": "string",
                "description": "The Polymarket event ID to fetch details for."
            }
        },
        "required": ["event_id"]
    }
)

search_polymarket_tool = tool(
    name="search_polymarket",
    description="Search Polymarket prediction events by keyword. Use this when user asks about prediction odds for a specific topic (e.g., 'Bitcoin', 'Trump', 'Fed rate', 'recession').",
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search keyword (e.g., 'bitcoin', 'election', 'fed', 'recession')"
            },
            "limit": {
                "type": "integer",
                "description": "Number of results to return (1-20). Default is 10.",
                "default": 10
            }
        },
        "required": ["query"]
    }
)

analyze_wallet_pnl_tool = tool(
    name="analyze_wallet_pnl",
    description="Analyze a wallet's trading performance, regular PnL, and win rate. Use this when user asks about a wallet's performance or profit/loss.",
    parameters={
        "type": "object",
        "properties": {
            "address": {
                "type": "string",
                "description": "The wallet address to analyze"
            },
            "chain": {
                "type": "string",
                "description": "Blockchain network (eth, base, solana, bsc). Default is eth.",
                "default": "eth"
            }
        },
        "required": ["address"]
    }
)

get_token_early_buyers_tool = tool(
    name="get_token_early_buyers",
    description="Identify 'smart money' early adopters or first buyers of a specific token. Use this to find who bought a token early in its lifecycle.",
    parameters={
        "type": "object",
        "properties": {
            "address": {
                "type": "string",
                "description": "The token contract address"
            },
            "chain": {
                "type": "string",
                "description": "Blockchain network (eth, base, solana, bsc)",
                "default": "eth"
            },
            "limit": {
                "type": "integer",
                "description": "Number of early buyers to return. Default is 10.",
                "default": 10
            },
            "start_time": {
                "type": "string",
                "description": "Optional start time filter (ISO string or unix seconds). Example: '2026-01-01T00:00:00Z' or '1704067200'."
            },
            "end_time": {
                "type": "string",
                "description": "Optional end time filter (ISO string or unix seconds). Example: '2026-01-08T00:00:00Z' or '1704672000'."
            }
        },
        "required": ["address"]
    }
)

analyze_website_deep_tool = tool(
    name="analyze_website_deep",
    description="Deeply analyze a crypto project website using a real browser (Playwright). Extracts team information, GitHub repository links, tokenomics details, documentation links, social media profiles, and product features. Use this when you need comprehensive website analysis beyond basic content fetching.",
    parameters={
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The website URL to analyze (e.g., 'https://uniswap.org')"
            },
            "project_name": {
                "type": "string",
                "description": "Optional name of the crypto project for context"
            }
        },
        "required": ["url"]
    }
)

# Token Alert Tools are handled dynamically via generic delegation to Node.js

# List of all custom tools
CUSTOM_TOOLS = [
    check_token_risk_tool, 
    get_token_price_tool, 
    get_trending_tokens_tool, 
    prepare_swap_transaction_tool,
    get_token_info_tool,
    get_wallet_info_tool,
    get_gas_price_tool,
    get_historical_price_tool,
    create_copy_trade_task_tool,
    fetch_farcaster_trending_tool,
    get_farcaster_user_tool,
    search_farcaster_casts_tool,
    # Polymarket tools
    get_polymarket_trending_tool,
    get_polymarket_event_tool,
    search_polymarket_tool,
    # Website analysis
    analyze_website_deep_tool,
    # Analytics tools
    analyze_wallet_pnl_tool,
    get_token_early_buyers_tool
]


def clean_numeric_precision(data, max_decimals=8):
    """
    Recursively clean numeric values in data to limit decimal precision.
    This prevents extremely long decimal numbers from consuming too much context.
    """
    if isinstance(data, dict):
        return {k: clean_numeric_precision(v, max_decimals) for k, v in data.items()}
    elif isinstance(data, list):
        return [clean_numeric_precision(item, max_decimals) for item in data]
    elif isinstance(data, float):
        # Round to max_decimals places
        return round(data, max_decimals)
    elif isinstance(data, str):
        # Try to parse as float and round if it's a numeric string
        try:
            num = float(data)
            # Only round if it has more than max_decimals decimal places
            if '.' in data and len(data.split('.')[1]) > max_decimals:
                return str(round(num, max_decimals))
            return data
        except (ValueError, AttributeError):
            return data
    else:
        return data


def normalize_tool_result(tool_result_data: str) -> tuple[str, Optional[dict]]:
    """
    Normalize tool results for Grok:
    - Extract __client_action for frontend events.
    - Prefer summary for LLM context if present.
    """
    client_action = None
    payload = tool_result_data
    try:
        parsed = json.loads(tool_result_data)
        if isinstance(parsed, dict) and "__client_action" in parsed:
            client_action = parsed.get("__client_action")
            if parsed.get("summary"):
                payload = str(parsed.get("summary"))
            else:
                stripped = {k: v for k, v in parsed.items() if k != "__client_action"}
                payload = json.dumps(stripped, indent=2)
    except Exception:
        pass
    return payload, client_action


async def execute_custom_tool(tool_name: str, arguments: dict, auth_token: str = None, tool_context: Optional[dict] = None) -> str:
    """
    Execute a custom tool by calling the kiko-api backend.
    Returns the result as a JSON string.
    
    Args:
        tool_name: Name of the tool to execute
        arguments: Tool arguments as a dictionary
        auth_token: Optional Privy JWT token for authenticated endpoints
    """
    tool_name, arguments = normalize_tool_request(tool_name, arguments, tool_context)
    print(f"[Tool Execution] Executing tool: {tool_name} with args: {arguments}")
    
    # Prepare headers with optional auth token
    headers = {}
    if auth_token:
        headers["Authorization"] = f"Bearer {auth_token}"
    
    # Add internal service key for server-to-server calls
    internal_key = os.getenv("INTERNAL_SERVICE_KEY", "")
    if internal_key:
        headers["X-Internal-Service-Key"] = internal_key
        # Compatibility with middleware that still reads legacy header name
        headers["X-Service-Key"] = internal_key
    app_key = os.getenv("KIKO_WEB_APP_KEY", "")
    if app_key:
        headers["X-App-Key"] = app_key
    
    try:
        # IMPORTANT: Many KiKo backend endpoints require user auth (Privy JWT).
        # If we don't forward Authorization, tool calls will silently fail (401) and look "broken" to the LLM.
        async with httpx.AsyncClient(timeout=30.0, headers=headers) as http_client:
            # Grok should use a single KiKo business-tool surface: Node's internal tool executor.
            # Python remains an xAI SDK adapter, not a second business-logic implementation.
            try:
                unified_payload = {
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "context": tool_context or {}
                }
                target_url = f"{KIKO_API_BASE}/internal/tools/execute"
                print(f"[Tool Execution] 🔍 KIKO_API_BASE = {KIKO_API_BASE}")
                print(f"[Tool Execution] 🔍 Calling unified executor at: {target_url}")

                unified_response = await http_client.post(target_url, json=unified_payload)
                if unified_response.status_code == 200:
                    unified_data = unified_response.json()
                    if isinstance(unified_data, dict) and unified_data.get("success") and "result" in unified_data:
                        unified_result = unified_data["result"]
                        if isinstance(unified_result, str):
                            return unified_result
                        return json.dumps(unified_result, indent=2)
                    return json.dumps({
                        "error": "Unified tool executor returned an invalid payload",
                        "tool": tool_name,
                        "details": str(unified_data)[:500],
                        "source": "internal_tools_execute"
                    }, indent=2)

                error_text = unified_response.text
                print(f"[Tool Execution] Unified tool executor failed ({unified_response.status_code})")
                return json.dumps({
                    "error": "Unified tool executor failed",
                    "tool": tool_name,
                    "status_code": unified_response.status_code,
                    "details": error_text[:500],
                    "source": "internal_tools_execute"
                }, indent=2)
            except Exception as unified_error:
                print(f"[Tool Execution] ❌ Unified tool executor error: {type(unified_error).__name__}: {unified_error}")
                print(f"[Tool Execution] ❌ Target URL was: {KIKO_API_BASE}/internal/tools/execute")
                return json.dumps({
                    "error": "Unified tool executor exception",
                    "tool": tool_name,
                    "details": str(unified_error),
                    "source": "internal_tools_execute"
                }, indent=2)

            if tool_name == "check_token_risk":
                address = arguments.get("address", "")
                chain = arguments.get("chain", "ethereum")
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/security/scan",
                    params={"address": address, "chain": chain}
                )
                if response.status_code == 200:
                    data = response.json()
                    # Clean numeric precision
                    data = clean_numeric_precision(data, max_decimals=6)
                    print(f"[Tool Execution] check_token_risk success: {len(str(data))} bytes")
                    return json.dumps(data, indent=2)
                else:
                    return json.dumps({"error": f"Security scan failed: {response.status_code}"})
                    
            elif tool_name == "get_token_price":
                symbol_or_address = arguments.get("symbol_or_address", "")
                chain = arguments.get("chain", "ethereum")
                
                # Map chain name to network format used by API
                chain_map = {
                    "ethereum": "eth",
                    "bsc": "bsc",
                    "base": "base",
                    "polygon": "polygon",
                    "solana": "solana"
                }
                network = chain_map.get(chain.lower(), "eth")
                
                # Major coins that should use Coinbase for accurate pricing
                major_coins = ["BTC", "ETH", "SOL", "BNB", "DOGE", "XRP", "ADA", "AVAX", "MATIC", "DOT", 
                               "LINK", "UNI", "ATOM", "LTC", "NEAR", "APT", "OP", "ARB", "SUI", "SEI"]
                
                symbol_upper = symbol_or_address.upper()
                
                # For major coins (symbols), use Coinbase endpoint for accurate pricing
                if symbol_upper in major_coins or (not symbol_or_address.startswith("0x") and len(symbol_or_address) <= 10):
                    # Try Coinbase endpoint first for major coins
                    response = await http_client.get(
                        f"{KIKO_API_BASE}/api/market/price/{symbol_upper}"
                    )
                    if response.status_code == 200:
                        data = response.json()
                        print(f"[Tool Execution] get_token_price success (Coinbase)")
                        # Return the data directly from Coinbase response
                        if isinstance(data, dict) and "data" in data:
                            return json.dumps(data["data"], indent=2)
                        return json.dumps(data, indent=2)
                    else:
                        print(f"[Tool Execution] Coinbase price not found for {symbol_upper}, falling back to DexScreener")
                
                # For contract addresses or if Coinbase fails, use DexScreener
                # Known token addresses for common symbols
                known_tokens = {
                    "USDC": {"eth": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},
                    "USDT": {"eth": "0xdAC17F958D2ee523a2206206994597C13D831ec7"},
                    "WETH": {"eth": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "base": "0x4200000000000000000000000000000000000006"},
                }
                
                # Check if it's a known stablecoin symbol
                if symbol_upper in known_tokens and network in known_tokens[symbol_upper]:
                    token_address = known_tokens[symbol_upper][network]
                    response = await http_client.get(
                        f"{KIKO_API_BASE}/api/tokens/{network}/{token_address}"
                    )
                elif symbol_or_address.startswith("0x") or len(symbol_or_address) > 20:
                    # It's an address, use direct token endpoint
                    response = await http_client.get(
                        f"{KIKO_API_BASE}/api/tokens/{network}/{symbol_or_address}"
                    )
                else:
                    # If it's a symbol not in major coins, search for it
                    response = await http_client.get(
                        f"{KIKO_API_BASE}/api/tokens/search",
                        params={"query": symbol_or_address, "chain": network}
                    )
                    
                if response.status_code == 200:
                    data = response.json()
                    print(f"[Tool Execution] get_token_price success (DexScreener)")
                    
                    # Extract and format data
                    if isinstance(data, dict) and "data" in data:
                        token_data = data["data"].copy()
                        
                        # Fix price formatting
                        if "price" in token_data:
                            price_value = token_data["price"]
                            try:
                                if isinstance(price_value, str):
                                    price_float = float(price_value)
                                else:
                                    price_float = float(price_value)
                                
                                if 0.9 <= price_float <= 1.1:
                                    token_data["price"] = f"${price_float:.2f}"
                                elif price_float < 1:
                                    token_data["price"] = f"${price_float:.6f}"
                                else:
                                    token_data["price"] = f"${price_float:.2f}"
                                
                                token_data["priceRaw"] = price_float
                            except (ValueError, TypeError) as e:
                                print(f"[Tool Execution] Warning: Could not parse price '{price_value}': {e}")
                        
                        # Format other numeric fields
                        for field in ["volume24h", "liquidity", "fdv"]:
                            if field in token_data and isinstance(token_data[field], str):
                                try:
                                    token_data[field] = float(token_data[field])
                                except (ValueError, TypeError):
                                    pass
                        
                        return json.dumps(token_data, indent=2)
                    else:
                        return json.dumps(data, indent=2)
                else:
                    return json.dumps({"error": f"Price lookup failed: {response.status_code}"})
                    
            elif tool_name == "get_trending_tokens":
                chain = arguments.get("chain", "solana")  # Default to solana for better results
                limit = arguments.get("limit", 10)
                
                # Use different endpoints based on chain
                # /trending/all for all chains, /trending/live for specific chain
                if chain.lower() == "all":
                    endpoint = f"{KIKO_API_BASE}/api/tokens/trending/all"
                    params = {"limit": limit}
                else:
                    endpoint = f"{KIKO_API_BASE}/api/tokens/trending/live"
                    params = {"chain": chain, "limit": limit}
                
                response = await http_client.get(endpoint, params=params)
                if response.status_code == 200:
                    data = response.json()
                    # Clean numeric precision to avoid extremely long decimals
                    data = clean_numeric_precision(data, max_decimals=6)
                    tokens_count = len(data.get('tokens', data.get('data', [])))
                    print(f"[Tool Execution] get_trending_tokens success: {tokens_count} tokens")
                    return json.dumps(data, indent=2)
                else:
                    return json.dumps({"error": f"Trending fetch failed: {response.status_code}"})
                    
            elif tool_name == "prepare_swap_transaction":
                # The UI action is handled by the streaming loop emitting a client event
                # Here we just return a confirmation for the model context
                return json.dumps({
                    "status": "success", 
                    "message": "Swap card displayed to user. Ask user to confirm transaction."
                })
            
            elif tool_name == "get_token_info":
                address = arguments.get("address", "")
                chain = arguments.get("chain", "eth")
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/tokens/{chain}/{address}"
                )
                if response.status_code == 200:
                    data = response.json()
                    print(f"[Tool Execution] get_token_info success")
                    return json.dumps(data, indent=2)
                else:
                    return json.dumps({"error": f"Token info fetch failed: {response.status_code}"})
            
            elif tool_name == "get_wallet_info":
                address = arguments.get("address", "")
                chain = arguments.get("chain", "eth")
                include_history = arguments.get("includeHistory", False)
                
                if not address:
                    return json.dumps({"error": "Wallet address is required"})
                
                # Fetch balance (now public, no auth required)
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/wallets/{address}/balance",
                    params={"chain": chain}
                )
                
                if response.status_code != 200:
                    return json.dumps({"error": f"Wallet info fetch failed: {response.status_code}"})
                
                balance_data = response.json()
                result = balance_data
                
                # Optionally fetch transaction history
                if include_history:
                    tx_response = await http_client.get(
                        f"{KIKO_API_BASE}/api/wallets/{address}/transactions",
                        params={"chain": chain, "limit": "10"}
                    )
                    if tx_response.status_code == 200:
                        tx_data = tx_response.json()
                        # Merge transaction history into result
                        if "data" in tx_data:
                            result["recentTransactions"] = tx_data["data"][:10]  # Limit to 10 for token savings
                        print(f"[Tool Execution] get_wallet_info success with {len(result.get('recentTransactions', []))} transactions")
                    else:
                        result["recentTransactions"] = []
                        print(f"[Tool Execution] get_wallet_info success (tx history failed: {tx_response.status_code})")
                else:
                    print(f"[Tool Execution] get_wallet_info success (no history requested)")
                
                return json.dumps(result, indent=2)
            
            elif tool_name == "get_gas_price":
                chain = arguments.get("chain", "eth")
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/market/gas/{chain}"
                )
                if response.status_code == 200:
                    data = response.json()
                    print(f"[Tool Execution] get_gas_price success")
                    return json.dumps(data, indent=2)
                else:
                    return json.dumps({"error": f"Gas price fetch failed: {response.status_code}"})
            
            elif tool_name == "get_historical_price":
                symbol = arguments.get("symbol", "")
                date = arguments.get("date", "")
                if not symbol or not date:
                    return json.dumps({"error": "Symbol and date are required"})
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/market/historical/{symbol}/{date}"
                )
                if response.status_code == 200:
                    data = response.json()
                    print(f"[Tool Execution] get_historical_price success")
                    return json.dumps(data, indent=2)
                    return json.dumps({"error": f"Historical price fetch failed: {response.status_code}"})
            
            elif tool_name == "create_copy_trade_task":
                if not auth_token:
                     return json.dumps({"error": "Authentication required to create copy trade tasks."})

                target_wallet = arguments.get("target_wallet")
                buy_amount = arguments.get("buy_amount_usd", 50)
                chain = arguments.get("chain", "base")
                chain_id = 8453 if chain.lower() == "base" else 1
                
                payload = {
                    "targetWallet": target_wallet,
                    "buyAmountUsd": float(buy_amount),
                    "chainId": chain_id,
                    "takeProfitPct": float(arguments.get("take_profit_pct")) if arguments.get("take_profit_pct") else None,
                    "stopLossPct": float(arguments.get("stop_loss_pct")) if arguments.get("stop_loss_pct") else None,
                    "minTargetValueUsd": float(arguments.get("min_target_value_usd")) if arguments.get("min_target_value_usd") else None
                }

                response = await http_client.post(
                    f"{KIKO_API_BASE}/api/copy-trade/config",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                     data = response.json()
                     return json.dumps({"status": "success", "message": f"Copy trade task created for {target_wallet}", "config": data.get("config")}, indent=2)
                else:
                     return json.dumps({"error": f"Failed to create task: {response.text}"})
            
            elif tool_name == "fetch_farcaster_trending":
                limit = min(arguments.get("limit", 30), 30)  # Cap at 30 to save tokens
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/social/trending",
                    params={"limit": limit}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Extract and simplify data to save tokens
                    if "data" in data:
                        casts = data["data"]
                        # Simplify each cast - keep only essential fields
                        simplified_casts = []
                        for cast in casts[:limit]:
                            simplified_casts.append({
                                "hash": cast.get("hash", "")[:16],  # Shorten hash
                                "author": {
                                    "username": cast.get("author", {}).get("username"),
                                    "displayName": cast.get("author", {}).get("displayName"),
                                    "fid": cast.get("author", {}).get("fid")
                                },
                                "text": cast.get("text", ""),
                                "stats": {
                                    "likes": cast.get("stats", {}).get("likes", 0),
                                    "recasts": cast.get("stats", {}).get("recasts", 0),
                                    "replies": cast.get("stats", {}).get("replies", 0)
                                },
                                "heatScore": round(cast.get("heatScore", 0), 2)
                            })
                        
                        result = {
                            "count": len(simplified_casts),
                            "casts": simplified_casts
                        }
                        print(f"[Tool Execution] fetch_farcaster_trending success: {len(simplified_casts)} casts")
                        return json.dumps(result, indent=2)
                    else:
                        return json.dumps({"error": "No trending casts data available"})
                else:
                    return json.dumps({"error": f"Trending casts fetch failed: {response.status_code}"})
            
            elif tool_name == "get_farcaster_user":
                fid = arguments.get("fid")
                include_casts = arguments.get("include_casts", True)
                
                if not fid:
                    return json.dumps({"error": "FID is required"})
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/social/snapchain/user/{fid}"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Simplify user data
                    if "data" in data:
                        full_data = data["data"]
                        
                        result = {
                            "user": full_data.get("user", {}),
                            "casts": []
                        }
                        
                        # Include casts if requested
                        if include_casts and "casts" in full_data:
                            # Limit to 10 most recent casts to save tokens
                            for cast in full_data["casts"][:10]:
                                result["casts"].append({
                                    "hash": cast.get("hash", "")[:16],
                                    "text": cast.get("text", ""),
                                    "timestamp": cast.get("timestamp"),
                                    "reactions": cast.get("reactions", {})
                                })
                        
                        result["totalCasts"] = full_data.get("totalCasts", len(result["casts"]))
                        
                        print(f"[Tool Execution] get_farcaster_user success: FID {fid}")
                        return json.dumps(result, indent=2)
                    else:
                        return json.dumps({"error": f"User data not found for FID {fid}"})
                else:
                    return json.dumps({"error": f"User fetch failed: {response.status_code}"})




            elif tool_name == "search_farcaster_casts":
                query = arguments.get("query")
                limit = arguments.get("limit", 15)
                
                if not query:
                    return json.dumps({"error": "Search query is required"})
                
                # Cap limit to save tokens
                capped_limit = min(limit, 30)
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/social/search",
                    params={"q": query, "limit": capped_limit}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    casts = data.get("casts", [])
                    
                    # Simplify cast data
                    simplified_casts = []
                    for cast in casts:
                        simplified_casts.append({
                            "hash": cast.get("hash", "")[:16],
                            "author": {
                                "username": cast.get("author", {}).get("username", "unknown"),
                                "displayName": cast.get("author", {}).get("displayName", ""),
                                "fid": cast.get("author", {}).get("fid", cast.get("fid"))
                            },
                            "text": cast.get("text", ""),
                            "stats": cast.get("stats", {"likes": 0, "recasts": 0, "replies": 0})
                        })
                    
                    result = {
                        "success": True,
                        "query": query,
                        "count": len(simplified_casts),
                        "casts": simplified_casts,
                        "note": f"Found {len(simplified_casts)} cast(s) matching \"{query}\"" if simplified_casts else "No casts found matching your search."
                    }
                    
                    print(f"[Tool Execution] search_farcaster_casts success: {len(simplified_casts)} results for '{query}'")
                    return json.dumps(result, indent=2)
                else:
                    return json.dumps({"error": f"Search failed: {response.status_code}"})

            # ============================================
            # POLYMARKET PREDICTION MARKET TOOLS
            # ============================================
            elif tool_name == "get_polymarket_trending":
                limit = arguments.get("limit", 10)
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/polymarket/events/trending",
                    params={"limit": limit}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and "data" in data:
                        events = data["data"].get("events", [])
                        # Format for AI readability
                        result = {
                            "source": "Polymarket",
                            "count": len(events),
                            "events": [
                                {
                                    "id": e.get("id"),
                                    "title": e.get("title"),
                                    "totalVolume": f"${e.get('volume', 0):,.0f}",
                                    "liquidity": f"${e.get('liquidity', 0):,.0f}",
                                    "endDate": e.get("endDate", "")[:10]  # Just date part
                                }
                                for e in events
                            ]
                        }
                        print(f"[Tool Execution] get_polymarket_trending success: {len(events)} events")
                        return json.dumps(result, indent=2)
                    else:
                        return json.dumps({"error": "No data in response"})
                else:
                    return json.dumps({"error": f"Polymarket trending fetch failed: {response.status_code}"})

            elif tool_name == "get_polymarket_event":
                event_id = arguments.get("event_id", "")
                if not event_id:
                    return json.dumps({"error": "event_id is required"})
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/polymarket/events/{event_id}"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and "data" in data:
                        event = data["data"]
                        # Format markets with probabilities clearly
                        markets_formatted = []
                        for m in event.get("markets", []):
                            markets_formatted.append({
                                "question": m.get("question"),
                                "yesProbability": m.get("yesProbability"),
                                "noProbability": m.get("noProbability"),
                                "volume24hr": f"${m.get('volume24hr', 0):,.0f}",
                                "endDate": m.get("endDate", "")[:10]
                            })
                        
                        result = {
                            "source": "Polymarket",
                            "title": event.get("title"),
                            "description": event.get("description", "")[:500],  # Limit description length
                            "totalVolume": f"${event.get('volume', 0):,.0f}",
                            "liquidity": f"${event.get('liquidity', 0):,.0f}",
                            "endDate": event.get("endDate", "")[:10],
                            "markets": markets_formatted
                        }
                        print(f"[Tool Execution] get_polymarket_event success: {event.get('title')}")
                        return json.dumps(result, indent=2)
                    else:
                        return json.dumps({"error": "Event not found"})
                else:
                    return json.dumps({"error": f"Polymarket event fetch failed: {response.status_code}"})

            elif tool_name == "search_polymarket":
                query = arguments.get("query", "")
                limit = arguments.get("limit", 10)
                
                if not query:
                    return json.dumps({"error": "query is required"})
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/polymarket/events/search",
                    params={"q": query, "limit": limit}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success") and "data" in data:
                        events = data["data"].get("events", [])
                        result = {
                            "source": "Polymarket",
                            "query": query,
                            "count": len(events),
                            "events": [
                                {
                                    "id": e.get("id"),
                                    "title": e.get("title"),
                                    "totalVolume": f"${e.get('volume', 0):,.0f}",
                                    "liquidity": f"${e.get('liquidity', 0):,.0f}",
                                    "endDate": e.get("endDate", "")[:10]
                                }
                                for e in events
                            ],
                            "note": f"Use get_polymarket_event with an event ID to see detailed probabilities."
                        }
                        print(f"[Tool Execution] search_polymarket success: {len(events)} results for '{query}'")
                        return json.dumps(result, indent=2)
                    else:
                        return json.dumps({"error": "No results found", "query": query})
                else:
                    return json.dumps({"error": f"Polymarket search failed: {response.status_code}"})

            elif tool_name == "analyze_wallet_pnl":
                address = arguments.get("address", "")
                chain = arguments.get("chain", "eth")
                
                if not address:
                    return json.dumps({"error": "Wallet address is required"})
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/wallets/{address}/pnl",
                    params={"chain": chain}
                )
                if response.status_code == 200:
                    data = response.json()
                    print(f"[Tool Execution] analyze_wallet_pnl success")
                    return json.dumps(data, indent=2)
                else:
                    return json.dumps({"error": f"PnL analysis failed: {response.status_code}"})

            elif tool_name == "get_token_early_buyers":
                address = arguments.get("address", "")
                chain = arguments.get("chain", "eth")
                limit = arguments.get("limit", 10)
                start_time = arguments.get("start_time")
                end_time = arguments.get("end_time")
                
                if not address:
                    return json.dumps({"error": "Token address is required"})
                
                response = await http_client.get(
                    f"{KIKO_API_BASE}/api/tokens/{chain}/{address}/early-buyers",
                    params={
                        "limit": limit,
                        **({"start_time": start_time} if start_time else {}),
                        **({"end_time": end_time} if end_time else {}),
                    }
                )
                if response.status_code == 200:
                    data = response.json()
                    print(f"[Tool Execution] get_token_early_buyers success")
                    return json.dumps(data, indent=2)
                else:
                    return json.dumps({"error": f"Early buyers lookup failed: {response.status_code}"})

            elif tool_name == "analyze_website_deep":
                # Import the website analyzer
                from grok.tools.website_analyzer import analyze_website_deep
                
                url = arguments.get("url", "")
                project_name = arguments.get("project_name")
                
                if not url:
                    return json.dumps({"error": "url is required"})
                
                # Execute the Playwright-based analysis
                result = await analyze_website_deep(url, project_name)
                return json.dumps(result, indent=2)

            else:
                # DELEGATION FALLBACK: If tool is not handled in Python, delegate to Node.js API
                # This enables "dynamic tool injection" where Node.js is the source of truth
                print(f"[Tool Execution] Unknown tool '{tool_name}', delegating to Node.js API...")
                
                payload = {
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "context": tool_context
                }
                
                # Use the internal tool route so delegation stays on the same execution surface.
                response = await http_client.post(
                    f"{KIKO_API_BASE}/internal/tools/execute",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                    data = response.json()
                    result = data.get("result") if isinstance(data, dict) and data.get("success") else None
                    print(f"[Tool Execution] Delegated tool '{tool_name}' success")
                    return json.dumps(result, indent=2) if not isinstance(result, str) else result
                else:
                    error_msg = f"Delegated tool execution failed: {response.status_code}"
                    try:
                        error_json = response.json()
                        if "error" in error_json:
                            error_msg = error_json["error"]
                    except:
                        pass
                    print(f"[Tool Execution] Delegated tool '{tool_name}' failed: {error_msg}")
                    return json.dumps({"error": error_msg})
                
    except Exception as e:
        print(f"[Tool Execution] Error: {e}")
        return json.dumps({"error": f"Tool execution failed: {str(e)}"})

class Message(BaseModel):
    role: str  # 'system', 'user', or 'assistant'
    content: Any = None


def normalize_model_name(model: str) -> str:
    """
    Normalize model name to xai-sdk compatible format.
    Maps frontend model names to actual API model names.
    """
    default_model = os.getenv("GROK_DEFAULT_MODEL", "grok-4-1-fast-reasoning")
    model_map = {
        "grok": default_model,
        "grok-fast": "grok-4-1-fast-non-reasoning",
        "grok-reasoning": "grok-4-1-fast-reasoning",
        "grok-4-reasoning": "grok-4-1-fast-reasoning",
        "grok-4-non-reasoning": "grok-4-1-fast-non-reasoning",
    }
    normalized = model_map.get((model or "").strip(), (model or "").strip())
    print(f"[Model] Original: {model} -> Normalized: {normalized}")
    return normalized


def contains_contract_address(text: str) -> bool:
    if not text:
        return False
    if re.search(r"\b0x[a-fA-F0-9]{40}\b", text):
        return True
    return bool(re.search(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b", text))


def has_trade_intent(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    keywords = [
        "buy", "sell", "swap", "trade", "long", "short", "ape", "snipe", "market buy",
        "买", "买入", "卖", "卖出", "交易", "换", "梭哈", "做多", "做空",
    ]
    return any(keyword in lowered for keyword in keywords)


def has_analysis_intent(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    keywords = [
        "what is", "what's", "analyze", "analysis", "worth", "why pumping",
        "sentiment", "narrative", "community", "catalyst", "news",
        "是什么", "分析", "值不值得", "能买吗", "为什么涨", "为什么跌", "情绪", "叙事", "社区",
    ]
    return any(keyword in lowered for keyword in keywords)


def has_freshness_intent(text: str) -> bool:
    if not text:
        return False
    lowered = text.lower()
    keywords = [
        "today", "latest", "recent", "what happened", "what's happening",
        "breaking", "news", "trending", "hot topics",
        "今天", "最新", "刚刚", "发生了什么", "有什么事", "热点", "趋势", "热搜",
    ]
    return any(keyword in lowered for keyword in keywords)


class ToolConfig(BaseModel):
    """Configuration for search tools"""
    web_search: Optional[dict] = None  # e.g., {"allowed_domains": ["coindesk.com"], "enable_image_understanding": False}
    x_search: Optional[dict] = None    # e.g., {"from_date": "2024-01-01", "allowed_x_handles": ["elonmusk"]}


class UserSettings(BaseModel):
    """User trading preferences"""
    allowance_mode: Optional[str] = "confirm"  # 'instant' or 'confirm' - whether to auto-execute trades


class ChatRequest(BaseModel):
    model: str
    messages: List[Message]
    temperature: Optional[float] = 0.7
    max_tokens: Optional[int] = None
    stream: Optional[bool] = True
    enable_search: Optional[bool] = True  # Enable search tools by default
    previous_response_id: Optional[str] = None
    tool_config: Optional[ToolConfig] = None  # Dynamic tool configuration
    tool_policy: Optional[dict] = None  # Node-authored tool control-plane policy
    tools: Optional[List[dict]] = None  # OpenAI-style tool schemas from Node
    tool_context: Optional[dict] = None  # Tool execution context from Node
    user_settings: Optional[UserSettings] = None  # User trading preferences
    top_p: Optional[float] = None
    frequency_penalty: Optional[float] = None
    usage: Optional[dict] = None


def _is_truthy(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


class ChatResponse(BaseModel):
    content: str
    citations: Optional[List[str]] = None
    usage: Optional[dict] = None


def message_text_content(message: Message) -> str:
    return extract_text_content(getattr(message, "content", None)).strip()


def append_user_content_to_chat(chat, content: Any) -> bool:
    text = extract_text_content(content).strip()
    image_urls = extract_image_urls(content)
    if not text and not image_urls:
        return False

    args: list[Any] = []
    if text:
        args.append(text)
    for image_url in image_urls:
        args.append(chat_image(image_url=image_url, detail="high"))
    chat.append(user(*args))
    return True


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "grok-api"}


async def fetch_rag_context(query: str) -> str:
    """
    Fetch context from the local rag-service using internal retrieval logic.
    """
    if not rag_enabled():
        return ""
    informational_regex = r"(how|what|why|explain|tell me|介绍|是什么|怎么|如何|原理)"
    
    import re
    if not re.search(informational_regex, query, re.IGNORECASE):
        return ""
        
    print(f"[RAG] 🔍 Informational query detected: '{query[:50]}...'")
    try:
        local_kb = get_kb()
        if not local_kb:
            return ""

        # Direct internal call to KnowledgeBase
        results = local_kb.query_with_score(query, k=4)
        
        if results:
            # Format results into a single context string
            context_parts = []
            for doc, score in results:
                # Normalize score (Chroma returns distance, smaller is better)
                context_parts.append(doc.page_content)
                
            context = "\n\n".join(context_parts)
            if context:
                print(f"[RAG] ✅ Found {len(context)} chars of context")
                return context
            else:
                print("[RAG] ℹ️ No relevant knowledge found")
        else:
            print("[RAG] ℹ️ No results from vector store")
            
    except Exception as e:
        print(f"[RAG] ⚠️ Error retrieving from KnowledgeBase: {e}")
    
    return ""


@app.post("/v1/chat/completions", dependencies=[Depends(require_auth)])
async def chat_completions(
    request: ChatRequest, 
    _auth=Depends(require_auth),
    authorization: str = Header(default=None)
):
    """
    Chat completions endpoint compatible with OpenAI format
    Supports streaming and tool use (web_search, x_search)
    
    The authorization header is captured and forwarded to authenticated
    tool calls (like get_wallet_info) to allow server-to-server auth.
    """
    try:
        # Extract auth token from header for forwarding to authenticated tool calls
        user_auth_token = None
        if authorization and authorization.lower().startswith("bearer "):
            user_auth_token = authorization.split(" ", 1)[1].strip()
        
        # Initialize client inside the handler to ensure it attaches to the current event loop
        client = AsyncClient(api_key=xai_api_key, timeout=600)

        # Normalize model name to xai-sdk compatible format
        normalized_model = normalize_model_name(request.model)
        
        # Optional RAG integration: disabled unless ENABLE_RAG_SERVICE is turned on.
        # Extract raw user query from the USER_QUERY block when available to avoid context pollution.
        last_user_msg = next((message_text_content(m) for m in reversed(request.messages) if m.role == "user"), "")
        raw_user_query = last_user_msg
        match = re.search(r"USER_QUERY_START\\n([\\s\\S]*?)\\nUSER_QUERY_END", last_user_msg)
        if match:
            raw_user_query = match.group(1).strip()
        if raw_user_query:
            rag_context = await fetch_rag_context(raw_user_query)
            if rag_context:
                # Inject into the last user message content (consistent with Node.js approach)
                for m in reversed(request.messages):
                    if m.role == "user":
                        m.content = append_text_content(
                            m.content,
                            f"\n\n[RELEVANT DOCUMENTATION CONTEXT]:\n{rag_context}\n\n(Use the above context to answer if relevant/needed)",
                        )
                        break
        
        # Add tools if enabled
        # By default, expose native xAI SDK tools in addition to Node-provided client tools.
        tools = []  # Initialize tools to empty list first
        available_tools = set()  # Custom tool names for manual execution

        # Apply tool configurations if provided
        web_search_config = request.tool_config.web_search if request.tool_config else {}
        x_search_config = request.tool_config.x_search if request.tool_config else {}

        # Convert date strings to datetime objects for x_search
        if x_search_config:
            if 'from_date' in x_search_config and isinstance(x_search_config['from_date'], str):
                x_search_config['from_date'] = datetime.fromisoformat(x_search_config['from_date'])
            if 'to_date' in x_search_config and isinstance(x_search_config['to_date'], str):
                x_search_config['to_date'] = datetime.fromisoformat(x_search_config['to_date'])

        native_tool_names = set()

        def get_attached_tool_name(attached_tool) -> str:
            try:
                oneof = attached_tool.WhichOneof("tool")
                if oneof:
                    return str(oneof)
            except Exception:
                pass
            try:
                if hasattr(attached_tool, "function") and hasattr(attached_tool.function, "name"):
                    n = str(attached_tool.function.name or "").strip()
                    if n:
                        return n
            except Exception:
                pass
            return ""

        def add_native_tool(native_tool_obj):
            try:
                n = get_attached_tool_name(native_tool_obj)
                if n:
                    if n in native_tool_names:
                        return
                    native_tool_names.add(n)
                tools.append(native_tool_obj)
            except Exception as e:
                print(f"[Tools] Failed to attach native tool: {e}")

        requested_control_plane = (
            str((request.tool_policy or {}).get("control_plane") or "").strip().lower()
            if isinstance(request.tool_policy, dict)
            else ""
        )
        requested_action_class = (
            str((request.tool_policy or {}).get("action_class") or "READ_ONLY").strip().upper()
            if isinstance(request.tool_policy, dict)
            else "READ_ONLY"
        )
        requested_mutation_allowed = bool((request.tool_policy or {}).get("mutation_allowed")) if isinstance(request.tool_policy, dict) else False
        requested_enforcement_level = (
            str((request.tool_policy or {}).get("enforcement_level") or "hard").strip().lower()
            if isinstance(request.tool_policy, dict)
            else "hard"
        )
        python_tool_execution_enabled = requested_control_plane != "node"

        default_allow_extra_sdk_tools = _is_truthy(os.getenv("GROK_EXPOSE_ALL_XAI_SDK_TOOLS"), default=True)
        tool_policy = resolve_requested_tool_policy(
            request.tool_policy,
            enable_search_default=bool(request.enable_search),
            allow_extra_sdk_tools_default=default_allow_extra_sdk_tools,
            is_non_reasoning_model="non-reasoning" in normalized_model.lower(),
        )
        native_tool_policy = tool_policy["native_tools"]
        execution_policy = tool_policy["execution"]
        if requested_enforcement_level == "hard" and requested_action_class in {"TRADE_MUTATION", "ORDER_MUTATION"}:
            if requested_control_plane and requested_control_plane != "node":
                raise HTTPException(
                    status_code=400,
                    detail="Invalid tool policy: mutation action class requires control_plane=node",
                )
            python_tool_execution_enabled = False
        if requested_control_plane == "node" and native_tool_policy.get("allow_extra_sdk_tools"):
            raise HTTPException(
                status_code=400,
                detail="Invalid tool policy: control_plane=node requires native_tools.allow_extra_sdk_tools=false",
            )
        if requested_enforcement_level == "hard" and requested_action_class in {"TRADE_MUTATION", "ORDER_MUTATION"} and native_tool_policy.get("allow_extra_sdk_tools"):
            raise HTTPException(
                status_code=400,
                detail="Invalid tool policy: mutation action class requires native_tools.allow_extra_sdk_tools=false",
            )
        print(
            "[Tool Policy] "
            f"action_class={requested_action_class} "
            f"mutation_allowed={requested_mutation_allowed} "
            f"enforcement={requested_enforcement_level} "
            f"enable_search={native_tool_policy['enable_search']} "
            f"enabled_tools={native_tool_policy['enabled_tools']} "
            f"required={native_tool_policy['required']} "
            f"preferred={native_tool_policy['preferred_required_tool']} "
            f"reason={native_tool_policy['reason'] or 'n/a'} "
            f"per_tool_timeout_ms={execution_policy['per_tool_timeout_ms']} "
            f"total_tool_budget_ms={execution_policy['total_tool_budget_ms']}"
        )

        if "web_search" in native_tool_policy["enabled_tools"]:
            add_native_tool(web_search(**web_search_config) if web_search_config else web_search())
        if "x_search" in native_tool_policy["enabled_tools"]:
            add_native_tool(x_search(**x_search_config) if x_search_config else x_search())

        if native_tool_policy["allow_extra_sdk_tools"] and native_tool_policy["enable_search"]:
            # 1) code_execution: always available when enabled.
            try:
                add_native_tool(code_execution())
            except Exception as e:
                print(f"[Tools] code_execution unavailable: {e}")

            # 2) collections_search: enabled only when collection ids are configured.
            collection_ids_raw = os.getenv("XAI_COLLECTION_IDS", "")
            collection_ids = [x.strip() for x in collection_ids_raw.split(",") if x.strip()]
            if collection_ids:
                try:
                    add_native_tool(collections_search(collection_ids=collection_ids))
                except Exception as e:
                    print(f"[Tools] collections_search unavailable: {e}")

            # 3) mcp: enabled when an MCP server URL is configured.
            mcp_server_url = (os.getenv("XAI_MCP_SERVER_URL") or "").strip()
            if mcp_server_url:
                try:
                    add_native_tool(mcp(
                        server_url=mcp_server_url,
                        server_label=(os.getenv("XAI_MCP_SERVER_LABEL") or None),
                        server_description=(os.getenv("XAI_MCP_SERVER_DESCRIPTION") or None),
                        authorization=(os.getenv("XAI_MCP_AUTHORIZATION") or None),
                    ))
                except Exception as e:
                    print(f"[Tools] mcp unavailable: {e}")

        if request.tools:
            for raw_tool in request.tools:
                tool_def = raw_tool.get("function") if isinstance(raw_tool, dict) and "function" in raw_tool else raw_tool
                if not isinstance(tool_def, dict):
                    continue
                tool_name = tool_def.get("name")
                if not tool_name:
                    continue
                # Native SDK tools are already attached above; avoid duplicates.
                if tool_name in {"web_search", "x_search", "code_execution", "collections_search", "mcp"}:
                    continue
                tools.append(tool(
                    name=tool_name,
                    description=tool_def.get("description", ""),
                    parameters=tool_def.get("parameters", {"type": "object", "properties": {}})
                ))
                if python_tool_execution_enabled:
                    available_tools.add(tool_name)
            if python_tool_execution_enabled:
                log_tools(f"[Tools] Dynamic tool set from Node + SDK natives: {len(tools)} tool(s) ({len(available_tools)} custom)")
            else:
                log_tools(f"[Tools] Dynamic tool set from Node + SDK natives: {len(tools)} tool(s); Python custom execution disabled (control_plane=node)")
        elif native_tool_policy["enable_search"]:
            if ALLOW_PYTHON_CUSTOM_TOOLS_FALLBACK and python_tool_execution_enabled:
                tools = tools + CUSTOM_TOOLS
                log_tools(f"[Tools] SDK native tools + {len(CUSTOM_TOOLS)} Python fallback custom tools enabled")
                available_tools = {t.function.name for t in CUSTOM_TOOLS if hasattr(t, "function")}
            else:
                log_tools("[Tools] SDK native tools only; waiting for Node-provided custom tool schemas")
        else:
            log_tools(f"[Tools] Search tools disabled by request")

        tool_names = set()
        for t in tools:
            name = get_attached_tool_name(t)
            if name:
                tool_names.add(name)

        has_search_tools = "web_search" in tool_names or "x_search" in tool_names
        force_search = bool(native_tool_policy["required"]) if request.tool_policy else (
            has_search_tools
            and contains_contract_address(last_user_msg)
            and (has_analysis_intent(last_user_msg) or not has_trade_intent(last_user_msg))
        )
        if not force_search and has_search_tools and not request.tool_policy:
            if has_freshness_intent(last_user_msg) and not has_trade_intent(last_user_msg):
                force_search = True

        tool_choice = None
        if force_search:
            preferred_required_tool = native_tool_policy["preferred_required_tool"] if request.tool_policy else None
            if preferred_required_tool == "x_search" and "x_search" in tool_names:
                tool_choice = aio_chat.chat_pb2.ToolChoice(
                    mode=aio_chat.chat_pb2.ToolMode.TOOL_MODE_REQUIRED,
                    function_name="x_search",
                )
            elif preferred_required_tool == "web_search" and "web_search" in tool_names:
                tool_choice = aio_chat.chat_pb2.ToolChoice(
                    mode=aio_chat.chat_pb2.ToolMode.TOOL_MODE_REQUIRED,
                    function_name="web_search",
                )
            elif "x_search" in tool_names:
                tool_choice = aio_chat.chat_pb2.ToolChoice(
                    mode=aio_chat.chat_pb2.ToolMode.TOOL_MODE_REQUIRED,
                    function_name="x_search",
                )
            else:
                tool_choice = "required"
        include_options = None
        if has_search_tools:
            # Request inline citations so we can surface sources during/after streaming.
            # NOTE: xai-sdk IncludeOption list does not include a "citations" flag; citations may still appear on the response object.
            include_options = list(native_tool_policy["include_options"]) if request.tool_policy else ["inline_citations"]
            if force_search and not request.tool_policy:
                include_options.extend(["web_search_call_output", "x_search_call_output"])
                def tool_priority(t):
                    name = get_attached_tool_name(t)
                    if name:
                        return 0 if name in ("web_search", "x_search") else 1
                    return 1
                tools = sorted(tools, key=tool_priority)

        has_image_input = messages_have_image_content(request.messages)
        store_messages = not has_image_input
        previous_response_id = request.previous_response_id if not has_image_input else None

        # Create chat instance with tools
        log_tools(f"[Chat] Creating chat with model: {normalized_model} (original: {request.model})")
        if tools:
            tool_names = []
            for t in tools:
                n = get_attached_tool_name(t)
                tool_names.append(n or str(t))
            log_tools(f"[Chat] Creating chat with {len(tools)} tool(s): {', '.join(tool_names)}")
            if force_search:
                log_tools("[Chat] Force search enabled: tool_choice=required for CA analysis")
            chat = client.chat.create(
                model=normalized_model,
                tools=tools,
                tool_choice=tool_choice,
                include=include_options,
                store_messages=store_messages,
                previous_response_id=previous_response_id,
            )
            log_tools(f"[Chat] Chat created")
        else:
            chat = client.chat.create(
                model=normalized_model,
                include=include_options,
                store_messages=store_messages,
                previous_response_id=previous_response_id,
            )
            log_tools(f"[Chat] Chat created without tools")
        
        # Add messages to chat
        # CRITICAL FIX: According to xai-sdk documentation, tool results are managed by the chat object
        # We should NOT re-add tool results from previous conversations in the messages array
        # Only add: system, user, and assistant messages (not tool results)
        # This prevents Grok from re-processing old tool calls and repeating previous content
        
        # Filter out tool role messages - they're handled by chat.append(tool_result) in previous turns
        filtered_messages = [msg for msg in request.messages if msg.role != "tool"]

        # Limit message history to prevent context overflow.
        # IMPORTANT: Always preserve the latest system message (Node.js provides the v2 prompt + skills injection).
        max_messages = 15
        last_system = None
        for m in reversed(filtered_messages):
            if m.role == "system":
                last_system = m
                break

        non_system = [m for m in filtered_messages if m.role != "system"]
        tail = non_system[-(max_messages - 1):] if len(non_system) > (max_messages - 1) else non_system
        messages_to_add = ([last_system] if last_system else []) + tail
        
        if len(request.messages) > len(messages_to_add):
            removed_count = len(request.messages) - len(messages_to_add)
            log_tools(f"[Messages] Filtered message history: {len(request.messages)} -> {len(messages_to_add)} messages (removed {removed_count} tool/old messages)")
        
        log_tools(f"[Messages] Adding {len(messages_to_add)} message(s) to chat")
        added_user_messages = 0
        for i, msg in enumerate(messages_to_add):
            if msg.role == "system":
                sys_content = message_text_content(msg)
                if not sys_content:
                    continue
                # CRITICAL: Use the system prompt from Node.js (kiko-api)
                # It already contains: IDENTITY + SAFETY + TOOLS + MODEL_BEHAVIOR + INTENT + USER_CONTEXT
                # DO NOT override it with GROK_SYSTEM_PROMPT
                chat.append(system(sys_content))
                log_tools(f"[Messages] [{i+1}] System prompt from Node.js (length={len(sys_content)} chars)")
            elif msg.role == "user":
                if not append_user_content_to_chat(chat, msg.content):
                    continue
                user_content = message_text_content(msg)
                added_user_messages += 1
                log_tools(f"[Messages] [{i+1}] User: {user_content[:50]}...")
            elif msg.role == "assistant":
                log_tools(f"[Messages] [{i+1}] Assistant: (skipped)")

        # Guardrail: xAI rejects requests when no message content is provided.
        if added_user_messages == 0:
            raise HTTPException(status_code=400, detail="No valid non-empty user message provided.")
        
        log_tools(f"[Chat] Starting {'streaming' if request.stream else 'non-streaming'} response generation")
        
        log_tools(f"[Tools] Custom tool allowlist size: {len(available_tools)}")
        
        # Stream response
        if request.stream:
            async def generate():
                nonlocal chat
                collected_citations = []
                emitted_citation_urls = set()
                collected_tool_calls = []  # Track tool calls to know if fallback message needed
                tool_result_history = []
                chunk_count = 0
                text_chunks_sent = 0
                instant_swap_action_emitted = False
                non_text_signal_emitted = False
                tool_call_signal_emitted = False
                request_hash = hash(str(request.messages))
                stream_chunk_id = build_stream_chunk_id(request_hash=request_hash)
                log_tools(f"[Generate] Starting generator")
                
                def is_client_side_tool(tool_call_obj, tool_name_str: str) -> bool:
                    if not python_tool_execution_enabled:
                        return False
                    try:
                        return get_tool_call_type(tool_call_obj) == "client_side_tool"
                    except Exception:
                        return tool_name_str in available_tools

                def extract_tool_name(tool_call_obj) -> str:
                    try:
                        if hasattr(tool_call_obj, "function") and hasattr(tool_call_obj.function, "name"):
                            return str(tool_call_obj.function.name or "").strip()
                    except Exception:
                        pass
                    return ""

                def parse_tool_args_safe(raw_args) -> tuple[dict, bool]:
                    """
                    Returns (args, is_complete_json).
                    For streaming chunks, tool arguments can be partial JSON fragments.
                    """
                    if raw_args is None:
                        return {}, True
                    if isinstance(raw_args, dict):
                        return raw_args, True
                    if isinstance(raw_args, str):
                        s = raw_args.strip()
                        if not s:
                            return {}, True
                        # Streamed tool args may be incomplete; wait for finalized args.
                        if not (s.endswith("}") or s.endswith("]")):
                            return {}, False
                        try:
                            parsed = json.loads(s)
                            if isinstance(parsed, dict):
                                return parsed, True
                            return {"value": parsed}, True
                        except Exception:
                            return {}, False
                    try:
                        coerced = str(raw_args).strip()
                        if not coerced:
                            return {}, True
                        if not (coerced.endswith("}") or coerced.endswith("]")):
                            return {}, False
                        parsed = json.loads(coerced)
                        if isinstance(parsed, dict):
                            return parsed, True
                        return {"value": parsed}, True
                    except Exception:
                        return {}, False

                async def collect_finalization_chunks() -> tuple[object, list[dict]]:
                    if not tool_result_history:
                        return None, []

                    summary_parts = []
                    for idx, payload in enumerate(tool_result_history[-4:], start=1):
                        text = str(payload or "").strip()
                        if not text:
                            continue
                        if len(text) > 2500:
                            text = text[:2500]
                        summary_parts.append(f"[Tool Result {idx}]\n{text}")

                    if not summary_parts:
                        return None, []

                    finalizer_chat = client.chat.create(
                        model=normalized_model,
                        include=["inline_citations"],
                        store_messages=False,
                    )

                    for msg in messages_to_add:
                        if msg.role == "system":
                            content = message_text_content(msg) if hasattr(msg, "content") else ""
                            if not content:
                                continue
                            finalizer_chat.append(system(content))
                        elif msg.role == "user":
                            append_user_content_to_chat(finalizer_chat, msg.content)

                    finalizer_chat.append(system(
                        "FINALIZATION MODE: You have already completed all tool usage. "
                        "Do not call any tools or searches again. "
                        "Use only the provided tool outputs and prior conversation to produce a direct final answer. "
                        "Do not invent chain names, timestamps, buyer identities, launch timing, or risk facts that are not explicitly supported by the tool outputs. "
                        "If a tool failed, returned no data, or the chain/source is uncertain, say that plainly instead of guessing."
                    ))
                    finalizer_chat.append(user(
                        "Tool execution has finished. Produce the final answer now in plain text.\n\n"
                        + "\n\n".join(summary_parts)
                    ))

                    finalizer_response = None
                    finalizer_chunks: list[dict] = []
                    slice_chars = max(1, int(os.getenv("GROK_STREAM_SLICE_CHARS", "48")))

                    async for response, chunk in finalizer_chat.stream():
                        if response:
                            finalizer_response = response
                        content = getattr(chunk, "content", None)
                        if not content:
                            continue
                        content_str = str(content).strip()
                        if not content_str:
                            continue
                        for i in range(0, len(content_str), slice_chars):
                            piece = content_str[i:i + slice_chars]
                            if not piece:
                                continue
                            finalizer_chunks.append({
                                "id": stream_chunk_id,
                                "object": "chat.completion.chunk",
                                "created": int(__import__('time').time()),
                                "model": request.model,
                                "choices": [{
                                    "index": 0,
                                    "delta": {
                                        "content": piece
                                    },
                                    "finish_reason": None
                                }]
                            })

                    return finalizer_response, finalizer_chunks

                def normalize_tool_payload_for_history(tool_payload) -> str:
                    if tool_payload is None:
                        safe_payload = "tool_result_empty"
                    else:
                        safe_payload = str(tool_payload).strip()
                        if not safe_payload:
                            safe_payload = "tool_result_empty"
                    if len(safe_payload) > 12000:
                        safe_payload = safe_payload[:12000]
                    return safe_payload
                
                try:
                    # According to xai-sdk official docs, citations are available in the final response
                    # after the stream loop completes. We'll collect them after the loop.
                    final_response = None
                    
                    try:
                        # Performance monitoring
                        import time
                        stream_start_time = time.time()
                        last_chunk_time = stream_start_time
                        tool_budget_started_at = time.perf_counter()
                        tool_budget_ms = execution_policy["total_tool_budget_ms"]
                        if tool_budget_ms is None:
                            tool_budget_ms = max(0, int(os.getenv("GROK_TOOL_TOTAL_BUDGET_MS", "45000")))
                        configured_tool_timeout_ms = execution_policy["per_tool_timeout_ms"]
                        if configured_tool_timeout_ms is None:
                            configured_tool_timeout_ms = max(0, int(os.getenv("GROK_TOOL_EXEC_TIMEOUT_MS", "20000")))

                        def tool_budget_elapsed_ms() -> int:
                            return int((time.perf_counter() - tool_budget_started_at) * 1000)

                        def tool_budget_remaining_ms() -> Optional[int]:
                            if tool_budget_ms <= 0:
                                return None
                            return max(0, tool_budget_ms - tool_budget_elapsed_ms())
                        
                        # MULTI-TURN TOOL HANDLING: Loop to handle tool calls and follow-up responses
                        # When Grok calls a tool, we execute it, add result to chat, and stream again
                        max_tool_turns = 6  # Increased from 3 to 6 for complex tool chains
                        has_tool_calls_this_turn = False
                        tool_calls_detected_in_chunk = False  # Track tool calls from chunk
                        tool_calls_detected_in_response = False  # Track tool calls from response (fallback)
                        content_sent_this_turn = False  # Track if any content was sent this turn
                        tool_call_repeat_counts = {}
                        force_stop_after_turn = None
                        
                        for tool_turn in range(max_tool_turns):
                            has_tool_calls_this_turn = False
                            tool_calls_detected_in_chunk = False
                            tool_calls_detected_in_response = False
                            content_sent_this_turn = False
                            custom_tool_executed = False
                            pending_tool_results = []
                            planned_custom_tools = []
                            budget_forced_finalization = False
                            processed_tool_call_ids = set()  # Track processed tool calls to prevent duplicates
                            
                            async for response, chunk in chat.stream():
                                chunk_count += 1
                                current_time = time.time()
                                
                                if chunk:
                                    # log_tools(f"[Stream] Chunk #{chunk_count}: {getattr(chunk, 'content', '')[:20]}...")
                                    pass
                                
                                if response:
                                    final_response = response  # Keep reference to the final response for citations
                                    if hasattr(response, 'citations') and response.citations:
                                        log_tools(f"[Stream] Response has {len(response.citations)} citations")
                                else:
                                     pass # No warning for None response
                                
                                # Eagerly capture citations from any part of the stream
                                # This fixes issue where citations might be transient or lost in final response
                                if response and hasattr(response, 'citations') and response.citations:
                                    new_citations = []
                                    for cite in response.citations:
                                        # Normalize to dict
                                        cite_dict = {'url': ''}
                                        if hasattr(cite, 'url'):
                                            cite_dict['url'] = str(cite.url)
                                            # Try to find avatar/icon
                                            for attr in ['avatar_url', 'avatarUrl', 'avatar', 'icon_url', 'iconUrl']:
                                                if hasattr(cite, attr):
                                                    val = getattr(cite, attr)
                                                    if val: cite_dict['avatar_url'] = str(val); break
                                        elif isinstance(cite, str):
                                            cite_dict['url'] = cite
                                        elif isinstance(cite, dict):
                                            cite_dict['url'] = str(cite.get('url', ''))
                                            if 'avatar_url' in cite: cite_dict['avatar_url'] = str(cite['avatar_url'])
                                        else:
                                            cite_dict['url'] = str(cite)
                                            
                                        # Add if valid URL and not duplicate
                                        if cite_dict['url']:
                                            if cite_dict['url'] not in emitted_citation_urls:
                                                log_citations(f"[Citations] Found intermediate citation: {cite_dict['url'][:50]}...")
                                                collected_citations.append(cite_dict)
                                                emitted_citation_urls.add(cite_dict['url'])
                                                new_citations.append(cite_dict)

                                    # Stream citations immediately so frontend can render without waiting for final chunk
                                    if new_citations:
                                        non_text_signal_emitted = True
                                        cite_chunk = {
                                            "id": stream_chunk_id,
                                            "object": "chat.completion.chunk",
                                            "created": int(__import__('time').time()),
                                            "model": request.model,
                                            "choices": [{
                                                "index": 0,
                                                "delta": {},
                                                "message": {
                                                    "citations": new_citations
                                                },
                                                "finish_reason": None
                                            }]
                                        }
                                        try:
                                            yield f"data: {json.dumps(cite_chunk)}\n\n"
                                        except (BrokenPipeError, ConnectionResetError, OSError):
                                            return
                                            
                                # Also check inline_citations if available
                                if response and hasattr(response, 'inline_citations') and response.inline_citations:
                                    log_citations(f"[Citations] Found inline_citations: {len(response.inline_citations)}")
                                    collected_citations = merge_citations_unique(
                                        collected_citations,
                                        list(response.inline_citations),
                                    )
                                    
                                # Log critical state variables for debugging blank messages
                                
                                # Log every chunk with timestamp to prove streaming
                                time_since_last = current_time - last_chunk_time
                                last_chunk_time = current_time
                                
                                
                                # Get chunk content
                                raw_content = getattr(chunk, 'content', None)
                                finish_reason = getattr(chunk, 'finish_reason', None)
                                
                                # IMPROVED TOOL CALL DETECTION: Check both chunk and response
                                # Primary detection: chunk.tool_calls (streaming chunks)
                                # Fallback detection: response.tool_calls (accumulated response)
                                
                                # Check chunk.tool_calls first (primary method)
                                chunk_has_tool_calls = hasattr(chunk, 'tool_calls') and chunk.tool_calls
                                
                                # Check response.tool_calls as fallback (some tools may only appear here)
                                response_has_tool_calls = hasattr(response, 'tool_calls') and response.tool_calls
                                
                                # DEDUPLICATION: Only process tool calls from chunk to avoid duplicates
                                # response.tool_calls is accumulated and may contain duplicates from previous chunks
                                # We only use response.tool_calls if chunk doesn't have tool_calls
                                if chunk_has_tool_calls:
                                    tool_calls_list = chunk.tool_calls
                                    tool_calls_detected_in_chunk = True
                                    log_tools(f"[Tool Call] Detected in chunk: {len(chunk.tool_calls)} tool(s)")
                                elif response_has_tool_calls:
                                    # Only use response.tool_calls if chunk doesn't have them (fallback)
                                    tool_calls_list = response.tool_calls
                                    tool_calls_detected_in_response = True
                                    log_tools(f"[Tool Call] Detected in response (fallback): {len(response.tool_calls)} tool(s)")
                                else:
                                    tool_calls_list = []
                                
                                # Process each tool call only once per turn
                                for tool_call in tool_calls_list:
                                        # Access tool_call attributes according to official SDK structure
                                        if hasattr(tool_call, 'function'):
                                            tool_name = extract_tool_name(tool_call)
                                            if not tool_name:
                                                log_tools("[Tool Call] Skipping call with empty tool name")
                                                continue
                                            tool_args = tool_call.function.arguments if hasattr(tool_call.function, 'arguments') else ''
                                            
                                            # DEDUPLICATION: Create unique tool call ID based on tool name + args hash
                                            # This ensures same tool call with same args is only processed once
                                            tool_args_str = str(tool_args) if tool_args else ''
                                            tool_call_signature = f"{tool_name}:{hash(tool_args_str)}"
                                            
                                            # Skip if we've already processed this tool call in this turn
                                            if tool_call_signature in processed_tool_call_ids:
                                                log_tools(f"[Tool Call] Skipping duplicate: {tool_name} (already processed)")
                                                continue
                                            
                                            processed_tool_call_ids.add(tool_call_signature)
                                            log_tools(f"[Tool Call] {tool_name}: {str(tool_args)[:100]}...")
                                            
                                            # Loop guard: if same tool+args repeats too often, stop further tool calls.
                                            tool_call_repeat_counts[tool_call_signature] = tool_call_repeat_counts.get(tool_call_signature, 0) + 1
                                            if tool_call_repeat_counts[tool_call_signature] >= 2:
                                                print(f"[Tool Guard] Repeat limit reached for {tool_name}, stopping further tool calls.")
                                                pending_tool_results.append("No further tool calls (repeat limit reached). Please respond without additional tools.")
                                                has_tool_calls_this_turn = True
                                                custom_tool_executed = True
                                                # Stop immediately on repeated tool loops in this turn.
                                                force_stop_after_turn = tool_turn
                                                continue

                                            # Only mark as tool turn if it's a client-side tool we execute.
                                            is_client_tool = is_client_side_tool(tool_call, tool_name)
                                            if is_client_tool and tool_name in available_tools:
                                                has_tool_calls_this_turn = True
                                                custom_tool_executed = True
                                                log_tools(f"[Tool Call] Custom tool detected - buffered content will be discarded")
                                            else:
                                                log_tools(f"[Tool Call] Built-in tool detected ({tool_name}) - continuing stream")
                                            
                                            # UNIFIED TOOL CALL EVENT FORMAT: OpenAI-compatible format
                                            # Send tool call event to frontend for status display
                                            # According to OpenAI format, tool_calls should be in delta
                                            # Use microsecond timestamp + signature hash for unique ID
                                            import time as time_module
                                            tool_call_id = f"call_{int(time_module.time() * 1000000)}_{hash(tool_call_signature)}"
                                            tool_call_event = {
                                                "id": stream_chunk_id,
                                                "object": "chat.completion.chunk",
                                                "created": int(__import__('time').time()),
                                                "model": request.model,
                                                "choices": [{
                                                    "index": 0,
                                                    "delta": {
                                                        "tool_calls": [{
                                                            "index": 0,
                                                            "id": tool_call_id,
                                                            "type": "function",
                                                            "function": {
                                                                "name": tool_name,
                                                                "arguments": str(tool_args)[:200] if tool_args else ""
                                                            }
                                                        }]
                                                    },
                                                    "finish_reason": None
                                                }]
                                            }
                                            # Also send a simplified tool_call field for frontend compatibility
                                            tool_call_simple_event = {
                                                "id": stream_chunk_id,
                                                "object": "chat.completion.chunk",
                                                "created": int(__import__('time').time()),
                                                "model": request.model,
                                                "choices": [{
                                                    "index": 0,
                                                    "delta": {},
                                                    "finish_reason": None
                                                }],
                                                "tool_call": tool_name,  # Simplified format for frontend
                                                "tool_call_id": tool_call_id  # Include ID for tracking
                                            }
                                            try:
                                                log_tools(f"[Tool Call Event] Sending tool call event for {tool_name} (ID: {tool_call_id})")
                                                non_text_signal_emitted = True
                                                tool_call_signal_emitted = True
                                                # Send both formats for maximum compatibility
                                                yield f"data: {json.dumps(tool_call_event)}\n\n"
                                                yield f"data: {json.dumps(tool_call_simple_event)}\n\n"
                                                
                                                if is_client_tool and tool_name in available_tools:
                                                    # Parse arguments safely; skip partial streaming payloads.
                                                    args, args_ready = parse_tool_args_safe(tool_args)
                                                    if not args_ready:
                                                        log_tools(f"[Tool Call] Deferred {tool_name}: incomplete streamed arguments")
                                                        continue
                                                    planned_custom_tools.append(PlannedToolCall(name=tool_name, args=args))
                                                    collected_tool_calls.append(tool_name)
                                                    has_tool_calls_this_turn = True
                                                    custom_tool_executed = True
                                                    print(f"[Custom Tool] Planned {tool_name} for parallel execution")
                                                else:
                                                    log_tools(f"[Tool Call] {tool_name} is a built-in tool, handled by xai-sdk")
                                                    
                                            except (BrokenPipeError, ConnectionResetError, OSError):
                                                return
                                
                                # NOTE: reasoning_content streaming removed - thinking feature abandoned
                                
                                # Stream content immediately - frontend will clear if tool_call is detected
                                # BUT: Only stream content if we haven't detected tool calls yet
                                # If tool calls are detected, we'll discard this content and wait for next turn
                                if chunk.content:
                                    content_str = str(chunk.content) if chunk.content else ""
                                    if content_str:
                                        # Only send content if no tool calls detected (to avoid showing partial response before tool execution)
                                        if not has_tool_calls_this_turn:
                                            content_sent_this_turn = True
                                            # Some providers may emit larger text deltas; split them into
                                            # smaller SSE chunks for smoother UI rendering (especially mobile).
                                            slice_chars = max(1, int(os.getenv("GROK_STREAM_SLICE_CHARS", "48")))
                                            for i in range(0, len(content_str), slice_chars):
                                                piece = content_str[i:i + slice_chars]
                                                if not piece:
                                                    continue
                                                chunk_data = {
                                                    "id": stream_chunk_id,
                                                    "object": "chat.completion.chunk",
                                                    "created": int(__import__('time').time()),
                                                    "model": request.model,
                                                    "choices": [{
                                                        "index": 0,
                                                        "delta": {
                                                            "content": piece
                                                        },
                                                        "finish_reason": None
                                                    }]
                                                }
                                                try:
                                                    yield f"data: {json.dumps(chunk_data)}\n\n"
                                                    text_chunks_sent += 1
                                                except (BrokenPipeError, ConnectionResetError, OSError):
                                                    return
                                        # else:

                            # END OF STREAM LOOP - Check if we need another turn
                            if planned_custom_tools:
                                planned_tool_names = [planned_tool.name for planned_tool in planned_custom_tools]
                                remaining_budget_ms = tool_budget_remaining_ms()
                                if remaining_budget_ms == 0:
                                    print(f"[Tool Budget] Exhausted before executing planned tools at {tool_budget_elapsed_ms()}ms")
                                    budget_chunk = build_tool_status_chunk(
                                        request_hash=request_hash,
                                        chunk_id=stream_chunk_id,
                                        model=request.model,
                                        status=f"Tool budget exhausted before running {len(planned_custom_tools)} planned tool(s)",
                                        phase="budget_exhausted",
                                        count=len(planned_custom_tools),
                                        tools=planned_tool_names,
                                        reason="pre_execution",
                                    )
                                    non_text_signal_emitted = True
                                    yield f"data: {json.dumps(budget_chunk)}\n\n"
                                    pending_tool_results.append(
                                        "Tool budget exhausted before executing all planned tools. "
                                        "Respond with the evidence already gathered and clearly state any missing data."
                                    )
                                    budget_forced_finalization = True
                                else:
                                    effective_tool_timeout_ms = configured_tool_timeout_ms
                                    if remaining_budget_ms is not None and remaining_budget_ms > 0:
                                        if effective_tool_timeout_ms <= 0:
                                            effective_tool_timeout_ms = remaining_budget_ms
                                        else:
                                            effective_tool_timeout_ms = min(effective_tool_timeout_ms, remaining_budget_ms)
                                    planned_chunk = build_tool_status_chunk(
                                        request_hash=request_hash,
                                        chunk_id=stream_chunk_id,
                                        model=request.model,
                                        status=f"Planned {len(planned_custom_tools)} tool(s): {summarize_tool_names(planned_tool_names)}",
                                        phase="planned",
                                        count=len(planned_custom_tools),
                                        tools=planned_tool_names,
                                    )
                                    started_chunk = build_tool_status_chunk(
                                        request_hash=request_hash,
                                        chunk_id=stream_chunk_id,
                                        model=request.model,
                                        status=f"Running {len(planned_custom_tools)} tool(s) in parallel",
                                        phase="started",
                                        count=len(planned_custom_tools),
                                        tools=planned_tool_names,
                                    )
                                    non_text_signal_emitted = True
                                    yield f"data: {json.dumps(planned_chunk)}\n\n"
                                    yield f"data: {json.dumps(started_chunk)}\n\n"
                                    print(f"[Custom Tool] Executing {len(planned_custom_tools)} planned tool(s) in parallel")
                                    executed_tool_calls = await execute_planned_custom_tools(
                                        planned_custom_tools,
                                        execute_tool=execute_custom_tool,
                                        normalize_result=normalize_tool_result,
                                        auth_token=user_auth_token,
                                        tool_context=request.tool_context,
                                        log=log_tools,
                                        per_tool_timeout_ms=effective_tool_timeout_ms,
                                    )
                                    finished_chunk = build_tool_status_chunk(
                                        request_hash=request_hash,
                                        chunk_id=stream_chunk_id,
                                        model=request.model,
                                        status=f"Finished {len(executed_tool_calls)} tool(s): {summarize_tool_names([tool.name for tool in executed_tool_calls])}",
                                        phase="finished",
                                        count=len(executed_tool_calls),
                                        tools=[tool.name for tool in executed_tool_calls],
                                    )
                                    non_text_signal_emitted = True
                                    yield f"data: {json.dumps(finished_chunk)}\n\n"
                                    for executed_tool in executed_tool_calls:
                                        print(f"[Custom Tool] {executed_tool.name} returned in {executed_tool.duration_ms}ms")
                                        tool_status_label = (
                                            f"Failed {executed_tool.name}"
                                            if executed_tool.error
                                            else f"Completed {executed_tool.name}"
                                        )
                                        status_chunk = {
                                            "id": stream_chunk_id,
                                            "object": "chat.completion.chunk",
                                            "created": int(__import__('time').time()),
                                            "model": request.model,
                                            "choices": [{
                                                "index": 0,
                                                "delta": {
                                                    "tool_status": tool_status_label
                                                },
                                                "finish_reason": None
                                            }]
                                        }
                                        non_text_signal_emitted = True
                                        yield f"data: {json.dumps(status_chunk)}\n\n"
                                        if executed_tool.client_action and executed_tool.name != "prepare_swap_transaction":
                                            non_text_signal_emitted = True
                                            action_chunk = {
                                                "id": stream_chunk_id,
                                                "object": "chat.completion.chunk",
                                                "created": int(__import__('time').time()),
                                                "model": request.model,
                                                "choices": [{
                                                    "index": 0,
                                                    "delta": {
                                                        "client_actions": [executed_tool.client_action]
                                                    },
                                                    "finish_reason": None
                                                }]
                                            }
                                            yield f"data: {json.dumps(action_chunk)}\n\n"
                                        print(f"[Custom Tool] Buffering tool result: {str(executed_tool.payload)[:100]}...")
                                        pending_tool_results.append(executed_tool.payload)
                                    if tool_budget_remaining_ms() == 0:
                                        print(f"[Tool Budget] Exhausted after executing planned tools at {tool_budget_elapsed_ms()}ms")
                                        budget_chunk = build_tool_status_chunk(
                                            request_hash=request_hash,
                                            chunk_id=stream_chunk_id,
                                            model=request.model,
                                            status="Tool budget exhausted after collecting partial evidence",
                                            phase="budget_exhausted",
                                            count=len(executed_tool_calls),
                                            tools=[tool.name for tool in executed_tool_calls],
                                            reason="post_execution",
                                        )
                                        non_text_signal_emitted = True
                                        yield f"data: {json.dumps(budget_chunk)}\n\n"
                                        pending_tool_results.append(
                                            "Tool budget exhausted after collecting partial evidence. "
                                            "Produce the final answer now using only the gathered tool outputs."
                                        )
                                        budget_forced_finalization = True

                            final_tool_call_check = custom_tool_executed
                            
                            # Also check response.tool_calls one more time as final fallback
                            if not final_tool_call_check and hasattr(final_response, 'tool_calls') and final_response.tool_calls:
                                fallback_planned_custom_tools = []
                                # Process tool calls from final_response if not already processed
                                for tool_call in final_response.tool_calls:
                                    if hasattr(tool_call, 'function'):
                                        tool_name = extract_tool_name(tool_call)
                                        if not tool_name:
                                            continue
                                        is_client_tool = is_client_side_tool(tool_call, tool_name)
                                        if is_client_tool and tool_name in available_tools:
                                            try:
                                                tool_args = tool_call.function.arguments if hasattr(tool_call.function, 'arguments') else '{}'
                                                tool_args_str = str(tool_args) if tool_args else ''
                                                tool_call_signature = f"{tool_name}:{hash(tool_args_str)}"
                                                if tool_call_signature in processed_tool_call_ids:
                                                    continue
                                                processed_tool_call_ids.add(tool_call_signature)
                                                tool_call_repeat_counts[tool_call_signature] = tool_call_repeat_counts.get(tool_call_signature, 0) + 1
                                                if tool_call_repeat_counts[tool_call_signature] >= 2:
                                                    pending_tool_results.append(
                                                        f"No further tool calls (repeat limit reached for {tool_name}). Respond without additional tools."
                                                    )
                                                    has_tool_calls_this_turn = True
                                                    custom_tool_executed = True
                                                    continue
                                                args, args_ready = parse_tool_args_safe(tool_args)
                                                if not args_ready:
                                                    pending_tool_results.append(
                                                        f"Tool {tool_name} returned incomplete arguments. Respond without calling more tools."
                                                    )
                                                    has_tool_calls_this_turn = True
                                                    custom_tool_executed = True
                                                    continue
                                                fallback_planned_custom_tools.append(PlannedToolCall(name=tool_name, args=args))
                                                has_tool_calls_this_turn = True
                                                custom_tool_executed = True
                                            except Exception as e:
                                                print(f"[Client Action] Error executing tool {tool_name}: {e}")
                                if fallback_planned_custom_tools:
                                    fallback_tool_names = [planned_tool.name for planned_tool in fallback_planned_custom_tools]
                                    remaining_budget_ms = tool_budget_remaining_ms()
                                    if remaining_budget_ms == 0:
                                        print(f"[Tool Budget] Exhausted before fallback planned tools at {tool_budget_elapsed_ms()}ms")
                                        budget_chunk = build_tool_status_chunk(
                                            request_hash=request_hash,
                                            chunk_id=stream_chunk_id,
                                            model=request.model,
                                            status=f"Tool budget exhausted before fallback batch of {len(fallback_planned_custom_tools)} tool(s)",
                                            phase="budget_exhausted",
                                            count=len(fallback_planned_custom_tools),
                                            tools=fallback_tool_names,
                                            reason="fallback_pre_execution",
                                        )
                                        non_text_signal_emitted = True
                                        yield f"data: {json.dumps(budget_chunk)}\n\n"
                                        pending_tool_results.append(
                                            "Tool budget exhausted before fallback tool execution. "
                                            "Produce the final answer from the evidence already available."
                                        )
                                        budget_forced_finalization = True
                                    else:
                                        effective_tool_timeout_ms = configured_tool_timeout_ms
                                        if remaining_budget_ms is not None and remaining_budget_ms > 0:
                                            if effective_tool_timeout_ms <= 0:
                                                effective_tool_timeout_ms = remaining_budget_ms
                                            else:
                                                effective_tool_timeout_ms = min(effective_tool_timeout_ms, remaining_budget_ms)
                                        planned_chunk = build_tool_status_chunk(
                                            request_hash=request_hash,
                                            chunk_id=stream_chunk_id,
                                            model=request.model,
                                            status=f"Planned fallback batch of {len(fallback_planned_custom_tools)} tool(s): {summarize_tool_names(fallback_tool_names)}",
                                            phase="planned",
                                            count=len(fallback_planned_custom_tools),
                                            tools=fallback_tool_names,
                                            reason="fallback",
                                        )
                                        started_chunk = build_tool_status_chunk(
                                            request_hash=request_hash,
                                            chunk_id=stream_chunk_id,
                                            model=request.model,
                                            status=f"Running fallback batch of {len(fallback_planned_custom_tools)} tool(s) in parallel",
                                            phase="started",
                                            count=len(fallback_planned_custom_tools),
                                            tools=fallback_tool_names,
                                            reason="fallback",
                                        )
                                        non_text_signal_emitted = True
                                        yield f"data: {json.dumps(planned_chunk)}\n\n"
                                        yield f"data: {json.dumps(started_chunk)}\n\n"
                                        print(f"[Custom Tool] Executing {len(fallback_planned_custom_tools)} fallback planned tool(s) in parallel")
                                        executed_tool_calls = await execute_planned_custom_tools(
                                            fallback_planned_custom_tools,
                                            execute_tool=execute_custom_tool,
                                            normalize_result=normalize_tool_result,
                                            auth_token=user_auth_token,
                                            tool_context=request.tool_context,
                                            log=log_tools,
                                            per_tool_timeout_ms=effective_tool_timeout_ms,
                                        )
                                        finished_chunk = build_tool_status_chunk(
                                            request_hash=request_hash,
                                            chunk_id=stream_chunk_id,
                                            model=request.model,
                                            status=f"Finished fallback batch of {len(executed_tool_calls)} tool(s): {summarize_tool_names([tool.name for tool in executed_tool_calls])}",
                                            phase="finished",
                                            count=len(executed_tool_calls),
                                            tools=[tool.name for tool in executed_tool_calls],
                                            reason="fallback",
                                        )
                                        non_text_signal_emitted = True
                                        yield f"data: {json.dumps(finished_chunk)}\n\n"
                                        for executed_tool in executed_tool_calls:
                                            if executed_tool.client_action and executed_tool.name != "prepare_swap_transaction":
                                                non_text_signal_emitted = True
                                                action_chunk = {
                                                    "id": stream_chunk_id,
                                                    "object": "chat.completion.chunk",
                                                    "created": int(__import__('time').time()),
                                                    "model": request.model,
                                                    "choices": [{
                                                        "index": 0,
                                                        "delta": {
                                                            "client_actions": [executed_tool.client_action]
                                                        },
                                                        "finish_reason": None
                                                    }]
                                                }
                                                yield f"data: {json.dumps(action_chunk)}\n\n"
                                            pending_tool_results.append(executed_tool.payload)
                                        if tool_budget_remaining_ms() == 0:
                                            print(f"[Tool Budget] Exhausted after fallback planned tools at {tool_budget_elapsed_ms()}ms")
                                            budget_chunk = build_tool_status_chunk(
                                                request_hash=request_hash,
                                                chunk_id=stream_chunk_id,
                                                model=request.model,
                                                status="Tool budget exhausted after fallback evidence collection",
                                                phase="budget_exhausted",
                                                count=len(executed_tool_calls),
                                                tools=[tool.name for tool in executed_tool_calls],
                                                reason="fallback_post_execution",
                                            )
                                            non_text_signal_emitted = True
                                            yield f"data: {json.dumps(budget_chunk)}\n\n"
                                            pending_tool_results.append(
                                                "Tool budget exhausted after fallback evidence collection. "
                                                "Produce the final answer now using only the gathered tool outputs."
                                            )
                                            budget_forced_finalization = True
                            # Recompute after fallback processing in case custom_tool_executed changed above.
                            final_tool_call_check = custom_tool_executed
                            
                            if force_stop_after_turn is not None and tool_turn >= force_stop_after_turn:
                                final_tool_call_check = False
                            if instant_swap_action_emitted:
                                # Once instant execution is dispatched to client, end tool chaining.
                                final_tool_call_check = False
                            if budget_forced_finalization:
                                print(f"[Tool Budget] Finalizing early after {tool_budget_elapsed_ms()}ms with current tool evidence")
                                for tool_payload in pending_tool_results:
                                    safe_payload = normalize_tool_payload_for_history(tool_payload)
                                    tool_result_history.append(safe_payload)
                                final_tool_call_check = False

                            if final_tool_call_check:
                                # CRITICAL FIX: Tool was called, continue to next turn to get Grok's response
                                # Don't break here! We need to call chat.stream() again to get Grok's response
                                # based on the tool result we just added to the chat
                                print(f"[Tool Turn] Tool call detected, continuing to turn {tool_turn + 2}")

                                # IMPORTANT: Reuse existing chat instance for tool chaining.
                                # Re-creating chat with previous_response_id on every tool turn can drop
                                # in-memory context and lead to INVALID_ARGUMENT in deeper turns.
                                if final_response and not hasattr(final_response, "id"):
                                    try:
                                        chat.append(final_response)
                                    except Exception as e:
                                        print(f"[Tool Turn] Failed to append response: {e}")

                                if not pending_tool_results:
                                    pending_tool_results = [
                                        "Tool execution produced no usable result. Respond directly without additional tool calls."
                                    ]

                                for tool_payload in pending_tool_results:
                                    safe_payload = normalize_tool_payload_for_history(tool_payload)
                                    tool_result_history.append(safe_payload)
                                    chat.append(tool_result(result=safe_payload))

                                continue  # Go to next turn to get Grok's response
                            else:
                                # Ensure we sent some content before finishing
                                if not content_sent_this_turn:
                                    # Try to send a fallback message if we have final_response content
                                    if final_response and hasattr(final_response, 'text') and final_response.text:
                                        try:
                                            fallback_chunk = {
                                                "id": stream_chunk_id,
                                                "object": "chat.completion.chunk",
                                                "created": int(__import__('time').time()),
                                                "model": request.model,
                                                "choices": [{
                                                    "index": 0,
                                                    "delta": {
                                                        "content": str(final_response.text)
                                                    },
                                                    "finish_reason": None
                                                }]
                                            }
                                            yield f"data: {json.dumps(fallback_chunk)}\n\n"
                                            text_chunks_sent += 1
                                        except Exception as e:
                                            pass
                                break  # Done - exit multi-turn loop
                    
                    except grpc.RpcError as grpc_error:
                        # Handle gRPC errors according to xai-sdk official docs
                        status_code = grpc_error.code()
                        error_details = grpc_error.details()
                        
                        print(f"[gRPC Error] Status: {status_code}, Details: {error_details}")
                        
                        if status_code == grpc.StatusCode.UNAVAILABLE:
                            print("[gRPC Error] Service temporarily unavailable - connection may have been closed")
                            # If we have a final_response, try to send it before closing
                            # Don't raise immediately, allow graceful handling
                            if final_response and chunk_count > 0:
                                print(f"[gRPC Error] Connection closed after {chunk_count} chunks, attempting to send final response")
                                # Continue to citations extraction below
                            else:
                                # No content received, send error to client
                                error_chunk = {
                                    "id": stream_chunk_id,
                                    "object": "chat.completion.chunk",
                                    "created": int(__import__('time').time()),
                                    "model": request.model,
                                    "choices": [{
                                        "index": 0,
                                        "delta": {},
                                        "finish_reason": "stop",
                                        "error": {
                                            "message": "Service temporarily unavailable",
                                            "type": "unavailable"
                                        }
                                    }]
                                }
                                try:
                                    yield f"data: {json.dumps(error_chunk)}\n\n"
                                    yield "data: [DONE]\n\n"
                                except:
                                    pass
                                return
                        elif status_code == grpc.StatusCode.DEADLINE_EXCEEDED:
                            print("[gRPC Error] Request timeout")
                            # Send timeout error to client
                            error_chunk = {
                                "id": stream_chunk_id,
                                "object": "chat.completion.chunk",
                                "created": int(__import__('time').time()),
                                "model": request.model,
                                "choices": [{
                                    "index": 0,
                                    "delta": {},
                                    "finish_reason": "stop",
                                    "error": {
                                        "message": "Request timeout",
                                        "type": "timeout"
                                    }
                                }]
                            }
                            try:
                                yield f"data: {json.dumps(error_chunk)}\n\n"
                                yield "data: [DONE]\n\n"
                            except:
                                pass
                            return
                        elif status_code == grpc.StatusCode.RESOURCE_EXHAUSTED:
                            print("[gRPC Error] Rate limit exceeded")
                            # Send rate limit error to client
                            error_chunk = {
                                "id": stream_chunk_id,
                                "object": "chat.completion.chunk",
                                "created": int(__import__('time').time()),
                                "model": request.model,
                                "choices": [{
                                    "index": 0,
                                    "delta": {},
                                    "finish_reason": "stop",
                                    "error": {
                                        "message": "Rate limit exceeded",
                                        "type": "rate_limit"
                                    }
                                }]
                            }
                            try:
                                yield f"data: {json.dumps(error_chunk)}\n\n"
                                yield "data: [DONE]\n\n"
                            except:
                                pass
                            return
                        else:
                            print(f"[gRPC Error] Unhandled status code: {status_code}")
                            # For other errors, if we have content, continue; otherwise send error
                            if not final_response or chunk_count == 0:
                                error_chunk = {
                                    "id": stream_chunk_id,
                                    "object": "chat.completion.chunk",
                                    "created": int(__import__('time').time()),
                                    "model": request.model,
                                    "choices": [{
                                        "index": 0,
                                        "delta": {},
                                        "finish_reason": "stop",
                                        "error": {
                                            "message": f"gRPC error: {error_details}",
                                            "type": "grpc_error"
                                        }
                                    }]
                                }
                                try:
                                    yield f"data: {json.dumps(error_chunk)}\n\n"
                                    yield "data: [DONE]\n\n"
                                except:
                                    pass
                                return
                        
                        # If we have content, continue to send final response with citations
                        # Don't re-raise if we have content to send
                        if not final_response or chunk_count == 0:
                            raise Exception(f"gRPC error ({status_code}): {error_details}") from grpc_error
                        
                        # NOTE: final_response.content sending removed - content already sent via buffering
                        # This prevents duplicate responses
                        
                        # Post-process final citations without overwriting stream-collected ones
                        if hasattr(final_response, 'citations') and final_response.citations:
                            citations_from_final = []
                            try:
                                raw_cites = final_response.citations
                                cite_list = []
                                
                                # Convert raw_cites -> cite_list
                                if isinstance(raw_cites, str):
                                    if raw_cites.startswith('[') and raw_cites.endswith(']'):
                                        try:
                                            import ast
                                            cite_list = ast.literal_eval(raw_cites)
                                        except:
                                            cite_list = [raw_cites]
                                    else:
                                        cite_list = [raw_cites]
                                elif hasattr(raw_cites, '__iter__') and not isinstance(raw_cites, (str, bytes)):
                                    cite_list = list(raw_cites)
                                else:
                                    cite_list = [raw_cites]
                                    
                                # Convert cite_list -> citations_from_final (dicts)
                                for item in cite_list:
                                    c_dict = {}
                                    if hasattr(item, 'url'):
                                        c_dict['url'] = str(item.url)
                                        for attr in ['avatar_url', 'avatarUrl', 'avatar', 'icon_url', 'iconUrl', 'profile_image_url', 'profileImageUrl']:
                                             if hasattr(item, attr):
                                                 val = getattr(item, attr)
                                                 if val: c_dict['avatar_url'] = str(val); break
                                    elif isinstance(item, dict):
                                        c_dict['url'] = str(item.get('url', ''))
                                        for k in ['avatar_url', 'avatarUrl', 'avatar']:
                                            if item.get(k): c_dict['avatar_url'] = str(item[k]); break
                                    else:
                                        c_dict['url'] = str(item)
                                        
                                    if c_dict.get('url'):
                                        citations_from_final.append(c_dict)
                                        
                                # Merge into collected_citations
                                count_new = 0
                                for new_c in citations_from_final:
                                    is_dup = False
                                    for existing in collected_citations:
                                        if existing.get('url') == new_c.get('url'):
                                            is_dup = True; break
                                    if not is_dup:
                                        collected_citations.append(new_c)
                                        count_new += 1
                                log_citations(f"[Citations] Merged {count_new} citations from final response into existing {len(collected_citations)}")
                                
                            except Exception as e:
                                print(f"[Citations Error] {e}")
                        else:
                            log_citations(f"[Citations] No citations attribute in final response")
                    else:
                        log_citations(f"[Citations] No final response available")
                    
                    if collected_citations:
                        collected_citations = normalize_citations_for_client(collected_citations)
                        log_citations(f"[Citations] Final: {len(collected_citations)} normalized citations will be sent to client")
                    else:
                        log_citations(f"[Citations] Final: No citations collected")
                    
                    # Send final chunk with citations
                    # Ensure all data is JSON-serializable (no protobuf types)
                    try:
                        allow_node_tool_handoff_without_text = (
                            not python_tool_execution_enabled
                            and tool_call_signal_emitted
                        )

                        if (
                            text_chunks_sent == 0
                            and non_text_signal_emitted
                            and not allow_node_tool_handoff_without_text
                        ):
                            try:
                                print("[Finalization] No visible text after tool turns; attempting no-tool finalization pass")
                                finalizer_response, finalizer_chunks = await collect_finalization_chunks()
                                if finalizer_response:
                                    final_response = finalizer_response
                                for chunk_data in finalizer_chunks:
                                    yield f"data: {json.dumps(chunk_data)}\n\n"
                                    text_chunks_sent += 1
                            except Exception as finalization_error:
                                print(f"[Finalization] Failed: {type(finalization_error).__name__}: {finalization_error}")

                        if text_chunks_sent == 0:
                            if allow_node_tool_handoff_without_text:
                                print("[Finalization] No visible text, but tool calls were emitted for Node control plane; skipping no-final error.")
                            else:
                                candidate_text = None
                                if final_response and hasattr(final_response, 'text') and final_response.text:
                                    value = str(final_response.text).strip()
                                    if value:
                                        candidate_text = value

                                if candidate_text:
                                    fallback_chunk = {
                                        "id": stream_chunk_id,
                                        "object": "chat.completion.chunk",
                                        "created": int(__import__('time').time()),
                                        "model": request.model,
                                        "choices": [{
                                            "index": 0,
                                            "delta": {
                                                "content": candidate_text
                                            },
                                            "finish_reason": None
                                        }]
                                    }
                                    yield f"data: {json.dumps(fallback_chunk)}\n\n"
                                    text_chunks_sent += 1
                                else:
                                    error_code = "NO_FINAL_TEXT_AFTER_TOOL_CHAIN" if non_text_signal_emitted else "NO_STABLE_FINAL_TEXT"
                                    error_message = (
                                        "Tool chain completed, but the model did not return a stable final answer."
                                        if non_text_signal_emitted
                                        else "The model did not return a stable final answer."
                                    )
                                    error_payload = {
                                        "message": error_message,
                                        "type": "finalization_error",
                                        "code": error_code,
                                    }
                                    error_chunk = {
                                        "id": stream_chunk_id,
                                        "object": "chat.completion.chunk",
                                        "created": int(__import__('time').time()),
                                        "model": request.model,
                                        "choices": [{
                                            "index": 0,
                                            "delta": {},
                                            "finish_reason": "stop",
                                            "error": error_payload,
                                        }],
                                        "error": error_payload,
                                    }
                                    yield f"data: {json.dumps(error_chunk)}\n\n"
                                    yield "data: [DONE]\n\n"
                                    return

                        # Citations are now objects with url and optional avatar_url
                        citations_list = collected_citations if collected_citations else []
                        
                        final_chunk = {
                            "id": build_stream_chunk_id(
                                request_hash=request_hash,
                                response_id=getattr(final_response, "id", None),
                            ),
                            "object": "chat.completion.chunk",
                            "created": int(__import__('time').time()),
                            "model": request.model,
                            "response_id": getattr(final_response, "id", None),
                            "choices": [{
                                "index": 0,
                                "delta": {},
                                "message": {
                                    "citations": citations_list
                                },
                                "finish_reason": "stop"
                            }],
                            "usage": {
                                "prompt_tokens": int(getattr(final_response.usage, 'prompt_tokens', 0)) if final_response and hasattr(final_response, 'usage') else 0,
                                "completion_tokens": int(getattr(final_response.usage, 'completion_tokens', 0)) if final_response and hasattr(final_response, 'usage') else 0,
                                "total_tokens": int(getattr(final_response.usage, 'total_tokens', 0)) if final_response and hasattr(final_response, 'usage') else 0,
                            }
                        }
                        
                        # Debug: Log usage information
                        if final_response and hasattr(final_response, 'usage'):
                            usage_obj = final_response.usage
                            prompt_tokens = int(getattr(usage_obj, 'prompt_tokens', 0))
                            completion_tokens = int(getattr(usage_obj, 'completion_tokens', 0))
                            total_tokens = int(getattr(usage_obj, 'total_tokens', 0))
                            log_tools(f"[Usage] Prompt: {prompt_tokens}, Completion: {completion_tokens}, Total: {total_tokens}")
                        else:
                            log_tools(f"[Usage] No usage data available in final_response")
                        
                        yield f"data: {json.dumps(final_chunk)}\n\n"
                        
                        # CRITICAL: Always send [DONE] marker, even if there were tool calls
                        # This ensures frontend knows the stream is complete
                        yield "data: [DONE]\n\n"
                    except (BrokenPipeError, ConnectionResetError, OSError) as send_error:
                        # Client disconnected during final chunk send
                        return
                    except Exception as final_error:
                        # Error sending final chunk - log but don't crash
                        print(f"[Error] Error sending final chunk: {final_error}")
                        try:
                            yield "data: [DONE]\n\n"
                        except:
                            pass  # Client already disconnected
                    
                except GeneratorExit:
                    # Client disconnected - clean exit
                    return
                except (BrokenPipeError, ConnectionResetError, OSError) as conn_error:
                    # Client connection errors - don't log as errors, just clean exit
                    return
                except Exception as e:
                    import traceback
                    error_msg = str(e)
                    error_type = type(e).__name__
                    print(f"[Error] Stream error after {chunk_count} chunks: {error_type}: {error_msg}")
                    print(f"[Error] Traceback: {traceback.format_exc()}")
                    
                    # Try to send error in OpenAI-compatible format
                    try:
                        error_data = {
                            "id": build_stream_chunk_id(request_hash=request_hash),
                            "object": "chat.completion.chunk",
                            "created": int(__import__('time').time()),
                            "model": request.model,
                            "choices": [{
                                "index": 0,
                                "delta": {},
                                "finish_reason": "stop"
                            }],
                            "error": {
                                "message": error_msg,
                                "type": error_type,
                                "chunk_count": chunk_count
                            }
                        }
                        yield f"data: {json.dumps(error_data)}\n\n"
                    except (BrokenPipeError, ConnectionResetError, OSError):
                        # Client already disconnected, can't send error
                        return
                    except Exception as send_error:
                        # Error sending error message - just log
                        print(f"[Error] Failed to send error message: {send_error}")
                    finally:
                        try:
                            yield "data: [DONE]\n\n"
                        except:
                            pass  # Client already disconnected
            
            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                }
            )
        
        else:
            # Non-streaming response - OpenAI-compatible format
            log_tools(f"[Chat] Sampling non-streaming response")
            
            max_turns = 5
            final_response = None
            
            for turn in range(max_turns):
                log_tools(f"[Chat] [Turn {turn+1}] Sampling...")
                response = await chat.sample()
                final_response = response
                pending_tool_results = []
                custom_tool_executed = False
                
                log_tools(f"[Chat] [Turn {turn+1}] Response type: {type(response)}")
                log_tools(f"[Chat] [Turn {turn+1}] Content: {response.content!r}")
                
                # Check for tool_calls
                tool_calls = getattr(response, 'tool_calls', [])
                if tool_calls:
                    log_tools(f"[Chat] [Turn {turn+1}] Tool calls detected: {len(tool_calls)}")
                    planned_custom_tools = []
                    
                    for tc in tool_calls:
                        name = getattr(tc.function, 'name', 'unknown')
                        args_str = getattr(tc.function, 'arguments', '{}')
                        
                        try:
                            is_client_tool = python_tool_execution_enabled and get_tool_call_type(tc) == "client_side_tool"
                        except Exception:
                            is_client_tool = python_tool_execution_enabled and name in available_tools

                        if is_client_tool and name in available_tools:
                            log_tools(f"[Chat] [Turn {turn+1}] Planning custom tool: {name}")
                            try:
                                args = json.loads(args_str) if args_str else {}
                                planned_custom_tools.append(PlannedToolCall(name=name, args=args))
                                custom_tool_executed = True
                            except Exception as e:
                                log_tools(f"[Chat] [Turn {turn+1}] Custom tool args parse error: {e}")
                                pending_tool_results.append(f"Error parsing {name} arguments: {str(e)}")
                                custom_tool_executed = True
                        else:
                            # Built-in tools like web_search, x_search
                            # In xai-sdk, it seems we don't manually execute these in this SDK version
                            # but we might need to continue the turn if they are present?
                            # Actually, if tool_calls are present, we MUST continue to get the final answer.
                            log_tools(f"[Chat] [Turn {turn+1}] Built-in tool detected: {name}")
                            # For built-in tools, the SDK might have already added them or we just need to let it be.
                            # However, if we don't loop, we don't get the follow-up content.

                    if planned_custom_tools:
                        print(f"[Chat] [Turn {turn+1}] Executing {len(planned_custom_tools)} planned tool(s) in parallel")
                        executed_tool_calls = await execute_planned_custom_tools(
                            planned_custom_tools,
                            execute_tool=execute_custom_tool,
                            normalize_result=normalize_tool_result,
                            auth_token=user_auth_token,
                            tool_context=request.tool_context,
                            log=log_tools,
                        )
                        pending_tool_results.extend(executed_tool.payload for executed_tool in executed_tool_calls)
                    elif not python_tool_execution_enabled:
                        # Node control-plane handles custom tool execution; avoid local fallback loops.
                        break
                    
                    # Keep using the same chat instance across tool turns.
                    # Re-creating with previous_response_id can produce empty-message
                    # chains and trigger INVALID_ARGUMENT from xAI.
                    if not pending_tool_results:
                        pending_tool_results = ["tool_result_empty"]
                    for tool_payload in pending_tool_results:
                        if tool_payload is None:
                            safe_payload = "tool_result_empty"
                        else:
                            safe_payload = str(tool_payload).strip()
                            if not safe_payload:
                                safe_payload = "tool_result_empty"
                        if len(safe_payload) > 12000:
                            safe_payload = safe_payload[:12000]
                        chat.append(tool_result(result=safe_payload))

                    # Continue to next turn to get the answer after tool calls
                    continue
                else:
                    # No more tool calls, we have our final answer
                    break
            
            response = final_response
            # Extract usage safely
            usage_dict = {
                "prompt_tokens": getattr(response.usage, 'prompt_tokens', 0),
                "completion_tokens": getattr(response.usage, 'completion_tokens', 0),
                "total_tokens": getattr(response.usage, 'total_tokens', 0),
            }
            
            # Extract citations safely - try multiple approaches
            citations = []
            if hasattr(response, 'citations') and response.citations:
                try:
                    if isinstance(response.citations, (list, tuple)):
                        # Handle citation objects with url and avatar_url
                        for cite in response.citations:
                            if hasattr(cite, 'url') or (isinstance(cite, dict) and 'url' in cite):
                                # Citation object with metadata
                                cite_dict = {}
                                if hasattr(cite, 'url'):
                                    cite_dict['url'] = str(cite.url)
                                    if hasattr(cite, 'avatar_url') and cite.avatar_url:
                                        cite_dict['avatar_url'] = str(cite.avatar_url)
                                elif isinstance(cite, dict):
                                    cite_dict['url'] = str(cite.get('url', ''))
                                    if cite.get('avatar_url'):
                                        cite_dict['avatar_url'] = str(cite['avatar_url'])
                                citations.append(cite_dict)
                            elif isinstance(cite, (list, tuple)):
                                # If citation is a list/tuple, flatten it
                                citations.extend([{'url': str(item)} for item in cite])
                            else:
                                # Simple string URL
                                citations.append({'url': str(cite)})
                    else:
                        # Single value or string - might be a string representation of a list
                        cite_str = str(response.citations)
                        log_citations(f"[Citations] Non-streaming: Single citation value (string): {cite_str[:100]}...")
                        
                        # Try to parse if it looks like a list string
                        if cite_str.startswith('[') and cite_str.endswith(']'):
                            try:
                                import ast
                                parsed_list = ast.literal_eval(cite_str)
                                if isinstance(parsed_list, list):
                                    log_citations(f"[Citations] Non-streaming: Parsed as list with {len(parsed_list)} items")
                                    citations = [{'url': str(item)} for item in parsed_list]
                                else:
                                    citations = [{'url': cite_str}]
                            except Exception as parse_err:
                                log_citations(f"[Citations] Non-streaming: Failed to parse as list: {parse_err}, treating as single URL")
                                citations = [{'url': cite_str}]
                        else:
                            # Regular string URL
                            citations = [{'url': cite_str}]
                    log_citations(f"[Citations] Non-streaming: Found {len(citations)} citations")
                except Exception as cite_error:
                    log_citations(f"[Citations] Non-streaming: Error converting citations: {cite_error}")
                    citations = []
            
            # Try alternative attribute names
            if not citations:
                for attr_name in ['citations', 'sources', 'references']:
                    if hasattr(response, attr_name):
                        attr_value = getattr(response, attr_name)
                        if attr_value:
                            try:
                                if isinstance(attr_value, (list, tuple)) and len(attr_value) > 0:
                                    # Flatten nested structures
                                    for cite in attr_value:
                                        if isinstance(cite, (list, tuple)):
                                            citations.extend([str(item) for item in cite])
                                        else:
                                            citations.append(str(cite))
                                    log_citations(f"[Citations] Non-streaming: Found {len(citations)} citations in {attr_name}")
                                    break
                            except Exception as e:
                                log_citations(f"[Citations] Non-streaming: Error processing {attr_name}: {e}")
                                continue
            
            if citations:
                log_citations(f"[Citations] Non-streaming: Sending {len(citations)} citations to client")
            
            return {
                "id": build_stream_chunk_id(
                    request_hash=hash(str(request.messages)),
                    response_id=getattr(response, "id", None),
                ),
                "object": "chat.completion",
                "created": int(__import__('time').time()),
                "model": request.model,
                "response_id": getattr(response, "id", None),
                "choices": [{
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": response.content or "",
                        "citations": citations
                    },
                    "finish_reason": "stop"
                }],
                "usage": usage_dict
            }
    
    except Exception as e:
        import traceback
        error_msg = f"Chat completion error: {str(e)}"
        print(f"[Error] {error_msg}")
        print(f"[Error] Full traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/")
async def root():
    """Root endpoint with service info"""
    return {
        "service": "Grok API Service",
        "version": "1.0.0",
        "endpoints": {
            "/health": "Health check",
            "/v1/chat/completions": "Chat completions (POST)",
        }
    }



class NewsRequest(BaseModel):
    tokens: List[dict]


NEWS_WRITER_PROMPT = """
# 🧠 Web3 Hot Token Analysis Reporter
You are a senior Web3 reporter analyzing trending tokens with narrative intelligence.

**LANGUAGE RULE: Always output in English.**

Writing style:
- Adaptive depth based on token characteristics
- High information density
- Multi-angle analysis (people, ecosystem, culture, events)
- Professional but crypto-native tone

Narrative Tags (select 3-4):
- Person Narrative, Ecosystem Narrative, Culture Narrative, Event Narrative
- Mechanism Narrative, Historical Narrative, Social Narrative, Funds Flow Narrative

On-Chain Behavior Tags:
- Whale Accumulation, Retail Surge, Bot Sniping, Community Takeover
- Capital Rotation, Low Liquidity Volatility, Event-driven Trading

Risk Tags:
- Short-term Risk, Narrative Exhaustion Risk, Liquidity Risk
- Celebrity Dependency Risk, Mechanism Failure Risk

Output Structure:
**Token Name**
- **Narrative Tags**: [...]
- **On-Chain Behavior Tags**: [...]
- **Risk Tags**: [...]
- **Summary**: One sentence why it's trending
- **Analysis**: Event drivers, on-chain behavior, social discussion, risks

Do not cite URLs or external sources.
"""

TOOL_DEFINITIONS = """
- web_search: Search the public web for recent info (news, announcements, docs).
- x_search: Search X/Twitter for real-time narratives and community discussion.
- get_token_info: Fetch token metadata (price/liquidity/volume) from KiKo backend.
- check_token_risk: Run a token security scan (honeypot, tax, ownership, risk flags).
- get_trending_tokens: Get trending tokens list.
- fetch_farcaster_trending: Fetch Farcaster trending casts/topics.
- search_farcaster_casts: Search Farcaster casts by keyword.
- get_polymarket_trending: Get trending Polymarket events.
- search_polymarket: Search Polymarket events by keyword.
- get_polymarket_event: Fetch a specific Polymarket event details.
""".strip()


@app.post("/chat/write_news", dependencies=[Depends(require_auth)])
async def write_news(request: NewsRequest):
    """
    Generate news article based on trending tokens
    Now with FULL TOOL ACCESS for enhanced analysis
    """
    try:
        tokens = request.tokens
        if not tokens:
            raise HTTPException(status_code=400, detail="No tokens provided")

        # Format input for Grok
        token_lines = []
        for t in tokens:
            price_str = t.get('price')
            if isinstance(price_str, (int, float)):
                price_str = f"${price_str}"
            
            change = t.get('priceChange')
            change_str = f"+{change}%" if change > 0 else f"{change}%"
            
            token_lines.append(
                f"- {t.get('name')} (${t.get('symbol')}) on {str(t.get('chain')).upper()}\n"
                f"  Price: {price_str} | 24h Change: {change_str}\n"
                f"  Volume: ${t.get('volume', 0):,.0f} | Market Cap: ${t.get('marketCap', 0):,.0f}"
            )

        user_content = (
            "Here is the data for the top trending tokens from the last 24 hours (across ETH, Base, Solana, BSC):\n\n" + 
            "\n\n".join(token_lines) + 
            "\n\nPlease write the 'Today's On‑Chain Hot Token Watch' article."
        )

        print(f"[NewsWriter] Generating news for {len(tokens)} tokens with TOOLS enabled...")

        # Build enhanced system prompt with runtime instructions
        # Use Chinese Brain (Original Prompt) but force English Mouth (Runtime Instruction)
        runtime_instructions = """
---
## 🚨 运行时执行规则 (Prime Directive):
1. **STRICTLY ENGLISH OUTPUT**: 无论上述指令使用的是什么语言，最终生成的新闻文章必须 100% 使用英语。
2. **X SEARCH MANDATE**: 你必须利用你的 **X (Twitter) 实时搜索能力**，查询每一个代币的最新社交叙事和热度原因。
3. **DEPTH**: 利用主指令中的“中文脑子”进行深度思考和分析，但请用流利、Crypto Native 的英语表达出来。
---
"""
        # Inject current date into prompt
        from datetime import datetime
        current_date_str = datetime.now().strftime('%B %d, %Y')
        dated_prompt = NEWS_WRITER_PROMPT.replace("{{CURRENT_DATE}}", current_date_str)
        
        enhanced_system_prompt = f"""{dated_prompt}
{runtime_instructions}

--- AVAILABLE TOOLS ---
You have access to the following tools to enhance your analysis.
Use them when you need additional real-time information:

{TOOL_DEFINITIONS}

**TOOL USAGE GUIDELINES FOR NEWS WRITING:**
1. Use `get_token_info` to get detailed metadata for any token you want to analyze deeper.
2. Use `check_token_risk` to scan tokens for security risks before recommending.
3. Use `web_search` to find the latest news or events related to a token.
4. Use `x_search` to find what people are discussing on X/Twitter about a topic.
5. Use `fetch_farcaster_trending` to check what the Farcaster community is discussing.

**PREDICTION MARKET TOOLS (Polymarket):**
These tools are HIGHLY RECOMMENDED for enhancing your analysis with real market sentiment:
6. Use `get_polymarket_trending` to see what events people are betting on - great for understanding market sentiment.
7. Use `search_polymarket` with keywords like "bitcoin", "fed", "recession" to find prediction market odds for topics.
8. Use `get_polymarket_event` with an event_id to get detailed YES/NO probabilities for specific predictions.

Example: When writing about Bitcoin, you can call `search_polymarket(query="bitcoin")` to find prediction markets like "Will Bitcoin reach $150k in 2025?" and include the probability in your analysis!

Only use tools when the provided data is insufficient for quality analysis.
"""

        # Use xAI SDK with ALL TOOLS enabled
        async with AsyncClient(api_key=xai_api_key) as client:
            # Create chat WITH tools (web_search + custom tools)
            tools = [web_search(), x_search()] + CUSTOM_TOOLS  # web_search + x_search + custom tools
            chat = client.chat.create(
                model="grok-4-1-fast-non-reasoning",
                tools=tools,
                store_messages=True,
            )
            print(f"[NewsWriter] Chat created with {len(tools)} tools")
            
            # Add system prompt
            chat.append(system(enhanced_system_prompt))
            
            # Add user content
            chat.append(user(user_content))
            
            # Tool call handling loop
            max_tool_turns = 10  # Allow up to 10 tool call rounds for thorough analysis
            full_content = ""
            
            for tool_turn in range(max_tool_turns):
                has_tool_calls_this_turn = False
                final_response = None
                pending_tool_results = []
                planned_tool_calls = []
                
                async for response, chunk in chat.stream():
                    if response:
                        final_response = response
                    
                    # Collect content
                    content = getattr(chunk, 'content', None)
                    if content:
                        full_content += content
                    
                    # Check for tool calls
                    if hasattr(chunk, 'tool_calls') and chunk.tool_calls:
                        for tool_call in chunk.tool_calls:
                            if hasattr(tool_call, 'function'):
                                tool_name = tool_call.function.name if hasattr(tool_call.function, 'name') else 'unknown'
                                tool_args_raw = tool_call.function.arguments if hasattr(tool_call.function, 'arguments') else '{}'
                                
                                # Only handle our custom tools (built-in like web_search are auto-handled)
                                custom_tool_names = {
                                    "check_token_risk", "get_token_price", "get_trending_tokens",
                                    "prepare_swap_transaction", "get_token_info", "get_wallet_info",
                                    "get_gas_price", "get_historical_price", "create_copy_trade_task",
                                    "fetch_farcaster_trending", "get_farcaster_user", "search_farcaster_casts",
                                    "get_polymarket_trending", "get_polymarket_event", "search_polymarket"
                                }
                                
                                try:
                                    is_client_tool = get_tool_call_type(tool_call) == "client_side_tool"
                                except Exception:
                                    is_client_tool = tool_name in custom_tool_names

                                if is_client_tool and tool_name in custom_tool_names:
                                    has_tool_calls_this_turn = True
                                    print(f"[NewsWriter] Tool call: {tool_name}")
                                    try:
                                        args = json.loads(str(tool_args_raw)) if tool_args_raw else {}
                                        planned_tool_calls.append(PlannedToolCall(name=tool_name, args=args))
                                    except Exception as e:
                                        print(f"[NewsWriter] Tool {tool_name} args parse failed: {e}")
                                        pending_tool_results.append(json.dumps({"error": f"Failed to parse {tool_name} args: {str(e)}"}))
                
                # If tool calls were made, continue to next turn
                if has_tool_calls_this_turn:
                    if planned_tool_calls:
                        print(f"[NewsWriter] Executing {len(planned_tool_calls)} planned tool(s) in parallel")
                        executed_tool_calls = await execute_planned_custom_tools(
                            planned_tool_calls,
                            execute_tool=execute_custom_tool,
                            normalize_result=normalize_tool_result,
                            auth_token=None,
                            tool_context=None,
                            log=print,
                        )
                        for executed_tool in executed_tool_calls:
                            pending_tool_results.append(executed_tool.payload)
                            print(f"[NewsWriter] Tool {executed_tool.name} completed in {executed_tool.duration_ms}ms")
                    # Keep tool-chain state in one chat object to avoid invalid empty turns.
                    if not pending_tool_results:
                        pending_tool_results = ["tool_result_empty"]
                    for tool_payload in pending_tool_results:
                        if tool_payload is None:
                            safe_payload = "tool_result_empty"
                        else:
                            safe_payload = str(tool_payload).strip()
                            if not safe_payload:
                                safe_payload = "tool_result_empty"
                        if len(safe_payload) > 12000:
                            safe_payload = safe_payload[:12000]
                        chat.append(tool_result(result=safe_payload))
                    full_content = ""  # Clear content, new turn will regenerate
                    print(f"[NewsWriter] Tool turn {tool_turn + 1} complete, continuing...")
                    continue
                else:
                    # No tool calls, we're done
                    break
            
            # Get final text from response if available
            if final_response and hasattr(final_response, 'text') and final_response.text:
                full_content = str(final_response.text)
            
            if not full_content:
                raise HTTPException(status_code=500, detail="No content generated")
            
            print(f"[NewsWriter] Generated {len(full_content)} chars of content")
            return {"content": full_content}

    except Exception as e:
        print(f"[NewsWriter] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
