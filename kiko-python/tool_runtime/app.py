import os
from typing import Any

import httpx
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel

from chat_v2.auth import require_auth


app = FastAPI(title="kiko-tool-runtime", version="2.0.0")
NODE_API_URL = os.getenv("NODE_API_URL", "http://127.0.0.1:3001").rstrip("/")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")
NATIVE_ENABLED = os.getenv("TOOL_RUNTIME_NATIVE_ENABLED", "false").lower() in ("1", "true", "yes", "on")
NATIVE_TOOLS = {
    x.strip()
    for x in (os.getenv("TOOL_RUNTIME_NATIVE_TOOLS", "") or "").split(",")
    if x.strip()
}


class ToolExecRequest(BaseModel):
    tool_name: str
    arguments: dict[str, Any] = {}
    context: dict[str, Any] = {}
    task_id: str | None = None


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "tool-runtime",
        "native_enabled": NATIVE_ENABLED,
        "native_tools": sorted(list(NATIVE_TOOLS)),
    }


def _headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if INTERNAL_SERVICE_KEY:
        headers["x-service-key"] = INTERNAL_SERVICE_KEY
    return headers


async def _bridge_definitions() -> list[dict[str, Any]]:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(f"{NODE_API_URL}/internal/tools/definitions", headers=_headers())
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text[:600])
    return list((resp.json() or {}).get("tools", []) or [])


async def _bridge_execute(tool_name: str, arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    payload = {"tool_name": tool_name, "arguments": arguments, "context": context}
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(f"{NODE_API_URL}/internal/tools/execute", headers=_headers(), json=payload)
    if resp.status_code >= 400:
        raise HTTPException(status_code=resp.status_code, detail=resp.text[:1000])
    data = resp.json()
    return {
        "ok": bool(data.get("success", False)),
        "tool_name": tool_name,
        "result": data.get("result"),
        "error": data.get("error"),
    }


def _native_tool_schemas() -> list[dict[str, Any]]:
    def fn(name: str, description: str, properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": name,
                "description": description,
                "parameters": {"type": "object", "properties": properties, "required": required},
            },
        }

    return [
        fn(
            "get_wallet_info",
            "Get wallet balances from context snapshot.",
            {"address": {"type": "string"}, "chainId": {"type": "integer"}, "chain": {"type": "string"}},
            [],
        ),
        fn(
            "get_token_info",
            "Get token info using address/symbol.",
            {"address": {"type": "string"}, "symbol": {"type": "string"}, "chainId": {"type": "integer"}},
            [],
        ),
        fn(
            "external_web_search",
            "Search web results for a query.",
            {"query": {"type": "string"}, "q": {"type": "string"}, "max_results": {"type": "integer"}},
            ["query"],
        ),
        fn(
            "simulate_swap",
            "Estimate output token amount for a swap.",
            {
                "token_in": {"type": "string"},
                "token_out": {"type": "string"},
                "amount_in": {"type": "string"},
                "chain_id": {"type": "integer"},
            },
            ["token_in", "token_out", "amount_in"],
        ),
        fn(
            "prepare_swap_transaction",
            "Prepare a swap transaction for execution.",
            {
                "token_in": {"type": "string"},
                "token_out": {"type": "string"},
                "amount_in": {"type": "string"},
                "chain_id": {"type": "integer"},
                "execute": {"type": "boolean"},
            },
            ["token_in", "token_out", "amount_in"],
        ),
    ]


