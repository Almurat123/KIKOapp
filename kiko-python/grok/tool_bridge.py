from __future__ import annotations

from typing import Dict, Optional, Tuple


TOOL_NAME_ALIASES: Dict[str, str] = {
    "get_token_early_buyers": "get_early_buyers",
    "fetch_farcaster_trending": "get_trending_casts",
    "create_copy_trade_task": "create_copy_trade_config",
    "web_search_with_snippets": "web_search",
    "x_semantic_search": "x_search",
    "x_keyword_search": "x_search",
    "x_thread_fetch": "x_search",
}

TOKEN_ANALYSIS_TOOLS = {
    "get_token_info",
    "get_early_buyers",
    "check_token_risk",
    "get_token_top_gainers",
}


def normalize_tool_request(
    tool_name: str,
    arguments: Optional[dict],
    tool_context: Optional[dict],
) -> Tuple[str, dict]:
    canonical_name = TOOL_NAME_ALIASES.get(tool_name, tool_name)
    normalized_args = dict(arguments or {})
    context = tool_context or {}

    if tool_name == "x_thread_fetch":
        post_id = str(
            normalized_args.get("post_id")
            or normalized_args.get("tweet_id")
            or normalized_args.get("id")
            or ""
        ).strip()
        if post_id:
            normalized_args = {
                "query": f"https://x.com/i/status/{post_id}",
            }
    elif tool_name in {"x_keyword_search", "x_semantic_search"}:
        query = str(normalized_args.get("query") or "").strip()
        mode = str(normalized_args.get("mode") or "").strip()
        normalized_args = {
            "query": query,
            **({"mode": mode} if mode else {}),
        }

    analysis_chain = _normalize_chain_slug(context.get("analysisChain"))
    analysis_chain_id = _parse_chain_id(context.get("analysisChainId"))
    analysis_token_address = _normalize_address(context.get("analysisTokenAddress"))
    request_token_address = _normalize_address(
        normalized_args.get("address")
        or normalized_args.get("token_address")
        or normalized_args.get("contract_address")
    )

    if canonical_name == "analyze_creator" and analysis_chain and analysis_token_address:
        if request_token_address and request_token_address == analysis_token_address:
            normalized_args["chain"] = analysis_chain
            if analysis_chain_id is not None:
                normalized_args["chain_id"] = analysis_chain_id

    return canonical_name, normalized_args


def _parse_chain_id(value: object) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _normalize_address(value: object) -> Optional[str]:
    if not value:
        return None
    return str(value).strip().lower()


def _normalize_chain_slug(value: object) -> Optional[str]:
    if not value:
        return None
    raw = str(value).strip().lower()
    aliases = {
        "ethereum": "eth",
        "mainnet": "eth",
        "bnb": "bsc",
        "bnb smart chain": "bsc",
        "matic": "polygon",
        "polygonpos": "polygon",
        "polygon_pos": "polygon",
        "arb": "arbitrum",
        "op": "optimism",
    }
    return aliases.get(raw, raw)
