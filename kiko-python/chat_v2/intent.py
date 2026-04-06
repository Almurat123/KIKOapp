from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any

import httpx

from .settings import settings


logger = logging.getLogger(__name__)

IntentType = str


@dataclass
class IntentResult:
    high_level: dict[str, Any]
    detailed: dict[str, Any]
    decision: dict[str, Any]
    contract_address: str | None = None
    chain_id: int | None = None
    swap_intent: dict[str, Any] | None = None


EVM_ADDR_RE = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
SOL_ADDR_RE = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")
STABLE_SYMBOLS = {"USDC", "USDT", "DAI", "FDUSD", "BUSD", "USD1"}
NATIVE_SYMBOLS = {"ETH", "WETH", "BNB", "WBNB", "SOL", "WSOL", "POL", "MATIC", "WMATIC"}
ALLOWED_HIGH_LEVELS = {"TRADING", "COPY_TRADING", "PREDICTION_MARKETS", "RISK_SCAN", "GENERAL_QUERY"}
ALLOWED_ACTIONS = {"swap", "copy_trade", "cross_chain_trade", "general_query"}
INTENT_MODEL_ROUTER_MODE = os.getenv("INTENT_MODEL_ROUTER", "model").strip().lower()
INTENT_MODEL_ROUTER_ENABLED = INTENT_MODEL_ROUTER_MODE not in {"0", "false", "off", "rules", "rule", "legacy"}
INTENT_MODEL = os.getenv("INTENT_MODEL", settings.DEFAULT_MODEL).strip() or settings.DEFAULT_MODEL
INTENT_GATEWAY_URL = os.getenv("LLM_GATEWAY_URL", settings.LLM_GATEWAY_URL).rstrip("/")
INTENT_TIMEOUT_SEC = max(1.5, float(os.getenv("INTENT_MODEL_TIMEOUT_SEC", "8")))
INTENT_HEADERS = {"Content-Type": "application/json"}
if settings.INTERNAL_SERVICE_KEY:
    INTENT_HEADERS["X-Service-Key"] = settings.INTERNAL_SERVICE_KEY
    INTENT_HEADERS["X-Internal-Service-Key"] = settings.INTERNAL_SERVICE_KEY


def _normalize_high_level_type(value: Any, fallback: str) -> str:
    candidate = str(value or "").strip().upper()
    return candidate if candidate in ALLOWED_HIGH_LEVELS else fallback


def _normalize_action(value: Any, fallback: str) -> str:
    candidate = str(value or "").strip().lower()
    return candidate if candidate in ALLOWED_ACTIONS else fallback


def _normalize_stage(value: Any) -> str:
    candidate = str(value or "").strip().lower()
    if candidate in {"model", "rule", "fallback"}:
        return candidate
    return "fallback"


def _looks_like_token_address(value: Any) -> bool:
    candidate = str(value or "").strip()
    return bool(
        re.fullmatch(r"0x[a-fA-F0-9]{40}", candidate)
        or re.fullmatch(r"[1-9A-HJ-NP-Za-km-z]{32,44}", candidate)
    )


def _clamp_confidence(value: Any, fallback: float) -> float:
    try:
        n = float(value)
    except Exception:
        return fallback
    if n < 0:
        return 0.0
    if n > 1:
        return 1.0
    return n


def _build_context_summary(context: dict[str, Any] | None, contract_address: str | None, chain_id: int | None) -> dict[str, Any]:
    ctx = context or {}
    return {
        "userAddress": ctx.get("userAddress"),
        "chainId": ctx.get("chainId") or chain_id,
        "chainName": ctx.get("chainName"),
        "isWalletConnected": ctx.get("isWalletConnected"),
        "currentPage": ctx.get("currentPage"),
        "pageContext": ctx.get("pageContext"),
        "pendingSwapToken": ctx.get("pendingSwapToken"),
        "detectedContractAddress": contract_address,
    }


