from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


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
    match = re.search(r"\b(all|\d+(?:\.\d+)?%?)\b", text, flags=re.IGNORECASE)
    return match.group(1) if match else None


def _amount_semantic(text: str) -> str:
    if re.search(r"\b(buy|get|receive)\b", text, flags=re.IGNORECASE) or "买" in text:
        return "output"
    return "input"


def parse_intent(message: str, context: dict[str, Any] | None = None) -> IntentResult:
    text = (message or "").strip()
    lower = text.lower()

    contract_address, detected_chain = _extract_contract_address(text)
    symbols = _extract_symbols(text)
    amount = _parse_amount(text)

    has_copy = bool(re.search(r"\b(copy ?trade|copytrading|follow this trader|mirror trade)\b", lower)) or ("跟单" in text)
    has_cross_chain = bool(re.search(r"\b(cross.chain|cross chain|bridge|bridging)\b", lower))
    has_trade = bool(re.search(r"\b(swap|trade|buy|sell|convert|exchange|下单|买|卖|兑换)\b", lower))
    has_confirmation = bool(re.fullmatch(r"(proceed|confirm|yes|go ahead|execute|do it|approve|submit|ok|okay|sure|确认|确定|执行|好的|继续)", lower))

    primary = "TRADING"
    confidence = 0.55
    action = "general_query"
    reason = "trade_only_fallback"

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