async def _native_get_wallet_info(arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    cached = context.get("__wallet_info_cache")
    if isinstance(cached, dict):
        return cached

    balance = context.get("balance") or (context.get("context") or {}).get("balance") or {}
    tokens: list[dict[str, Any]] = []
    if isinstance(balance, dict):
        for symbol, amount in balance.items():
            tokens.append({"symbol": str(symbol), "balance": str(amount)})

    chain_id = arguments.get("chainId") or context.get("chainId")
    chain = arguments.get("chain") or ("base" if chain_id == 8453 else str(chain_id or "unknown"))
    return {
        "address": arguments.get("address") or context.get("walletAddress") or context.get("userAddress"),
        "chain": chain,
        "ethBalance": context.get("nativeBalance"),
        "tokens": tokens,
    }


async def _native_get_token_info(arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    address = (arguments.get("address") or "").strip()
    symbol = (arguments.get("symbol") or "").strip()
    if address:
        try:
            url = f"https://api.dexscreener.com/latest/dex/tokens/{address}"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(url)
            if resp.status_code < 400:
                data = resp.json() or {}
                pairs = data.get("pairs") or []
                if pairs:
                    p = pairs[0] or {}
                    bt = p.get("baseToken") or {}
                    return {
                        "address": address,
                        "symbol": bt.get("symbol") or symbol or "UNKNOWN",
                        "name": bt.get("name") or bt.get("symbol") or "Unknown Token",
                        "chainId": arguments.get("chainId") or context.get("chainId"),
                        "price": float(p.get("priceUsd") or 0) if p.get("priceUsd") else None,
                        "priceChange24h": (p.get("priceChange") or {}).get("h24"),
                        "volume24h": (p.get("volume") or {}).get("h24"),
                        "marketCap": p.get("fdv"),
                        "source": "dexscreener",
                    }
        except Exception:
            pass
    return {
        "address": address or None,
        "symbol": symbol or "UNKNOWN",
        "name": symbol or "Unknown Token",
        "chainId": arguments.get("chainId") or context.get("chainId"),
        "source": "native-fallback",
    }


async def _native_external_web_search(arguments: dict[str, Any]) -> dict[str, Any]:
    query = (arguments.get("query") or arguments.get("q") or "").strip()
    if not query:
        return {"results": "", "citations": [], "error": "query is required"}
    url = "https://api.duckduckgo.com/"
    params = {"q": query, "format": "json", "no_html": 1, "skip_disambig": 1}
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
    if resp.status_code >= 400:
        return {"results": "", "citations": [], "error": f"search failed HTTP {resp.status_code}"}
    data = resp.json() or {}
    abstract = data.get("AbstractText") or ""
    related = data.get("RelatedTopics") or []
    lines: list[str] = []
    citations: list[dict[str, Any]] = []
    if abstract:
        lines.append(abstract)
        if data.get("AbstractURL"):
            citations.append({"url": data.get("AbstractURL"), "title": data.get("Heading") or "Source"})
    for item in related[:5]:
        if isinstance(item, dict) and item.get("Text"):
            lines.append(item.get("Text"))
            if item.get("FirstURL"):
                citations.append({"url": item.get("FirstURL"), "title": item.get("Text")[:80]})
    return {"results": "\n".join(lines[:6]), "citations": citations}


async def _native_simulate_swap(arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    token_in = str(arguments.get("token_in") or "")
    token_out = str(arguments.get("token_out") or "")
    amount_in = str(arguments.get("amount_in") or "0")
    try:
        amount = float(amount_in)
    except Exception:
        amount = 0.0
    if amount <= 0:
        return {"error": "invalid amount_in"}

    in_info = await _native_get_token_info({"address": token_in, "symbol": token_in, "chainId": arguments.get("chain_id")}, context)
    out_info = await _native_get_token_info({"address": token_out, "symbol": token_out, "chainId": arguments.get("chain_id")}, context)
    p_in = float(in_info.get("price") or 0)
    p_out = float(out_info.get("price") or 0)
    if p_in > 0 and p_out > 0:
        expected_out = amount * p_in / p_out
        return {
            "token_in": token_in,
            "token_out": token_out,
            "amount_in": amount_in,
            "expected_out": expected_out,
            "expected_out_human": f"{expected_out:.6f}",
            "source": "native-price-ratio",
        }
    return {
        "token_in": token_in,
        "token_out": token_out,
        "amount_in": amount_in,
        "expected_out_human": "unknown",
        "warning": "Unable to quote price natively; use bridge mode for exact quote.",
        "source": "native-fallback",
    }


async def _native_prepare_swap_transaction(arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    return {
        "_must_stop": True,
        "error": "Native swap transaction preparation is not enabled yet.",
        "_user_message": "Swap execution in Python-native mode is not enabled yet. Please enable bridge mode for transaction building.",
        "arguments": arguments,
        "context_hint": {"walletAddress": context.get("walletAddress"), "chainId": context.get("chainId")},
    }


async def _native_execute(tool_name: str, arguments: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
    if tool_name == "get_wallet_info":
        return {"ok": True, "tool_name": tool_name, "result": await _native_get_wallet_info(arguments, context), "error": None}
    if tool_name == "get_token_info":
        return {"ok": True, "tool_name": tool_name, "result": await _native_get_token_info(arguments, context), "error": None}
    if tool_name == "external_web_search":
        return {"ok": True, "tool_name": tool_name, "result": await _native_external_web_search(arguments), "error": None}
    if tool_name == "simulate_swap":
        return {"ok": True, "tool_name": tool_name, "result": await _native_simulate_swap(arguments, context), "error": None}
    if tool_name == "prepare_swap_transaction":
        return {"ok": True, "tool_name": tool_name, "result": await _native_prepare_swap_transaction(arguments, context), "error": None}
    return {"ok": False, "tool_name": tool_name, "result": None, "error": f"Native tool not implemented: {tool_name}"}


@app.get("/internal/v1/tool/definitions", dependencies=[Depends(require_auth)])
async def tool_definitions():
    bridged = await _bridge_definitions()
    if not NATIVE_ENABLED or not NATIVE_TOOLS:
        return {"ok": True, "tools": bridged}
    native = [t for t in _native_tool_schemas() if ((t.get("function") or {}).get("name") in NATIVE_TOOLS)]
    by_name: dict[str, dict[str, Any]] = {}
    for item in bridged:
        name = (item.get("function") or {}).get("name")
        if name:
            by_name[name] = item
    for item in native:
        name = (item.get("function") or {}).get("name")
        if name:
            by_name[name] = item
    return {"ok": True, "tools": list(by_name.values())}


@app.post("/internal/v1/tool/execute", dependencies=[Depends(require_auth)])
async def execute_tool(req: ToolExecRequest):
    if NATIVE_ENABLED and req.tool_name in NATIVE_TOOLS:
        return await _native_execute(req.tool_name, req.arguments, req.context)
    return await _bridge_execute(req.tool_name, req.arguments, req.context)


@app.post("/internal/v1/tool/jobs/{job_id}/result", dependencies=[Depends(require_auth)])
async def tool_job_callback(job_id: str, payload: dict[str, Any]):
    return {"ok": True, "job_id": job_id, "accepted": True, "payload": payload}