def _build_classifier_messages(message: str, context_summary: dict[str, Any]) -> list[dict[str, str]]:
    system = "\n".join([
        "You are KiKo intent classifier.",
        "Classify the latest user message into a single intent and slot set.",
        "Return only valid JSON and no markdown, no prose, and no code fences.",
        "Allowed high-level types: TRADING, COPY_TRADING, PREDICTION_MARKETS, RISK_SCAN, GENERAL_QUERY.",
        "Allowed detailed actions: swap, copy_trade, cross_chain_trade, general_query.",
        "Use GENERAL_QUERY for research, news, discovery, explanation, and non-action questions.",
        "Use TRADING only when the user is actually asking to buy, sell, swap, exchange, or bridge an asset.",
        "Do not infer trading intent from token mentions alone.",
        "Use the context block for wallet, chain, and pending token hints, but do not invent missing values.",
        "Response schema:",
        "{",
        '  "highLevel": {"type": string, "confidence": number},',
        '  "detailed": {',
        '    "action": string,',
        '    "token_address": string | null,',
        '    "token_symbol": string | null,',
        '    "chain_id": number | null,',
        '    "token_in": string | null,',
        '    "token_out": string | null,',
        '    "amount": string | null,',
        '    "amount_semantic": "input" | "output",',
        '    "confidence": number,',
        '    "evidence": [string]',
        "  },",
        '  "decision": {',
        '    "primary": string,',
        '    "confidence": number,',
        '    "labels": [{"label": string, "confidence": number}],',
        '    "routing": {"stage": "model", "reason": string}',
        "  }",
        "}",
    ])

    user = json.dumps({"message": message, "context": context_summary}, ensure_ascii=False)
    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def _extract_json_object(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if not text:
        return None
    stripped = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE).strip()
    stripped = re.sub(r"```$", "", stripped).strip()

    def _try(candidate: str) -> dict[str, Any] | None:
        try:
            parsed = json.loads(candidate)
        except Exception:
            return None
        if isinstance(parsed, dict):
            return parsed
        return None

    direct = _try(stripped)
    if direct is not None:
        return direct

    first = stripped.find("{")
    last = stripped.rfind("}")
    if first >= 0 and last > first:
        return _try(stripped[first:last + 1])
    return None


def _extract_assistant_text(events: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for event in events:
        event_type = str(event.get("event_type") or event.get("type") or "")
        if event_type not in {"delta_text", "assistant_delta"}:
            continue
        payload = event.get("payload") or {}
        parts.append(str(payload.get("text") or payload.get("content") or ""))
    return "".join(parts)


def _extract_contract_address(text: str) -> tuple[str | None, int | None]:
    evm = EVM_ADDR_RE.search(text)
    if evm:
        return evm.group(0), 8453
    sol = SOL_ADDR_RE.search(text)
    if sol:
        return sol.group(0), 900
    return None, None


def _extract_symbols(raw: str) -> list[str]:
    seen: list[str] = []
    for match in re.finditer(r"\b[A-Z]{2,10}\b", raw):
        symbol = str(match.group(0) or "").upper()
        if symbol not in seen:
            seen.append(symbol)
    return seen


def _guess_token_out(raw: str, symbols: list[str], context: dict[str, Any] | None, contract_address: str | None) -> str | None:
    if contract_address:
        return contract_address
    lower = raw.lower()
    for symbol in symbols:
        if symbol in {"BUY", "SELL", "SWAP", "TRADE", "GET", "ALL"}:
            continue
        if re.search(rf"\b(buy|get|receive)\s+[\d.%]*\s*{re.escape(symbol.lower())}\b", lower):
            return symbol
    for symbol in symbols:
        if symbol in {"BUY", "SELL", "SWAP", "TRADE", "GET", "ALL"}:
            continue
        if symbol not in NATIVE_SYMBOLS:
            return symbol
    pending = (context or {}).get("pendingSwapToken") or {}
    if isinstance(pending, dict) and pending.get("symbol"):
        return str(pending.get("symbol"))
    return symbols[0] if symbols else None


def _guess_token_in(raw: str, symbols: list[str], context: dict[str, Any] | None, token_out: str | None) -> str | None:
    lower = raw.lower()
    chain_id = int(((context or {}).get("chainId")) or 8453)
    native_by_chain = {
        1: "ETH",
        10: "ETH",
        56: "BNB",
        137: "POL",
        42161: "ETH",
        8453: "ETH",
        900: "SOL",
    }
    if re.search(r"\b(sell|dump|swap out of|convert)\b", lower) or "卖" in raw:
        for symbol in symbols:
            if symbol != token_out and symbol not in STABLE_SYMBOLS:
                return symbol
        return token_out
    for symbol in symbols:
        if symbol != token_out and symbol in NATIVE_SYMBOLS:
            return symbol
    return native_by_chain.get(chain_id, "ETH")


def _parse_amount(text: str) -> str | None:
    match = re.search(r"(all|\d+(?:\.\d+)?%?)", text, flags=re.IGNORECASE)
    return match.group(1) if match else None


def _amount_semantic(text: str) -> str:
    if re.search(r"\b(buy|get|receive)\b", text, flags=re.IGNORECASE) or "买" in text:
        return "output"
    return "input"


def _parse_intent_rules(message: str, context: dict[str, Any] | None = None) -> IntentResult:
    text = (message or "").strip()
    lower = text.lower()

    contract_address, detected_chain = _extract_contract_address(text)
    symbols = _extract_symbols(text)
    amount = _parse_amount(text)

    has_copy = bool(re.search(r"\b(copy ?trade|copytrading|follow this trader|mirror trade)\b", lower)) or bool(re.search(r"(跟单|复制交易|镜像交易)", text))
    has_cross_chain = bool(re.search(r"\b(cross.chain|cross chain|bridge|bridging)\b", lower))
    has_trade = bool(re.search(r"\b(swap|trade|buy|sell|convert|exchange|下单)\b", lower)) or bool(re.search(r"(买|卖|兑换|交易|购买|卖出)", text))
    has_confirmation = bool(re.fullmatch(r"(proceed|confirm|yes|go ahead|execute|do it|approve|submit|ok|okay|sure|确认|确定|执行|好的|继续)", lower))

    primary = "GENERAL_QUERY"
    confidence = 0.55
    action = "general_query"
    reason = "general_query_fallback"

    if has_copy:
        primary = "COPY_TRADING"
        confidence = 0.95
        action = "copy_trade"
        reason = "copy_trade_keyword"
    elif has_confirmation or has_trade or has_cross_chain:
        primary = "TRADING"
        confidence = 0.98 if has_confirmation else 0.9
        action = "cross_chain_trade" if has_cross_chain else "swap"
        reason = "trade_confirmation_keyword" if has_confirmation else ("cross_chain_keyword" if has_cross_chain else "trade_keyword")

    token_out = _guess_token_out(text, symbols, context, contract_address) if action != "general_query" else None
    token_in = _guess_token_in(text, symbols, context, token_out) if action != "general_query" else None
    chain_id = detected_chain or (context or {}).get("chainId") or 8453

    detailed = {
        "version": "trade_only_v2",
        "origin": "chat",
        "action": action,
        "token_in": token_in,
        "token_out": token_out,
        "amount": amount,
        "amount_semantic": _amount_semantic(text) if action != "general_query" else "input",
        "chain_id": chain_id,
        "token_address": contract_address,
        "query": text,
    }
    high_level = {"type": primary, "confidence": confidence}
    decision = {
        "primary": primary,
        "confidence": confidence,
        "labels": [{"label": primary, "confidence": confidence}],
        "routing": {"stage": "rule", "reason": reason},
    }
    if primary == "TRADING":
        decision["hardRule"] = {"label": "TRADING", "reason": reason}
    elif primary == "COPY_TRADING":
        decision["hardRule"] = {"label": "COPY_TRADING", "reason": reason}

    swap_intent = {
        "tokenIn": token_in,
        "tokenOut": token_out,
        "amount": amount,
        "amountSemantic": _amount_semantic(text) if action != "general_query" else "input",
    } if action in {"swap", "cross_chain_trade"} else None

    return IntentResult(
        high_level=high_level,
        detailed=detailed,
        decision=decision,
        contract_address=contract_address,
        chain_id=chain_id,
        swap_intent=swap_intent,
    )


async def _classify_intent_with_model(
    message: str,
    context: dict[str, Any] | None,
    contract_address: str | None,
    chain_id: int | None,
) -> dict[str, Any] | None:
    if not INTENT_MODEL_ROUTER_ENABLED:
        return None

    body = {
        "model": INTENT_MODEL,
        "messages": _build_classifier_messages(message, _build_context_summary(context, contract_address, chain_id)),
        "stream": False,
        "tools": [],
        "enable_search": False,
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(INTENT_TIMEOUT_SEC)) as client:
            resp = await client.post(
                f"{INTENT_GATEWAY_URL}/internal/v1/generate",
                headers=INTENT_HEADERS,
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("intent model call failed, falling back to rules: %s", exc)
        return None

    events = data.get("events") if isinstance(data, dict) else None
    if not isinstance(events, list):
        return None
    for event in events:
        if str(event.get("event_type") or event.get("type") or "").lower() == "error":
            raise RuntimeError(str((event.get("payload") or {}).get("message") or "intent classification failed"))

    content = _extract_assistant_text(events)
    return _extract_json_object(content)


def _normalize_model_intent(
    message: str,
    context: dict[str, Any] | None,
    raw: dict[str, Any],
    fallback: IntentResult,
) -> IntentResult:
    fallback_high = fallback.high_level
    fallback_detail = fallback.detailed

    high_type = _normalize_high_level_type((raw.get("highLevel") or {}).get("type"), fallback_high["type"])
    high_conf = _clamp_confidence((raw.get("highLevel") or {}).get("confidence") or (raw.get("decision") or {}).get("confidence") or (raw.get("detailed") or {}).get("confidence"), float(fallback_high.get("confidence") or 0.55))
    raw_detail = raw.get("detailed") or {}
    model_action = _normalize_action(
        raw_detail.get("action"),
        "copy_trade" if high_type == "COPY_TRADING" else ("swap" if high_type == "TRADING" else "general_query"),
    )

    contract_address, detected_chain = _extract_contract_address(message)
    token_address = raw_detail.get("token_address")
    if not isinstance(token_address, str) or not token_address.strip() or not _looks_like_token_address(token_address):
        token_address = contract_address or fallback.contract_address
    token_symbol = raw_detail.get("token_symbol")
    if not isinstance(token_symbol, str) or not token_symbol.strip():
        token_symbol = fallback.detailed.get("token_symbol")

    chain_id = raw_detail.get("chain_id") or fallback.chain_id or detected_chain or (context or {}).get("chainId") or 8453

    token_in = raw_detail.get("token_in")
    if not isinstance(token_in, str) or not token_in.strip():
        token_in = fallback_detail.get("token_in") if high_type in {"TRADING", "COPY_TRADING"} else None

    token_out = raw_detail.get("token_out")
    if not isinstance(token_out, str) or not token_out.strip():
        token_out = fallback_detail.get("token_out") if high_type in {"TRADING", "COPY_TRADING"} else None

    amount = raw_detail.get("amount")
    if not isinstance(amount, str) or not amount.strip():
        amount = fallback_detail.get("amount") if high_type in {"TRADING", "COPY_TRADING"} else None

    amount_semantic = raw_detail.get("amount_semantic")
    if amount_semantic not in {"input", "output"}:
        amount_semantic = fallback_detail.get("amount_semantic") if high_type in {"TRADING", "COPY_TRADING"} else "input"

    labels = raw.get("decision", {}).get("labels")
    if isinstance(labels, list) and labels:
        normalized_labels: list[dict[str, Any]] = []
        for label in labels:
            if not isinstance(label, dict):
                continue
            normalized_labels.append({
                "label": _normalize_high_level_type(label.get("label"), high_type),
                "confidence": _clamp_confidence(label.get("confidence"), high_conf),
            })
        labels_out = [label for label in normalized_labels if label.get("label")]
    else:
        labels_out = [{"label": high_type, "confidence": high_conf}]

    detailed = {
        **fallback_detail,
        "version": fallback_detail.get("version") or "trade_only_v2",
        "intent_id": fallback_detail.get("intent_id") or "intent-model",
        "origin": "chat",
        "action": model_action if high_type in {"TRADING", "COPY_TRADING"} else "general_query",
        "token_address": token_address,
        "token_symbol": token_symbol,
        "chain_id": chain_id,
        "token_in": token_in if high_type in {"TRADING", "COPY_TRADING"} else None,
        "token_out": token_out if high_type in {"TRADING", "COPY_TRADING"} else None,
        "amount": amount if high_type in {"TRADING", "COPY_TRADING"} else None,
        "amount_semantic": amount_semantic if high_type in {"TRADING", "COPY_TRADING"} else "input",
        "wallet_address": (context or {}).get("userAddress"),
        "query": message,
        "confidence": high_conf,
        "evidence": [str(x) for x in (raw_detail.get("evidence") or []) if str(x).strip()] or [f"model:{((raw.get('decision') or {}).get('routing') or {}).get('reason') or 'classified'}"],
    }

    decision: dict[str, Any] = {
        "primary": _normalize_high_level_type((raw.get("decision") or {}).get("primary"), high_type),
        "confidence": _clamp_confidence((raw.get("decision") or {}).get("confidence"), high_conf),
        "labels": labels_out,
        "routing": {
            "stage": "model",
            "reason": str(((raw.get("decision") or {}).get("routing") or {}).get("reason") or "model_classification"),
        },
    }
    hard_rule = (raw.get("decision") or {}).get("hardRule")
    if isinstance(hard_rule, dict) and hard_rule.get("label"):
        decision["hardRule"] = {
            "label": _normalize_high_level_type(hard_rule.get("label"), high_type),
            "reason": str(hard_rule.get("reason") or "model_hard_rule"),
        }

    return IntentResult(
        high_level={"type": high_type, "confidence": high_conf},
        detailed=detailed,
        decision=decision,
        contract_address=token_address or fallback.contract_address,
        chain_id=chain_id,
        swap_intent={
            "tokenIn": token_in,
            "tokenOut": token_out,
            "amount": amount,
        } if high_type in {"TRADING", "COPY_TRADING"} else None,
    )


async def parse_intent(message: str, context: dict[str, Any] | None = None) -> IntentResult:
    text = (message or "").strip()
    contract_address, detected_chain = _extract_contract_address(text)
    fallback = _parse_intent_rules(text, context)

    try:
        model = await _classify_intent_with_model(text, context, contract_address, detected_chain)
        if model:
            return _normalize_model_intent(text, context, model, fallback)
    except Exception as exc:
        logger.warning("intent model normalization failed, falling back to rules: %s", exc)

    return fallback
